"""Connection manager handling active WebSocket clients."""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from typing import Set

import websockets
from websockets.server import WebSocketServerProtocol

from src.common.logging import get_logger


logger = get_logger(__name__)


@dataclass
class ConnectionManager:
    """Track active WebSocket clients and broadcast messages safely."""

    clients: Set[WebSocketServerProtocol] = field(default_factory=set)
    _lock: asyncio.Lock = field(default_factory=asyncio.Lock, init=False)

    async def register(self, websocket: WebSocketServerProtocol) -> None:
        """Add a newly connected client to the active set."""

        async with self._lock:
            self.clients.add(websocket)
        logger.info("Client connected: %s", getattr(websocket, "remote_address", "unknown"))

    async def unregister(self, websocket: WebSocketServerProtocol) -> None:
        """Remove a disconnected client from the active set."""

        async with self._lock:
            self.clients.discard(websocket)
        logger.info("Client disconnected: %s", getattr(websocket, "remote_address", "unknown"))

    async def broadcast(self, message: str) -> None:
        """Send a raw JSON string to every connected client."""

        if not self.clients:
            return

        stale_clients: list[WebSocketServerProtocol] = []

        for client in list(self.clients):
            try:
                await client.send(message)
            except websockets.ConnectionClosed:
                stale_clients.append(client)
                logger.warning("Dropping stale client: %s", getattr(client, "remote_address", "unknown"))

        if stale_clients:
            async with self._lock:
                for client in stale_clients:
                    self.clients.discard(client)
