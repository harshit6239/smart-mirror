"""Gesture recognition logic."""

from typing import Optional
import math


class GestureRecognizer:
    """Recognizes hand gestures from MediaPipe landmarks."""

    def __init__(self):
        """Initialize gesture recognizer."""
        # Finger tip and base landmark indices
        self.finger_tips = [4, 8, 12, 16, 20]  # Thumb, Index, Middle, Ring, Pinky
        self.finger_pips = [2, 6, 10, 14, 18]  # Second joints

    def recognize(self, hand_landmarks, hand_label: str) -> Optional[str]:
        """
        Recognize gesture from hand landmarks.

        Args:
            hand_landmarks: MediaPipe hand landmarks
            hand_label: "Left" or "Right"

        Returns:
            Gesture name or None if no gesture recognized
        """
        landmarks = hand_landmarks.landmark

        # Count extended fingers
        fingers_up = self._count_fingers_up(landmarks, hand_label)

        # Recognize gestures based on finger patterns
        if fingers_up == [0, 0, 0, 0, 0]:
            return "fist"
        elif fingers_up == [1, 1, 1, 1, 1]:
            return "open_palm"
        elif fingers_up == [0, 1, 0, 0, 0]:
            return "point"
        elif fingers_up == [1, 0, 0, 0, 1]:
            return "rock"
        elif fingers_up == [1, 1, 0, 0, 0]:
            return "peace"
        elif fingers_up == [0, 1, 1, 0, 0]:
            return "two_fingers"
        elif fingers_up == [0, 1, 1, 1, 0]:
            return "three_fingers"
        elif fingers_up == [0, 1, 1, 1, 1]:
            return "four_fingers"
        elif fingers_up == [1, 0, 0, 0, 0]:
            return "thumbs_up"

        # Check for swipe gestures
        swipe = self._detect_swipe(landmarks)
        if swipe:
            return swipe

        return None

    def _count_fingers_up(self, landmarks, hand_label: str) -> list[int]:
        """
        Count which fingers are extended.

        Args:
            landmarks: Hand landmarks
            hand_label: "Left" or "Right"

        Returns:
            List of binary values [thumb, index, middle, ring, pinky]
            1 = extended, 0 = not extended
        """
        fingers_up = []

        # Thumb (special case - check horizontal position)
        if hand_label == "Right":
            # Right hand: thumb is up if tip is to the right of IP joint
            if landmarks[self.finger_tips[0]].x > landmarks[self.finger_pips[0]].x:
                fingers_up.append(1)
            else:
                fingers_up.append(0)
        else:
            # Left hand: thumb is up if tip is to the left of IP joint
            if landmarks[self.finger_tips[0]].x < landmarks[self.finger_pips[0]].x:
                fingers_up.append(1)
            else:
                fingers_up.append(0)

        # Other fingers (check if tip is above PIP joint)
        for i in range(1, 5):
            if landmarks[self.finger_tips[i]].y < landmarks[self.finger_pips[i]].y:
                fingers_up.append(1)
            else:
                fingers_up.append(0)

        return fingers_up

    def _detect_swipe(self, landmarks) -> Optional[str]:
        """
        Detect swipe gestures based on hand position.

        Args:
            landmarks: Hand landmarks

        Returns:
            Swipe direction or None
        """
        # Get wrist and middle finger tip positions
        wrist = landmarks[0]
        index_tip = landmarks[8]

        # Calculate angle and distance
        dx = index_tip.x - wrist.x
        dy = index_tip.y - wrist.y
        angle = math.degrees(math.atan2(dy, dx))

        # Detect horizontal swipes (hand tilted significantly)
        if abs(angle) < 30:  # Pointing right
            return "swipe_right"
        elif abs(angle) > 150:  # Pointing left
            return "swipe_left"
        elif angle < -60 and angle > -120:  # Pointing up
            return "swipe_up"
        elif angle > 60 and angle < 120:  # Pointing down
            return "swipe_down"

        return None
