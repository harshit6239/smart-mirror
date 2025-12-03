"""Application entry points for the backend WebSocket service."""

from __future__ import annotations

import asyncio
import signal

from src.backend.config import get_settings
from src.backend.websocket.server import GestureWebSocketServer
from src.common.logging import get_logger, setup_logging


async def main_async() -> None:
    """Launch the WebSocket server with graceful shutdown handling."""

    settings = get_settings()
    setup_logging(settings.log_level)
    logger = get_logger(__name__)

    logger.info(
        "Starting gesture WebSocket service on %s:%s", settings.host, settings.port
    )

    server = GestureWebSocketServer(settings=settings)
    await server.start()

    stop_event = asyncio.Event()
    loop = asyncio.get_running_loop()

    for signame in ("SIGINT", "SIGTERM"):
        try:
            loop.add_signal_handler(getattr(signal, signame), stop_event.set)
        except (AttributeError, NotImplementedError):
            # Signals may be unavailable on some platforms (notably Windows)
            continue

    try:
        await stop_event.wait()
    except asyncio.CancelledError:
        pass
    finally:
        logger.info("Shutting down gesture WebSocket service")
        await server.stop()
        logger.info("Gesture WebSocket service stopped")


def run() -> None:
    """Entry point for synchronous contexts (e.g. `python -m`)."""

    try:
        asyncio.run(main_async())
    except KeyboardInterrupt:
        # Event loop already torn down; nothing else to do.
        return
