import cv2
import time
from src.detection.hand_tracking.modules.hand_detector import HandDetector
import joblib
import pathlib

current_dir = pathlib.Path(__file__).parent
model_dir = current_dir / "models"

with open(model_dir / "static_gesture_label_encoder.pkl", "rb") as f:
    gesture_label_encoder = joblib.load(f)

with open(model_dir / "static_gesture_classifier.pkl", "rb") as f:
    gesture_classifier = joblib.load(f)

def run_demo(camera_index: int = 0) -> None:
    """Simple demo loop for testing the hand detector interactively."""

    cap = cv2.VideoCapture(camera_index)
    if not cap.isOpened():
        raise RuntimeError("Unable to open camera. Check device connection or index.")

    detector = HandDetector(max_hands=1)
    prev_time = time.time()

    while True:
        success, frame = cap.read()
        if not success or frame is None:
            print("Warning: Failed to read frame from camera.")
            time.sleep(0.1)
            continue

        processed_frame = detector.find_hands(frame)
        if processed_frame is not None:
            frame = processed_frame

        detector.extract_landmarks(frame)

        landmarks = detector.extract_normalized_landmarks(frame)
        landmarks = sorted(landmarks, key=lambda lm: lm.id)
        if landmarks:
            landmark_values = [coord for lm in landmarks for coord in (lm.x, lm.y)]
            gesture_label = gesture_classifier.predict([landmark_values])[0]
            confidence_scores = gesture_classifier.predict_proba([landmark_values])[0]
            confidence = max(confidence_scores)
            gesture_name = gesture_label_encoder.inverse_transform([gesture_label])[0]
            if confidence > 0.4:
                cv2.putText(
                    frame,
                    f"{gesture_name} ({confidence:.2f})",
                    (10, 30),
                    cv2.FONT_HERSHEY_PLAIN,
                    2,
                    (0, 255, 255),
                    2,
                )

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