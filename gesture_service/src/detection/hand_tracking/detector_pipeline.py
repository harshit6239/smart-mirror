"""Gesture pipeline entry point for static and dynamic gesture detection."""

from __future__ import annotations

import pathlib
import time
from threading import Event
from typing import Any, Callable, Optional, TYPE_CHECKING

import cv2

from .common.classes import LandmarkFrame
from .modules.buffer_processor import (
    BufferProcessor,
    DynamicGestureDetection,
    create_buffer_processor,
)
from .modules.detectors.static_gesture_detector import StaticGestureDetector
from .modules.hand_detector import HandDetector
from .modules.landmark_buffer import LandmarkBuffer
from .modules.utils.model_loader import load_model_bundle

if TYPE_CHECKING:
    from picamera2 import Picamera2 as Picamera2Type  # type: ignore[import]
else:  # pragma: no cover - type-only import when typing
    Picamera2Type = Any

try:
    from picamera2 import Picamera2 as Picamera2Runtime  # type: ignore[import]

    PICAMERA_AVAILABLE = True
except ImportError:  # pragma: no cover - Pi-specific optional dependency
    Picamera2Runtime = None
    PICAMERA_AVAILABLE = False


DEFAULT_STATIC_THRESHOLD = 0.4
DEFAULT_DYNAMIC_THRESHOLD = 0.8
POINT_INDEX_GESTURE = "POINT_INDEX"
OPEN_PALM_GESTURE = "OPEN_PALM"
BUFFER_MAX_SIZE = 3
BUFFER_RESET_SECONDS = 3
DEFAULT_CAMERA_RESOLUTION = (424, 240)


class GesturePipeline:
    """Encapsulates camera capture, static gestures, and dynamic ML inference."""

    def __init__(
        self,
        camera_index: int = 0,
        *,
        static_threshold: float = DEFAULT_STATIC_THRESHOLD,
        dynamic_threshold: float = DEFAULT_DYNAMIC_THRESHOLD,
        use_picamera2: bool = False,
        picamera_resolution: tuple[int, int] = DEFAULT_CAMERA_RESOLUTION,
        camera_resolution: tuple[int, int] = DEFAULT_CAMERA_RESOLUTION,
    ) -> None:
        self.camera_index = camera_index
        self._use_picamera2 = use_picamera2
        self._picamera_resolution = picamera_resolution
        self._camera_resolution = camera_resolution
        self._hand_detector = HandDetector()
        self._buffer = LandmarkBuffer(buffer_size=BUFFER_MAX_SIZE)
        self._buffer_reset_seconds = BUFFER_RESET_SECONDS
        self._last_buffer_timestamp: Optional[float] = None
        self._static_detector = StaticGestureDetector(confidence_threshold=static_threshold)
        self.static_threshold = static_threshold
        self._dynamic_label_encoder, self._dynamic_classifier = self._load_dynamic_models()
        self._dynamic_processor: BufferProcessor = create_buffer_processor(
            "pca",
            self._buffer,
            auto_clear=True,
            linearity_threshold=dynamic_threshold,
        )
        self._picamera: Optional[Picamera2Type] = None

        if self._use_picamera2:
            if not PICAMERA_AVAILABLE:
                raise RuntimeError("Picamera2 support requested but package is not available")

            assert Picamera2Runtime is not None
            self._picamera = Picamera2Runtime()
            config = self._picamera.create_video_configuration(
                main={"size": self._picamera_resolution, "format": "RGB888"},
                buffer_count=2,
            )
            self._picamera.configure(config)

    def run(
        self,
        *,
        show_window: bool = False,
        on_dynamic: Optional[Callable[[DynamicGestureDetection], None]] = None,
        on_static: Optional[Callable[[tuple[str, float]], None]] = None,
        stop_event: Optional[Event] = None,
    ) -> None:
        """Process frames until interrupted, optionally emitting callbacks."""

        cap: Optional[cv2.VideoCapture] = None

        if self._use_picamera2 and self._picamera is not None:
            self._picamera.start()
        else:
            cap = cv2.VideoCapture(self.camera_index)
            if not cap.isOpened():
                raise RuntimeError("Unable to open camera. Check device connection or index.")
            # Reduce resolution to lighten processing load when supported by the camera driver.
            cap.set(cv2.CAP_PROP_FRAME_WIDTH, float(self._camera_resolution[0]))
            cap.set(cv2.CAP_PROP_FRAME_HEIGHT, float(self._camera_resolution[1]))

        dynamic_overlay: Optional[tuple[str, float]] = None

        try:
            while True:
                if stop_event and stop_event.is_set():
                    break
                if self._use_picamera2 and self._picamera is not None:
                    frame = self._picamera.capture_array()
                    if frame is None:
                        print("Warning: Failed to read frame from Picamera2.")
                        time.sleep(0.1)
                        continue
                    frame = cv2.cvtColor(frame, cv2.COLOR_RGB2BGR)
                else:
                    assert cap is not None
                    success, frame = cap.read()
                    if not success or frame is None:
                        print("Warning: Failed to read frame from camera.")
                        time.sleep(0.1)
                        continue

                processed = self._hand_detector.find_hands(frame)
                if processed is not None:
                    frame = processed

                landmarks = self._hand_detector.extract_normalized_landmarks(frame)
                static_prediction = self._static_detector.predict(landmarks)
                if static_prediction and on_static:
                    on_static(static_prediction)

                dynamic_detection: Optional[DynamicGestureDetection] = None
                should_buffer = (
                    static_prediction is not None
                    and static_prediction[0] == POINT_INDEX_GESTURE
                    and bool(landmarks)
                )

                if should_buffer:
                    centroid = self._compute_centroid(landmarks)
                    frame_timestamp = time.time()
                    if (
                        self._last_buffer_timestamp is not None
                        and frame_timestamp - self._last_buffer_timestamp > self._buffer_reset_seconds
                    ):
                        self._buffer.clear()
                    self._last_buffer_timestamp = frame_timestamp
                    landmark_frame = LandmarkFrame(
                        landmarks=landmarks,
                        landmark_centroid=centroid,
                        timestamp=frame_timestamp,
                        static_gesture=static_prediction,
                    )
                    self._buffer.enqueue(landmark_frame)
                    if self._buffer.size() >= self._buffer.maxSize():
                        dynamic_detection = self._dynamic_processor.update()
                else:
                    if self._buffer.size() > 0 and static_prediction and static_prediction[0] == OPEN_PALM_GESTURE:
                        # Clear buffer when open palm is detected:
                        self._buffer.clear()
                        self._last_buffer_timestamp = None

                if show_window and static_prediction:
                    static_label = f"Static: {static_prediction[0]} ({static_prediction[1]:.2f})"
                    cv2.putText(
                        frame,
                        static_label,
                        (10, 80),
                        cv2.FONT_HERSHEY_PLAIN,
                        2,
                        (0, 255, 255),
                        2,
                    )

                if dynamic_detection:
                    if on_dynamic:
                        on_dynamic(dynamic_detection)
                    if dynamic_detection.label != "NONE":
                        dynamic_overlay = (dynamic_detection.label, dynamic_detection.confidence)
                    else:
                        dynamic_overlay = None
                else:
                    dynamic_overlay = None

                if show_window:
                    if dynamic_overlay:
                        dyn_label, dyn_conf = dynamic_overlay
                        dynamic_text = f"Dynamic: {dyn_label} ({dyn_conf:.2f})"
                        cv2.putText(
                            frame,
                            dynamic_text,
                            (10, 120),
                            cv2.FONT_HERSHEY_PLAIN,
                            2,
                            (0, 255, 0),
                            2,
                        )
                    cv2.imshow("Hand Tracking", frame)
                    if cv2.waitKey(1) & 0xFF == ord("q"):
                        break
        finally:
            if cap is not None:
                cap.release()
            if self._use_picamera2 and self._picamera is not None:
                self._picamera.stop()
            if show_window:
                cv2.destroyAllWindows()

    @staticmethod
    def _load_dynamic_models():
        current_dir = pathlib.Path(__file__).parent
        dynamic_model_dir = current_dir / "gesture_models/dynamic_gestures/models"

        return load_model_bundle(
            dynamic_model_dir,
            encoder_filename="dynamic_gesture_label_encoder.pkl",
            classifier_filename="dynamic_gesture_classifier.pkl",
        )

    @property
    def static_threshold(self) -> float:
        return self._static_detector.confidence_threshold

    @static_threshold.setter
    def static_threshold(self, value: float) -> None:
        self._static_detector.confidence_threshold = float(value)

    @staticmethod
    def _compute_centroid(landmarks: list[Any]) -> tuple[float, float]:
        if not landmarks:
            return (0.0, 0.0)
        x_sum = sum(lm.x for lm in landmarks)
        y_sum = sum(lm.y for lm in landmarks)
        count = len(landmarks)
        return (x_sum / count, y_sum / count)


def main() -> None:
    pipeline = GesturePipeline()
    pipeline.run(show_window=True)


if __name__ == "__main__":
    main()
