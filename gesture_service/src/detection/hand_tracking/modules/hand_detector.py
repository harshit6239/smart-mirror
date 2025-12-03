"""Hand tracking utilities built on MediaPipe."""

from __future__ import annotations

import time
from typing import List, Optional

import cv2
import mediapipe as mp
from ..common import classes


class HandDetector:
    """Utility for detecting hands and extracting landmarks from video frames."""

    def __init__(
        self,
        mode: bool = False,
        max_hands: int = 2,
        detection_confidence: float = 0.5,
        tracking_confidence: float = 0.5,
    ) -> None:
        self.mode = mode
        self.max_hands = max_hands
        self.detection_confidence = detection_confidence
        self.tracking_confidence = tracking_confidence
        self._mp_hands = mp.solutions.hands
        self._hands = self._mp_hands.Hands(
            static_image_mode=self.mode,
            max_num_hands=self.max_hands,
            model_complexity=1,
            min_detection_confidence=self.detection_confidence,
            min_tracking_confidence=self.tracking_confidence,
        )
        self._drawer = mp.solutions.drawing_utils
        self._results: Optional[mp.framework.formats.landmark_pb2.NormalizedLandmarkList] = None

    def find_hands(self, frame, draw: bool = True):
        """Detect hands in the provided frame and optionally draw landmarks."""

        if frame is None:
            return None

        img_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        self._results = self._hands.process(img_rgb)
        if self._results and self._results.multi_hand_landmarks:
            for hand_landmarks in self._results.multi_hand_landmarks:
                if draw:
                    self._drawer.draw_landmarks(
                        frame,
                        hand_landmarks,
                        self._mp_hands.HAND_CONNECTIONS,
                    )
        return frame

    def extract_normalized_landmarks(
        self, frame, hand_index: int = 0, draw: bool = True
    ) -> List[
        
        classes.Landmark]:
        """Return the normalized coordinates for the specified hand."""

        landmarks: List[classes.Landmark] = []
        if not self._results or not self._results.multi_hand_landmarks:
            return landmarks
            
        hand_landmarks = self._results.multi_hand_landmarks[hand_index]
        height, width, _ = frame.shape
        for idx, landmark in enumerate(hand_landmarks.landmark):
            cx, cy = int(landmark.x * width), int(landmark.y * height)
            landmarks.append(classes.Landmark(idx, landmark.x, landmark.y))
            if draw:
                cv2.circle(frame, (cx, cy), 5, (255, 0, 255), cv2.FILLED)
        return landmarks

    def extract_landmarks(
        self, frame, hand_index: int = 0, draw: bool = True
    ) -> List[
        
        
        classes.Landmark]:
        """Return the pixel coordinates for the specified hand."""

        landmarks: List[classes.Landmark] = []
        if not self._results or not self._results.multi_hand_landmarks:
            return landmarks

        hand_landmarks = self._results.multi_hand_landmarks[hand_index]
        height, width, _ = frame.shape
        for idx, landmark in enumerate(hand_landmarks.landmark):
            cx, cy = int(landmark.x * width), int(landmark.y * height)
            landmarks.append(classes.Landmark(idx, cx, cy))
            if draw:
                cv2.circle(frame, (cx, cy), 5, (255, 0, 255), cv2.FILLED)
        return landmarks


def run_demo(camera_index: int = 0) -> None:
    """Simple demo loop for testing the hand detector interactively."""

    cap = cv2.VideoCapture(camera_index)
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

        detector.extract_landmarks(frame)

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
