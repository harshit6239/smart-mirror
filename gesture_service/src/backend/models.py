"""Pydantic schemas shared across backend services."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class GesturePayload(BaseModel):
    """Structure for gesture data broadcast to WebSocket clients."""

    type: Literal["gesture"] = Field(default="gesture")
    gesture: str = Field(..., description="Canonical name of the detected gesture.")
    confidence: float = Field(
        default=0.0,
        ge=0.0,
        le=1.0,
        description="Model-provided confidence score for the gesture.",
    )
    timestamp: datetime = Field(
        default_factory=datetime.utcnow,
        description="Time the gesture was detected (UTC).",
    )


class HeartbeatPayload(BaseModel):
    """Periodic heartbeat message keeping long-lived connections alive."""

    type: Literal["heartbeat"] = Field(default="heartbeat")
    timestamp: datetime = Field(default_factory=datetime.utcnow)


WebSocketMessage = GesturePayload | HeartbeatPayload
