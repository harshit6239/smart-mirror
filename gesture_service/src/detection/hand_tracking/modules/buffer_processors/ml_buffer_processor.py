"""ML-backed dynamic gesture buffer processor implementation."""

from __future__ import annotations

from typing import Any, Optional

from .base import BufferProcessor, DynamicGestureDetection
from ..landmark_buffer import LandmarkBuffer


class MLBufferProcessor(BufferProcessor):
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
        super().__init__(buffer, auto_clear=auto_clear)
        self._classifier = classifier
        self._label_encoder = label_encoder
        self._confidence_threshold = confidence_threshold
        self._expected_landmark_count = expected_landmark_count

    def update(self) -> Optional[DynamicGestureDetection]:
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


__all__ = ["MLBufferProcessor"]
