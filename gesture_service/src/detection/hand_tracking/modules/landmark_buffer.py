"""Buffer Utility for dynamic gesture motion capture."""

from typing import List, Optional
from ..common import classes

class LandmarkBuffer:
    """Utility for maintaing buffer of landmarks for dynamic gesture motion capture."""

    def __init__(self, buffer_size: int = 10) -> None:
        self._buffer_size = buffer_size
        self._buffer: List[classes.LandmarkFrame] = []

    def enqueue(self, landmarkFrame: classes.LandmarkFrame) -> None:
        if len(self._buffer) >= self._buffer_size:
            self._buffer.pop(0)
        self._buffer.append(landmarkFrame)

    def size(self) -> int:
        return len(self._buffer)
    
    def maxSize(self) -> int:
        return self._buffer_size

    def clear(self) -> None:
        self._buffer = []

    def frames(self) -> List[classes.LandmarkFrame]:
        """Return a shallow copy of buffered frames for read-only processing."""

        return list(self._buffer)

    def latest(self) -> Optional[classes.LandmarkFrame]:
        """Return the newest frame if the buffer is not empty."""

        return self._buffer[-1] if self._buffer else None