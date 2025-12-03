"""Model-backed dynamic gesture inference over buffered landmark frames."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Optional, Sequence

from ..common import classes
from .landmark_buffer import LandmarkBuffer


@dataclass(slots=True)
class DynamicGestureDetection:
    """Represents a dynamic gesture prediction emitted by the ML model."""

    label: str
    confidence: float
    start_time: float
    end_time: float
    label_index: int
    probabilities: Sequence[float]


class BufferProcessor:
    """Collects buffered frames and produces ML-based dynamic gesture predictions."""

    def __init__(
        self,
        buffer: LandmarkBuffer,
        classifier: Any,
        label_encoder: Any,
        *,
        confidence_threshold: float = 0.65,
        expected_landmark_count: int = 21,
        auto_clear: bool = True,
    ) -> None:
        self._buffer = buffer
        self._classifier = classifier
        self._label_encoder = label_encoder
        self._confidence_threshold = confidence_threshold
        self._expected_landmark_count = expected_landmark_count
        self._auto_clear = auto_clear

    def update(self) -> Optional[DynamicGestureDetection]:
        """Evaluate the buffered frames and return a gesture when confident enough."""

        if self._buffer.size() < self._buffer.maxSize():
            return None

        frames = self._buffer.frames()
        if not frames:
            return None

        if any(len(frame.landmarks) != self._expected_landmark_count for frame in frames):
            if self._auto_clear:
                self._buffer.clear()
            return None

        feature_vector: list[float] = []
        for frame in frames:
            ordered_landmarks = sorted(frame.landmarks, key=lambda lm: lm.id)
            for landmark in ordered_landmarks:
                feature_vector.extend((float(landmark.x), float(landmark.y)))

        prediction = self._classifier.predict([feature_vector])[0]
        probabilities = self._classifier.predict_proba([feature_vector])[0]
        confidence = float(max(probabilities))

        if self._auto_clear:
            self._buffer.clear()

        if confidence < self._confidence_threshold:
            return None

        label = self._label_encoder.inverse_transform([prediction])[0]
        
        if label == "NONE":
            return None
        
        return DynamicGestureDetection(
            label=label,
            confidence=confidence,
            start_time=frames[0].timestamp,
            end_time=frames[-1].timestamp,
            label_index=int(prediction),
            probabilities=tuple(float(p) for p in probabilities),
        )
