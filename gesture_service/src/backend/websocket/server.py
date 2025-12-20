"""Async WebSocket server implementation for gesture broadcasting."""

from __future__ import annotations

import asyncio
import contextlib
import json
import time
from concurrent.futures import Future
from threading import Event, Thread
from typing import Any, Awaitable, Optional

import websockets
from websockets.server import WebSocketServerProtocol

from src.backend.config import Settings, get_settings
from src.backend.models import GesturePayload, HeartbeatPayload
from src.common.logging import get_logger
from src.detection.hand_tracking.detector_pipeline import GesturePipeline
from .manager import ConnectionManager


STATIC_REBROADCAST_INTERVAL = 2.0


class GestureWebSocketServer:
    """Manage WebSocket lifecycle and periodic heartbeats."""

    def __init__(
        self,
        settings: Settings | None = None,
        connection_manager: ConnectionManager | None = None,
    ) -> None:
        self.settings = settings or get_settings()
        self.manager = connection_manager or ConnectionManager()
        self._server = None
        self._heartbeat_task: asyncio.Task | None = None
        self.logger = get_logger(__name__)
        self._loop: Optional[asyncio.AbstractEventLoop] = None
        self._pipeline_thread: Optional[Thread] = None
        self._pipeline_stop_event: Event = Event()
        self._last_static_gesture: Optional[str] = None
        self._last_static_time: float = 0.0

    async def start(self) -> None:
        """Start accepting WebSocket connections."""

        self._server = await websockets.serve(
            self._handler,
            self.settings.host,
            self.settings.port,
            ping_interval=None,
        )
        self.logger.info("WebSocket server listening on %s:%s", self.settings.host, self.settings.port)
        self._heartbeat_task = asyncio.create_task(self._heartbeat_loop())
        self._loop = asyncio.get_running_loop()
        self._start_pipeline_worker()

    async def stop(self) -> None:
        """Shut down the WebSocket server and cleanup resources."""

        self._stop_pipeline_worker()

        if self._heartbeat_task:
            self._heartbeat_task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self._heartbeat_task

        if self._server:
            self._server.close()
            await self._server.wait_closed()
            self.logger.info("WebSocket server shut down")

        await self._drain_clients()

    async def broadcast_gesture(self, payload: GesturePayload) -> None:
        """Serialize and broadcast a gesture payload to all clients."""

        self.logger.debug("Broadcasting gesture %s (confidence %s)", payload.gesture, payload.confidence)
        await self.manager.broadcast(payload.model_dump_json())

    async def _handler(self, websocket: WebSocketServerProtocol) -> None:
        """Handle lifecycle for a single client connection."""

        await self.manager.register(websocket)
        try:
            await websocket.send(
                json.dumps(
                    {
                        "type": "welcome",
                        "service": self.settings.project_name,
                    }
                )
            )
            async for _ in websocket:
                # Currently we do not expect messages from clients. Keep-alive consumes them.
                continue
        finally:
            await self.manager.unregister(websocket)

    async def _heartbeat_loop(self) -> None:
        """Periodically send heartbeat messages to keep connections alive."""

        try:
            while True:
                await asyncio.sleep(self.settings.heartbeat_interval)
                heartbeat = HeartbeatPayload()
                self.logger.debug("Sending heartbeat at %s", heartbeat.timestamp)
                await self.manager.broadcast(heartbeat.model_dump_json())
        except asyncio.CancelledError:
            pass

    async def _drain_clients(self) -> None:
        """Close all active client connections gracefully."""

        if not self.manager.clients:
            return

        await asyncio.gather(
            *[
                client.close(code=1001, reason="Server shutting down")
                for client in list(self.manager.clients)
            ],
            return_exceptions=True,
        )
        closed = len(self.manager.clients)
        self.manager.clients.clear()
        if closed:
            self.logger.info("Closed %s client connections", closed)
        self._loop = None

    def _start_pipeline_worker(self) -> None:
        """Launch the gesture detection pipeline in a background thread."""

        if self._pipeline_thread and self._pipeline_thread.is_alive():
            return

        self._pipeline_stop_event.clear()
        self._pipeline_thread = Thread(
            target=self._pipeline_worker,
            name="GesturePipelineWorker",
            daemon=True,
        )
        self._pipeline_thread.start()
        self.logger.info("Gesture pipeline worker started")

    def _stop_pipeline_worker(self) -> None:
        """Request shutdown of the pipeline worker and wait for completion."""

        self._pipeline_stop_event.set()
        if self._pipeline_thread and self._pipeline_thread.is_alive():
            self._pipeline_thread.join(timeout=5.0)
            if self._pipeline_thread.is_alive():
                self.logger.warning("Gesture pipeline worker did not exit within timeout")
            else:
                self.logger.info("Gesture pipeline worker stopped")
        self._pipeline_thread = None
        self._pipeline_stop_event = Event()
        self._last_static_gesture = None
        self._last_static_time = 0.0

    def _pipeline_worker(self) -> None:
        """Blocking worker that runs the gesture detection pipeline."""

        try:
            pipeline = GesturePipeline()
            pipeline.run(
                show_window=False,
                on_dynamic=self._handle_dynamic_gesture,
                on_static=self._handle_static_gesture,
                stop_event=self._pipeline_stop_event,
            )
        except Exception as exc:  # pragma: no cover - diagnostic logging
            self.logger.exception("Gesture pipeline terminated unexpectedly: %s", exc)

    def _handle_dynamic_gesture(self, detection) -> None:
        """Forward dynamic gesture detections to connected clients."""

        if detection.label == "NONE":
            return

        payload = GesturePayload(
            gesture=detection.label,
            confidence=detection.confidence,
        )
        self._schedule_async(self.broadcast_gesture(payload))

    def _handle_static_gesture(self, result: tuple[str, float]) -> None:
        """Throttle and forward static gesture predictions."""

        gesture, confidence = result
        if gesture == "NONE":
            return

        now = time.monotonic()
        if (
            self._last_static_gesture == gesture
            and (now - self._last_static_time) < STATIC_REBROADCAST_INTERVAL
        ):
            return

        self._last_static_gesture = gesture
        self._last_static_time = now
        payload = GesturePayload(gesture=gesture, confidence=confidence)
        self._schedule_async(self.broadcast_gesture(payload))

    def _schedule_async(self, coro: Awaitable[Any]) -> None:
        """Schedule a coroutine to run on the server event loop."""

        if not self._loop:
            self.logger.debug("Event loop not ready; dropping gesture broadcast")
            return

        future = asyncio.run_coroutine_threadsafe(coro, self._loop)
        future.add_done_callback(self._on_future_done)

    def _on_future_done(self, future: Future) -> None:
        """Log exceptions raised by background coroutines."""

        with contextlib.suppress(asyncio.CancelledError):
            exc = future.exception()
            if exc:
                self.logger.error("Scheduled task failed: %s", exc, exc_info=exc)
