from gesture_service.src.detection.hand_tracking.modules.hand_detector import HandDetector
import argparse
import pandas as pd
import cv2
import time

parser = argparse.ArgumentParser(description="Gesture dataset creator")

parser.add_argument("--max-samples", type=int, default=300, help="Maximum number of samples")
parser.add_argument("--gesture-name", type=str, default="", help="Gesture name")


args = parser.parse_args()

if args.gesture_name.strip() == "":
    raise ValueError("Gesture name is required use --gesture-name <gesture_name> to provide gesture name")

columns = []
for i in range(0, 21):
    columns.append(f"x_{i}")
    columns.append(f"y_{i}")
columns.append("gesture")

data = pd.DataFrame(columns=columns)

cap = cv2.VideoCapture(0)
if not cap.isOpened():
    raise RuntimeError("Unable to open camera. Check device connection or index.")

detector = HandDetector()
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

    landmarks = detector.extract_normalized_landmarks(frame)
    landmarks = sorted(landmarks, key=lambda lm: lm.id)


    key = cv2.waitKey(1)
    if key == 32:  # 32 is the ASCII value for spacebar
        if landmarks:
            time.sleep(0.2)
            landmark_values = [coord for lm in landmarks for coord in (lm.x, lm.y)]
            new_row_data = landmark_values + [args.gesture_name]
            data.loc[len(data)] = new_row_data
            print(f"Sample added for gesture: {args.gesture_name}. Total samples: {len(data)}")
        else:
            print("No landmarks detected to save.")

    if len(data) >= args.max_samples:
        break

    current_time = time.time()
    fps = 1.0 / (current_time - prev_time)
    prev_time = current_time

    cv2.putText(frame, str(int(fps)), (10, 70), cv2.FONT_HERSHEY_PLAIN, 3, (255, 0, 255), 3)
    cv2.putText(frame, "Press SPACE to capture sample", (10, 450), cv2.FONT_HERSHEY_PLAIN,2,(0, 255, 255), 2)
    cv2.putText(frame, f"Gesture: {args.gesture_name}", (10, 420), cv2.FONT_HERSHEY_PLAIN, 2, (0,255,255), 2)
    cv2.putText(frame, f"Samples: {len(data)}/{args.max_samples}", (10, 390), cv2.FONT_HERSHEY_PLAIN, 2, (0,255,255), 2)
    cv2.imshow("Hand Tracking", frame)

    if cv2.waitKey(1) & 0xFF == ord("q"):
        break

data.to_csv(f"src/detection/hand_tracking/gesture_models/static_gestures/dataset/datasets/{args.gesture_name}.csv", index=False)

cap.release()
cv2.destroyAllWindows()
