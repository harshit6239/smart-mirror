import pathlib
import cv2
import time
from src.detection.hand_tracking.modules.hand_detector import HandDetector
import joblib
    

def _load_static_models():
    current_dir = pathlib.Path(__file__).parent
    static_model_dir = current_dir / "gestures/static_gestures/models"
    with open(static_model_dir / "static_gesture_label_encoder.pkl", "rb") as encoder_file:
        label_encoder = joblib.load(encoder_file)
    with open(static_model_dir / "static_gesture_classifier.pkl", "rb") as model_file:
        classifier = joblib.load(model_file)
    return label_encoder, classifier

def run_demo(camera_index: int = 0) -> None:
    """Simple demo loop for testing the hand detector interactively."""

    cap = cv2.VideoCapture(camera_index)
    if not cap.isOpened():
        raise RuntimeError("Unable to open camera. Check device connection or index.")

    detector = HandDetector()
    prev_time = time.time()
    label_encoder, classifier = _load_static_models()
    
    frame_count = 0
    last_count = 0
    space_down = False

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
        
        if landmarks:
            feature_vector = []
            for lm in landmarks:
                feature_vector.extend([lm.x, lm.y])
            prediction = classifier.predict([feature_vector])
            predicted_label = label_encoder.inverse_transform(prediction)[0]
            cv2.putText(
                frame,
                f"Gesture: {predicted_label}",
                (10, 110),
                cv2.FONT_HERSHEY_PLAIN,
                2,
                (0, 255, 0),
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
        key = cv2.waitKey(1) & 0xFF

        if key == ord(' '):
            if not space_down:
                frame_count = 0
                space_down = True
        elif key == 255 and space_down:
            space_down = False
            last_count = frame_count
        elif key == ord('q'):
            break

        if space_down:
            frame_count += 1
            last_count = frame_count

        cv2.putText(
            frame,
            f"Frame Count: {last_count}",
            (10, 150),
            cv2.FONT_HERSHEY_PLAIN,
            2,
            (0, 255, 255),
            2,
        )

        cv2.imshow("Hand Tracking", frame)
        
        

    cap.release()
    cv2.destroyAllWindows()
    
if __name__ == "__main__":
    run_demo()

