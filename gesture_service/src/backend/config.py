"""Configuration models for backend services."""

from __future__ import annotations

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Environment-driven settings for the WebSocket server."""

    host: str = Field(
        default="0.0.0.0",
        description="Interface where the WebSocket server listens.",
    )
    port: int = Field(
        default=5001,
        ge=1,
        le=65535,
        description="TCP port exposed by the WebSocket server.",
    )
    heartbeat_interval: float = Field(
        default=30.0,
        gt=0,
        description="Seconds between heartbeat pings sent to clients.",
    )
    project_name: str = Field(
        default="Gesture Service",
        description="Identifier sent during handshake events.",
    )
    log_level: str = Field(
        default="INFO",
        description="Logging verbosity threshold (e.g. DEBUG, INFO).",
    )

    class Config:
        env_prefix = "GESTURE_"
        case_sensitive = False


@lru_cache
def get_settings() -> Settings:
    """Return cached settings instance so expensive validation happens once."""

    return Settings()
