"""PCA-based dynamic gesture buffer processor."""

from __future__ import annotations

import math
from typing import Optional

from .base import BufferProcessor, DynamicGestureDetection
from ..landmark_buffer import LandmarkBuffer


class PCABufferProcessor(BufferProcessor):
    """Infers swipe directions by fitting a principal motion axis to centroids."""

    _LABELS = ("NONE", "SWIPE_LEFT", "SWIPE_RIGHT", "SWIPE_UP", "SWIPE_DOWN")

    def __init__(
        self,
        buffer: LandmarkBuffer,
        *,
        auto_clear: bool = True,
        linearity_threshold: float = 0.85,
        min_total_variance: float = 25.0,
        min_displacement: float = 0.2,
        skip_frames_after_detection: int = 0,
    ) -> None:
        super().__init__(buffer, auto_clear=auto_clear)
        self._linearity_threshold = linearity_threshold
        self._min_total_variance = min_total_variance
        self._min_displacement = min_displacement
        self._skip_frames_after_detection = max(0, skip_frames_after_detection)
        self._cooldown_frames = 0

    def update(self) -> Optional[DynamicGestureDetection]:
        if self._cooldown_frames > 0:
            if self._auto_clear:
                self._buffer.clear()
            self._cooldown_frames -= 1
            return None

        if self._buffer.size() < self._buffer.maxSize():
            return None

        frames = self._buffer.frames()
        if len(frames) < 2:
            return None

        centroids = [frame.landmark_centroid for frame in frames]
        if any(c is None for c in centroids):
            if self._auto_clear:
                self._buffer.clear()
            return None

        num_samples = len(centroids)
        xs = [c[0] for c in centroids]
        ys = [c[1] for c in centroids]
        mean_x = sum(xs) / num_samples
        mean_y = sum(ys) / num_samples

        centered_x = [x - mean_x for x in xs]
        centered_y = [y - mean_y for y in ys]
        denominator = num_samples - 1
        if denominator <= 0:
            return None

        cov_xx = sum(cx * cx for cx in centered_x) / denominator
        cov_yy = sum(cy * cy for cy in centered_y) / denominator
        cov_xy = sum(cx * cy for cx, cy in zip(centered_x, centered_y)) / denominator

        trace = cov_xx + cov_yy
        determinant = cov_xx * cov_yy - cov_xy * cov_xy
        discriminant = max(trace * trace - 4.0 * determinant, 0.0)
        root_term = math.sqrt(discriminant)

        primary_eigenvalue = (trace + root_term) / 2.0
        secondary_eigenvalue = (trace - root_term) / 2.0

        total_variance = primary_eigenvalue + secondary_eigenvalue

        linearity = primary_eigenvalue / total_variance if total_variance > 0 else 0.0
        if linearity < self._linearity_threshold:
            if self._auto_clear:
                self._buffer.clear()
            return None

        # Solve for the principal eigenvector of the covariance matrix.
        if abs(cov_xy) > 1e-8:
            vx = cov_xy
            vy = primary_eigenvalue - cov_xx
        else:
            vx, vy = (1.0, 0.0) if cov_xx >= cov_yy else (0.0, 1.0)

        norm = math.hypot(vx, vy)
        if norm == 0.0:
            if self._auto_clear:
                self._buffer.clear()
            return None

        vx /= norm
        vy /= norm

        delta_x = centroids[-1][0] - centroids[0][0]
        delta_y = centroids[-1][1] - centroids[0][1]
        displacement = math.hypot(delta_x, delta_y)
        if displacement < self._min_displacement:
            # print("Displacement too small:", displacement)
            if self._auto_clear:
                self._buffer.clear()
            return None

        if vx * delta_x + vy * delta_y < 0:
            vx = -vx
            vy = -vy

        angle_deg = math.degrees(math.atan2(vy, vx))
        axis_tolerance = 30.0

        if -axis_tolerance <= angle_deg <= axis_tolerance:
            label = "SWIPE_RIGHT"
        elif angle_deg >= 150.0 or angle_deg <= -150.0:
            label = "SWIPE_LEFT"
        elif 60.0 <= angle_deg <= 120.0:
            label = "SWIPE_DOWN"
        elif -120.0 <= angle_deg <= -60.0:
            label = "SWIPE_UP"
        else:
            label = "NONE"

        confidence = max(0.0, min(1.0, linearity)) if label != "NONE" else 0.0
        probabilities = [0.0] * len(self._LABELS)
        label_index = self._LABELS.index(label)
        probabilities[0] = 1.0 - confidence
        probabilities[label_index] = confidence

        if self._auto_clear:
            self._buffer.clear()

        if label != "NONE":
            self._cooldown_frames = self._skip_frames_after_detection

        return DynamicGestureDetection(
            label=label,
            confidence=confidence,
            start_time=frames[0].timestamp,
            end_time=frames[-1].timestamp,
            label_index=label_index,
            probabilities=tuple(probabilities),
        )

__all__ = ["PCABufferProcessor"]
