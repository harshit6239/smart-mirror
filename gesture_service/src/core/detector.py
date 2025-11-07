"""Gesture detection using MediaPipe."""

import time
from typing import Optional, Dict, Any
import cv2
import mediapipe as mp
import numpy as np

from ..config import GestureConfig
from ..gestures.recognizer import GestureRecognizer
from ..utils.logger import get_logger


logger = get_logger(__name__)


class GestureDetector:
    """Detects and recognizes hand gestures using MediaPipe."""

    def __init__(self, config: GestureConfig):
        """
        Initialize gesture detector.

        Args:
            config: Gesture detection configuration
        """
        self.config = config
        self.mp_hands = mp.solutions.hands
        self.mp_drawing = mp.solutions.drawing_utils
        self.mp_drawing_styles = mp.solutions.drawing_styles

        # Initialize MediaPipe Hands
        self.hands = self.mp_hands.Hands(
            static_image_mode=False,
            max_num_hands=config.max_num_hands,
            min_detection_confidence=config.min_detection_confidence,
            min_tracking_confidence=config.min_tracking_confidence,
        )

        # Gesture recognizer
        self.recognizer = GestureRecognizer()

        # Cooldown tracking
        self.last_gesture_time: Dict[str, float] = {}

    def process_frame(self, frame: np.ndarray, draw_landmarks: bool = True) -> tuple[np.ndarray, Optional[Dict[str, Any]]]:
        """
        Process a frame to detect gestures.

        Args:
            frame: Input frame (BGR format)
            draw_landmarks: Whether to draw hand landmarks on frame

        Returns:
            Tuple of (processed_frame, gesture_data)
            gesture_data is None if no gesture detected
        """
        # Convert to RGB for MediaPipe
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = self.hands.process(rgb_frame)

        gesture_data = None

        # Draw landmarks and detect gestures
        if results.multi_hand_landmarks:
            for hand_landmarks, handedness in zip(
                results.multi_hand_landmarks,
                results.multi_handedness
            ):
                # Draw landmarks if requested
                if draw_landmarks:
                    self.mp_drawing.draw_landmarks(
                        frame,
                        hand_landmarks,
                        self.mp_hands.HAND_CONNECTIONS,
                        self.mp_drawing_styles.get_default_hand_landmarks_style(),
                        self.mp_drawing_styles.get_default_hand_connections_style(),
                    )

                # Recognize gesture
                hand_label = handedness.classification[0].label  # "Left" or "Right"
                gesture_name = self.recognizer.recognize(hand_landmarks, hand_label)

                if gesture_name and self._check_cooldown(gesture_name):
                    gesture_data = {
                        "type": "gesture",
                        "name": gesture_name,
                        "hand": hand_label,
                        "timestamp": time.time(),
                    }
                    logger.info(f"Detected gesture: {gesture_name} ({hand_label} hand)")

                    # Display gesture name on frame
                    if draw_landmarks:
                        cv2.putText(
                            frame,
                            f"{hand_label}: {gesture_name}",
                            (10, 30),
                            cv2.FONT_HERSHEY_SIMPLEX,
                            1,
                            (0, 255, 0),
                            2,
                        )

        return frame, gesture_data

    def _check_cooldown(self, gesture_name: str) -> bool:
        """
        Check if enough time has passed since last detection of this gesture.

        Args:
            gesture_name: Name of the gesture

        Returns:
            True if cooldown period has passed, False otherwise
        """
        current_time = time.time()
        last_time = self.last_gesture_time.get(gesture_name, 0)

        if current_time - last_time >= self.config.gesture_cooldown:
            self.last_gesture_time[gesture_name] = current_time
            return True

        return False

    def close(self):
        """Release MediaPipe resources."""
        if self.hands:
            self.hands.close()
            logger.info("Gesture detector closed")
