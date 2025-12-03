from dataclasses import dataclass


@dataclass
class Landmark:
    """Represents an individual hand landmark in pixel coordinates."""

    id: int
    x: int
    y: int

@dataclass
class LandmarkFrame():
    landmarks: list[Landmark]
    timestamp: float
    static_gesture: tuple[str, float]  # (gesture_name, confidence)



