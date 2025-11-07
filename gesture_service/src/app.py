"""Main application orchestrator."""

import asyncio
import signal
import sys
from typing import Optional

from .config import config
from .core import CameraManager, GestureDetector, WebSocketServer
from .utils.logger import setup_logging, get_logger


logger = get_logger(__name__)


class GestureServiceApp:
    """Main application that orchestrates all components."""

    def __init__(self):
        """Initialize the gesture service application."""
        setup_logging(level="DEBUG" if config.debug else "INFO")

        self.camera = CameraManager(config.camera)
        self.detector = GestureDetector(config.gesture)
        self.ws_server = WebSocketServer(config.websocket)

        self._running = False
        self._tasks: list[asyncio.Task] = []

    async def start(self):
        """Start the gesture service."""
        logger.info("Starting Gesture Service...")

        # Start camera
        if not self.camera.start():
            logger.error("Failed to start camera. Exiting.")
            return

        # Start WebSocket server
        await self.ws_server.start()

        # Send startup status
        await self.ws_server.send_status("started", {"service": "gesture_recognition"})

        self._running = True

        # Setup signal handlers for graceful shutdown (Windows compatible)
        if sys.platform != 'win32':
            # Unix-like systems support signal handlers
            loop = asyncio.get_running_loop()
            for sig in (signal.SIGTERM, signal.SIGINT):
                loop.add_signal_handler(sig, lambda: asyncio.create_task(self.stop()))

        # Start main processing loop
        await self._run_processing_loop()

    async def _run_processing_loop(self):
        """Main processing loop for gesture detection."""
        logger.info("Starting gesture detection loop...")

        try:
            while self._running:
                # Read frame from camera
                success, frame = self.camera.read_frame()

                if not success:
                    logger.warning("Failed to read frame")
                    await asyncio.sleep(0.1)
                    continue

                # Process frame for gestures
                processed_frame, gesture_data = self.detector.process_frame(
                    frame,
                    draw_landmarks=config.debug
                )

                # If gesture detected, broadcast to clients
                if gesture_data:
                    await self.ws_server.broadcast_gesture(gesture_data)

                # Small delay to prevent CPU overload
                await asyncio.sleep(0.01)

        except asyncio.CancelledError:
            # Task was cancelled (e.g., Ctrl+C), this is expected
            logger.info("Processing loop cancelled")
        except Exception as e:
            logger.error(f"Error in processing loop: {e}", exc_info=True)
        finally:
            await self.stop()

    async def stop(self):
        """Stop the gesture service gracefully."""
        if not self._running:
            return

        logger.info("Stopping Gesture Service...")
        self._running = False

        # Send shutdown status
        await self.ws_server.send_status("stopping")

        # Stop components
        self.camera.stop()
        self.detector.close()
        await self.ws_server.stop()

        logger.info("Gesture Service stopped")

    async def run(self):
        """Run the application."""
        try:
            await self.start()
        except KeyboardInterrupt:
            logger.info("Received keyboard interrupt")
        except asyncio.CancelledError:
            logger.info("Application cancelled")
        except Exception as e:
            logger.error(f"Unexpected error: {e}", exc_info=True)
        finally:
            await self.stop()
