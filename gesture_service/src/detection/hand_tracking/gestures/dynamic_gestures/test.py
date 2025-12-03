from __future__ import annotations

import cv2
import time
from typing import Optional
from src.detection.hand_tracking.modules.hand_detector import HandDetector
from src.detection.hand_tracking.modules.landmark_buffer import LandmarkBuffer
from src.detection.hand_tracking.common.classes import LandmarkFrame
import joblib
import pathlib

current_dir = pathlib.Path(__file__).parent
model_dir = current_dir / "models"

with open(model_dir / "dynamic_gesture_label_encoder.pkl", "rb") as f:
    gesture_label_encoder = joblib.load(f)

with open(model_dir / "dynamic_gesture_classifier.pkl", "rb") as f:
    gesture_classifier = joblib.load(f)

def run_demo(camera_index: int = 0) -> None:
    """Simple demo loop for testing the hand detector interactively."""

    cap = cv2.VideoCapture(camera_index)
    if not cap.isOpened():
        raise RuntimeError("Unable to open camera. Check device connection or index.")

    detector = HandDetector(max_hands=1)
    landmark_buffer = LandmarkBuffer()
    buffer_size = landmark_buffer.maxSize()
    num_landmarks = 21
    prev_time = time.time()
    last_prediction: Optional[tuple[str, float]] = None
    prediction_hold_frames = 0
    hold_duration = 15

    while True:
        success, frame = cap.read()
        if not success or frame is None:
            print("Warning: Failed to read frame from camera.")
            time.sleep(0.1)
            continue

        processed_frame = detector.find_hands(frame)
        if processed_frame is not None:
            frame = processed_frame

        landmarks = detector.extract_normalized_landmarks(frame)
        landmarks = sorted(landmarks, key=lambda lm: lm.id)

        holding = prediction_hold_frames > 0
        if holding and last_prediction:
            gesture_name, confidence = last_prediction
            cv2.putText(
                frame,
                f"{gesture_name} ({confidence:.2f})",
                (10, 30),
                cv2.FONT_HERSHEY_PLAIN,
                2,
                (0, 255, 255),
                2,
            )
            prediction_hold_frames -= 1
            if prediction_hold_frames == 0:
                last_prediction = None

        if not holding:
            if landmarks:
                landmark_frame = LandmarkFrame(landmarks, time.time(), ("", 0.0))
                landmark_buffer.enqueue(landmark_frame)

            if landmark_buffer.size() == buffer_size:
                buffered_frames = landmark_buffer.frames()
                flattened: list[float] = []
                for snapshot in buffered_frames:
                    if len(snapshot.landmarks) != num_landmarks:
                        break
                    flattened.extend(
                        coord for lm in snapshot.landmarks for coord in (lm.x, lm.y)
                    )
                else:
                    gesture_label = gesture_classifier.predict([flattened])[0]
                    confidence_scores = gesture_classifier.predict_proba([flattened])[0]
                    confidence = float(max(confidence_scores))
                    gesture_name = gesture_label_encoder.inverse_transform([gesture_label])[0]
                    if confidence > 0.65:
                        last_prediction = (gesture_name, confidence)
                        prediction_hold_frames = hold_duration if gesture_name != "NONE" else 0
                    landmark_buffer.clear()

        current_time = time.time()
        fps = 1.0 / (current_time - prev_time)
        prev_time = current_time
        cv2.putText(
            frame,
            str(int(fps)),
            (10, 70),
            cv2.FONT_HERSHEY_PLAIN,
            3,
            (255, 0, 255),
            3,
        )
        cv2.imshow("Hand Tracking", frame)
        if cv2.waitKey(1) & 0xFF == ord("q"):
            break

    cap.release()
    cv2.destroyAllWindows()
    
if __name__ == "__main__":
    run_demo()