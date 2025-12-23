import cv2
import time
from src.detection.hand_tracking.modules.hand_detector import HandDetector
from .common.classes import LandmarkFrame
from .modules.buffer_processor import BufferProcessor, create_buffer_processor
from .modules.landmark_buffer import LandmarkBuffer
import mediapipe as mp

def run_demo(camera_index: int = 0) -> None:
    """Simple demo loop for testing the hand detector interactively."""

    cap = cv2.VideoCapture(camera_index)
    if not cap.isOpened():
        raise RuntimeError("Unable to open camera. Check device connection or index.")

    detector = HandDetector()
    prev_time = time.time()
    landmark_buffer = LandmarkBuffer()
    buffer_processor: BufferProcessor = create_buffer_processor(
        "pca",
        landmark_buffer,
        auto_clear=True,
        linearity_threshold=0.8,
    )
    
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
            landmark_centroid = (0.0, 0.0)
            x_sum = sum(lm.x for lm in landmarks)
            y_sum = sum(lm.y for lm in landmarks)
            landmark_centroid = (x_sum / len(landmarks), y_sum / len(landmarks))
            cam_height, cam_width, _ = frame.shape
            
            cv2.circle(
                frame,
                (int(landmark_centroid[0] * cam_width), int(landmark_centroid[1] * cam_height)),
                7,
                (0, 255, 0),
                cv2.FILLED,
            )
            
            landmark_frame = LandmarkFrame(
                landmarks,
                landmark_centroid=landmark_centroid,
                timestamp=time.time(),
                static_gesture=("", 0.0),
            )
            
            landmark_buffer.enqueue(landmark_frame)
            
            dynamic_detection = None
            if landmark_buffer.size() == landmark_buffer.maxSize():
                dynamic_detection = buffer_processor.update()
                print(f"Dynamic Detection: {dynamic_detection}")
                if dynamic_detection:
                    label, confidence = dynamic_detection.label, dynamic_detection.confidence
                    cv2.putText(
                        frame,
                        f"{label} ({confidence:.2f})",
                        (10, 30),
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

