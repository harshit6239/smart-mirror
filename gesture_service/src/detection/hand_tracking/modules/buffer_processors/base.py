"""Core abstractions for dynamic gesture buffer processors."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional, Sequence

from ..landmark_buffer import LandmarkBuffer


@dataclass(slots=True)
class DynamicGestureDetection:
    """Represents a dynamic gesture prediction emitted by a buffer processor."""

    label: str
    confidence: float
    start_time: float
    end_time: float
    label_index: int
    probabilities: Sequence[float]


class BufferProcessor(ABC):
    """Interface for converting buffered frames into dynamic gesture predictions."""

    def __init__(self, buffer: LandmarkBuffer, *, auto_clear: bool = True) -> None:
        self._buffer = buffer
        self._auto_clear = auto_clear

    @abstractmethod
    def update(self) -> Optional[DynamicGestureDetection]:
        """Evaluate the buffered frames and return a gesture when confident enough."""


__all__ = ["DynamicGestureDetection", "BufferProcessor"]
