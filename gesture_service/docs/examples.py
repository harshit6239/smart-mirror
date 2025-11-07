"""
Example: How to add custom gestures to the recognizer

This file demonstrates how to extend the gesture recognition system
with your own custom gestures.
"""

from typing import Optional
import math


class CustomGestureRecognizer:
    """
    Example custom gesture recognizer.
    
    You can add this to src/gestures/recognizer.py or create a new module.
    """

    def __init__(self):
        self.finger_tips = [4, 8, 12, 16, 20]
        self.finger_pips = [2, 6, 10, 14, 18]

    def recognize_custom_gesture(self, landmarks, hand_label: str) -> Optional[str]:
        """
        Example custom gesture recognition methods.
        
        Add your custom logic here!
        """
        
        # Example 1: Detect "OK" sign (thumb and index finger touching)
        if self._is_ok_sign(landmarks):
            return "ok_sign"
        
        # Example 2: Detect "L" shape (thumb up, index out)
        if self._is_l_shape(landmarks, hand_label):
            return "l_shape"
        
        # Example 3: Detect pinch gesture (thumb and index close)
        if self._is_pinching(landmarks):
            return "pinch"
        
        # Example 4: Detect spread fingers (all fingers wide apart)
        if self._is_spread(landmarks):
            return "spread"
        
        return None

    def _is_ok_sign(self, landmarks) -> bool:
        """
        Detect OK sign (thumb tip and index tip close together).
        
        Returns:
            True if OK sign detected
        """
        thumb_tip = landmarks[4]
        index_tip = landmarks[8]
        
        # Calculate distance between thumb and index finger tips
        distance = self._calculate_distance(thumb_tip, index_tip)
        
        # If distance is very small, it's an OK sign
        return distance < 0.05

    def _is_l_shape(self, landmarks, hand_label: str) -> bool:
        """
        Detect L shape (thumb extended horizontally, index extended vertically).
        
        Returns:
            True if L shape detected
        """
        thumb_tip = landmarks[4]
        thumb_base = landmarks[2]
        index_tip = landmarks[8]
        index_base = landmarks[6]
        
        # Check if thumb is horizontal
        thumb_horizontal = abs(thumb_tip.y - thumb_base.y) < 0.1
        
        # Check if index is vertical
        index_vertical = index_tip.y < index_base.y
        
        # Check if other fingers are down
        middle_down = landmarks[12].y > landmarks[10].y
        ring_down = landmarks[16].y > landmarks[14].y
        pinky_down = landmarks[20].y > landmarks[18].y
        
        return thumb_horizontal and index_vertical and middle_down and ring_down and pinky_down

    def _is_pinching(self, landmarks) -> bool:
        """
        Detect pinching gesture (thumb and index finger close but not touching).
        
        Returns:
            True if pinching
        """
        thumb_tip = landmarks[4]
        index_tip = landmarks[8]
        
        distance = self._calculate_distance(thumb_tip, index_tip)
        
        # Pinching is when fingers are close but not touching (OK sign)
        return 0.05 < distance < 0.15

    def _is_spread(self, landmarks) -> bool:
        """
        Detect spread fingers (all fingers extended and far apart).
        
        Returns:
            True if fingers are spread
        """
        # Check if all fingers are extended
        fingers_extended = all(
            landmarks[tip].y < landmarks[pip].y
            for tip, pip in zip([8, 12, 16, 20], [6, 10, 14, 18])
        )
        
        if not fingers_extended:
            return False
        
        # Check distance between adjacent finger tips
        distances = []
        for i in range(len(self.finger_tips) - 1):
            tip1 = landmarks[self.finger_tips[i]]
            tip2 = landmarks[self.finger_tips[i + 1]]
            distances.append(self._calculate_distance(tip1, tip2))
        
        # If average distance is large, fingers are spread
        avg_distance = sum(distances) / len(distances)
        return avg_distance > 0.15

    def _calculate_distance(self, point1, point2) -> float:
        """
        Calculate Euclidean distance between two landmarks.
        
        Args:
            point1: First landmark
            point2: Second landmark
            
        Returns:
            Distance between points
        """
        return math.sqrt(
            (point1.x - point2.x) ** 2 +
            (point1.y - point2.y) ** 2 +
            (point1.z - point2.z) ** 2
        )


# ============================================================================
# HOW TO USE THESE CUSTOM GESTURES
# ============================================================================

"""
To integrate these custom gestures:

1. Copy the methods you want to src/gestures/recognizer.py

2. Add them to the GestureRecognizer.recognize() method:

    def recognize(self, hand_landmarks, hand_label: str) -> Optional[str]:
        landmarks = hand_landmarks.landmark
        
        # Try custom gestures first
        custom = self.recognize_custom_gesture(landmarks, hand_label)
        if custom:
            return custom
        
        # Then try standard gestures
        fingers_up = self._count_fingers_up(landmarks, hand_label)
        # ... rest of standard gesture detection

3. Add the helper method to calculate distance:

    def _calculate_distance(self, point1, point2) -> float:
        return math.sqrt(
            (point1.x - point2.x) ** 2 +
            (point1.y - point2.y) ** 2 +
            (point1.z - point2.z) ** 2
        )

4. Test your new gestures!
"""


# ============================================================================
# ADVANCED: GESTURE SEQUENCES
# ============================================================================

class GestureSequenceDetector:
    """
    Detect sequences of gestures (e.g., swipe left then swipe right).
    """
    
    def __init__(self, max_sequence_length: int = 5, timeout: float = 3.0):
        """
        Initialize sequence detector.
        
        Args:
            max_sequence_length: Maximum number of gestures in a sequence
            timeout: Time window for sequence detection (seconds)
        """
        self.max_sequence_length = max_sequence_length
        self.timeout = timeout
        self.gesture_history = []
        self.last_gesture_time = 0
    
    def add_gesture(self, gesture_name: str, timestamp: float) -> Optional[str]:
        """
        Add a gesture to the sequence and check for patterns.
        
        Args:
            gesture_name: Name of the detected gesture
            timestamp: Timestamp of detection
            
        Returns:
            Sequence name if pattern matched, None otherwise
        """
        import time
        
        # Clear old gestures outside timeout window
        current_time = time.time()
        self.gesture_history = [
            (g, t) for g, t in self.gesture_history
            if current_time - t < self.timeout
        ]
        
        # Add new gesture
        self.gesture_history.append((gesture_name, timestamp))
        
        # Keep only recent gestures
        if len(self.gesture_history) > self.max_sequence_length:
            self.gesture_history.pop(0)
        
        # Check for patterns
        return self._check_patterns()
    
    def _check_patterns(self) -> Optional[str]:
        """
        Check if gesture history matches any known patterns.
        
        Returns:
            Pattern name if matched
        """
        if len(self.gesture_history) < 2:
            return None
        
        recent_gestures = [g for g, _ in self.gesture_history[-3:]]
        
        # Double swipe left
        if recent_gestures[-2:] == ['swipe_left', 'swipe_left']:
            return 'double_swipe_left'
        
        # Double swipe right
        if recent_gestures[-2:] == ['swipe_right', 'swipe_right']:
            return 'double_swipe_right'
        
        # Swipe left then right (cancel)
        if recent_gestures[-2:] == ['swipe_left', 'swipe_right']:
            return 'cancel_gesture'
        
        # Peace sign then thumbs up (like)
        if recent_gestures[-2:] == ['peace', 'thumbs_up']:
            return 'super_like'
        
        # Three finger sequence (secret menu)
        if recent_gestures == ['one_finger', 'two_fingers', 'three_fingers']:
            return 'secret_menu'
        
        return None


"""
To use sequence detection:

1. Add to src/core/detector.py:

    self.sequence_detector = GestureSequenceDetector()

2. In process_frame(), after detecting a gesture:

    sequence = self.sequence_detector.add_gesture(
        gesture_name,
        time.time()
    )
    
    if sequence:
        # Broadcast sequence event
        gesture_data = {
            "type": "gesture_sequence",
            "name": sequence,
            "timestamp": time.time()
        }
"""
