"""Async WebSocket server implementation for gesture broadcasting."""

from __future__ import annotations

import asyncio
import contextlib
import json

import websockets
from websockets.server import WebSocketServerProtocol

from src.backend.config import Settings, get_settings
from src.backend.models import GesturePayload, HeartbeatPayload
from src.common.logging import get_logger
from .manager import ConnectionManager


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

    async def stop(self) -> None:
        """Shut down the WebSocket server and cleanup resources."""

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
