"""WebSocket server for communicating with Electron app."""

import asyncio
import json
from typing import Set, Optional, Dict, Any
import websockets
from websockets.server import WebSocketServerProtocol

from ..config import WebSocketConfig
from ..utils.logger import get_logger


logger = get_logger(__name__)


class WebSocketServer:
    """Manages WebSocket connections and message broadcasting."""

    def __init__(self, config: WebSocketConfig):
        """
        Initialize WebSocket server.

        Args:
            config: WebSocket configuration
        """
        self.config = config
        self.clients: Set[WebSocketServerProtocol] = set()
        self.server: Optional[websockets.WebSocketServer] = None
        self._message_queue: asyncio.Queue = asyncio.Queue()

    async def start(self):
        """Start the WebSocket server."""
        self.server = await websockets.serve(
            self._handle_client,
            self.config.host,
            self.config.port
        )
        logger.info(f"WebSocket server started on ws://{self.config.host}:{self.config.port}")

    async def _handle_client(self, websocket: WebSocketServerProtocol):
        """
        Handle a client connection.

        Args:
            websocket: WebSocket connection
        """
        self.clients.add(websocket)
        client_address = websocket.remote_address
        logger.info(f"Client connected: {client_address}")

        try:
            async for message in websocket:
                try:
                    data = json.loads(message)
                    await self._handle_message(websocket, data)
                except json.JSONDecodeError:
                    logger.warning(f"Invalid JSON from {client_address}: {message}")
                except Exception as e:
                    logger.error(f"Error handling message from {client_address}: {e}")

        except websockets.exceptions.ConnectionClosed:
            logger.info(f"Client disconnected: {client_address}")
        finally:
            self.clients.remove(websocket)

    async def _handle_message(self, websocket: WebSocketServerProtocol, data: Dict[str, Any]):
        """
        Handle incoming message from client.

        Args:
            websocket: WebSocket connection
            data: Parsed message data
        """
        msg_type = data.get("type")

        if msg_type == "ping":
            await websocket.send(json.dumps({"type": "pong", "timestamp": data.get("timestamp")}))
        elif msg_type == "subscribe":
            # Client subscribing to gesture events
            logger.info(f"Client subscribed: {websocket.remote_address}")
            await websocket.send(json.dumps({"type": "subscribed", "status": "success"}))
        else:
            logger.debug(f"Received message: {data}")

    async def broadcast_gesture(self, gesture_data: Dict[str, Any]):
        """
        Broadcast gesture data to all connected clients.

        Args:
            gesture_data: Gesture information to broadcast
        """
        if not self.clients:
            return

        message = json.dumps(gesture_data)
        # Send to all connected clients
        disconnected = set()

        for client in self.clients:
            try:
                await client.send(message)
            except websockets.exceptions.ConnectionClosed:
                disconnected.add(client)
            except Exception as e:
                logger.error(f"Error sending to client: {e}")
                disconnected.add(client)

        # Remove disconnected clients
        self.clients -= disconnected

    async def send_status(self, status: str, details: Optional[Dict[str, Any]] = None):
        """
        Send status update to all clients.

        Args:
            status: Status message
            details: Optional additional details
        """
        message = {
            "type": "status",
            "status": status,
            **(details or {})
        }
        await self.broadcast_gesture(message)

    async def stop(self):
        """Stop the WebSocket server."""
        if self.server:
            self.server.close()
            await self.server.wait_closed()
            logger.info("WebSocket server stopped")

    @property
    def client_count(self) -> int:
        """Get number of connected clients."""
        return len(self.clients)
