"""Gesture pipeline entry point for static and dynamic gesture detection."""

from __future__ import annotations

import pathlib
import time
from threading import Event
from typing import Any, Callable, Optional, TYPE_CHECKING

import cv2
import joblib

from .common.classes import LandmarkFrame
from .modules.buffer_processor import BufferProcessor, DynamicGestureDetection
from .modules.hand_detector import HandDetector
from .modules.landmark_buffer import LandmarkBuffer

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
DEFAULT_DYNAMIC_THRESHOLD = 0.5
DEFAULT_DYNAMIC_HOLD_FRAMES = 10
DEFAULT_DYNAMIC_EVAL_INTERVAL = 3


class GesturePipeline:
    """Encapsulates camera capture, static gestures, and dynamic ML inference."""

    def __init__(
        self,
        camera_index: int = 0,
        *,
        static_threshold: float = DEFAULT_STATIC_THRESHOLD,
        dynamic_threshold: float = DEFAULT_DYNAMIC_THRESHOLD,
        dynamic_hold_frames: int = DEFAULT_DYNAMIC_HOLD_FRAMES,
        dynamic_eval_interval: int = DEFAULT_DYNAMIC_EVAL_INTERVAL,
        use_picamera2: bool = False,
        picamera_resolution: tuple[int, int] = (640, 360),
    ) -> None:
        self.camera_index = camera_index
        self.static_threshold = static_threshold
        self._dynamic_threshold = dynamic_threshold
        self._dynamic_hold_frames = dynamic_hold_frames
        self._dynamic_eval_interval = max(1, dynamic_eval_interval)
        self._use_picamera2 = use_picamera2
        self._picamera_resolution = picamera_resolution
        self._hand_detector = HandDetector()
        self._buffer = LandmarkBuffer()
        self._label_encoder, self._classifier = self._load_static_models()
        self._dynamic_label_encoder, self._dynamic_classifier = self._load_dynamic_models()
        self._dynamic_processor = BufferProcessor(
            self._buffer,
            classifier=self._dynamic_classifier,
            label_encoder=self._dynamic_label_encoder,
            confidence_threshold=self._dynamic_threshold,
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

        dynamic_overlay: Optional[tuple[str, float]] = None
        dynamic_hold = 0
        frames_since_dynamic_eval = 0

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
                landmarks = sorted(landmarks, key=lambda lm: lm.id)

                static_prediction: Optional[tuple[str, float]] = None
                if landmarks:
                    landmark_values = [coord for lm in landmarks for coord in (lm.x, lm.y)]
                    gesture_label = self._classifier.predict([landmark_values])[0]
                    confidence_scores = self._classifier.predict_proba([landmark_values])[0]
                    confidence = max(confidence_scores)
                    gesture_name = self._label_encoder.inverse_transform([gesture_label])[0]

                    if confidence > self.static_threshold:
                        static_prediction = (gesture_name, confidence)
                        if on_static:
                            on_static(static_prediction)

                landmark_frame = LandmarkFrame(
                    landmarks=landmarks,
                    timestamp=time.time(),
                    static_gesture=static_prediction if static_prediction else ("", 0.0),
                )
                if dynamic_hold == 0:
                    self._buffer.enqueue(landmark_frame)
                    frames_since_dynamic_eval += 1
                else:
                    frames_since_dynamic_eval = 0

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

                dynamic_detection = None
                if dynamic_hold == 0 and frames_since_dynamic_eval >= self._dynamic_eval_interval:
                    dynamic_detection = self._dynamic_processor.update()
                    frames_since_dynamic_eval = 0
                if dynamic_detection:
                    if on_dynamic:
                        on_dynamic(dynamic_detection)
                    if dynamic_detection.label != "NONE":
                        dynamic_overlay = (dynamic_detection.label, dynamic_detection.confidence)
                        dynamic_hold = self._dynamic_hold_frames
                        frames_since_dynamic_eval = 0
                    else:
                        dynamic_overlay = None
                        dynamic_hold = 0
                elif dynamic_hold > 0:
                    dynamic_hold -= 1
                    if dynamic_hold == 0:
                        dynamic_overlay = None
                        frames_since_dynamic_eval = 0

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
    def _load_static_models():
        current_dir = pathlib.Path(__file__).parent
        static_model_dir = current_dir / "gestures/static_gestures/models"

        with open(static_model_dir / "static_gesture_label_encoder.pkl", "rb") as encoder_file:
            label_encoder = joblib.load(encoder_file)

        with open(static_model_dir / "static_gesture_classifier.pkl", "rb") as model_file:
            classifier = joblib.load(model_file)

        return label_encoder, classifier

    @staticmethod
    def _load_dynamic_models():
        current_dir = pathlib.Path(__file__).parent
        dynamic_model_dir = current_dir / "gestures/dynamic_gestures/models"

        with open(dynamic_model_dir / "dynamic_gesture_label_encoder.pkl", "rb") as encoder_file:
            label_encoder = joblib.load(encoder_file)

        with open(dynamic_model_dir / "dynamic_gesture_classifier.pkl", "rb") as model_file:
            classifier = joblib.load(model_file)

        return label_encoder, classifier


def main() -> None:
    pipeline = GesturePipeline()
    pipeline.run(show_window=True)


if __name__ == "__main__":
    main()
