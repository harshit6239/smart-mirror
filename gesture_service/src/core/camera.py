"""Camera management for video capture."""

import cv2
from typing import Optional, Tuple
import numpy as np
from ..config import CameraConfig
from ..utils.logger import get_logger


logger = get_logger(__name__)


class CameraManager:
    """Manages video capture from camera."""

    def __init__(self, config: CameraConfig):
        """
        Initialize camera manager.

        Args:
            config: Camera configuration settings
        """
        self.config = config
        self.cap: Optional[cv2.VideoCapture] = None
        self._is_running = False

    def start(self) -> bool:
        """
        Start camera capture.

        Returns:
            True if camera started successfully, False otherwise
        """
        try:
            self.cap = cv2.VideoCapture(self.config.device_id)
            self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, self.config.width)
            self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, self.config.height)
            self.cap.set(cv2.CAP_PROP_FPS, self.config.fps)

            if not self.cap.isOpened():
                logger.error(f"Failed to open camera device {self.config.device_id}")
                return False

            self._is_running = True
            logger.info(f"Camera started: {self.config.width}x{self.config.height} @ {self.config.fps}fps")
            return True

        except Exception as e:
            logger.error(f"Error starting camera: {e}")
            return False

    def read_frame(self) -> Tuple[bool, Optional[np.ndarray]]:
        """
        Read a frame from the camera.

        Returns:
            Tuple of (success, frame)
        """
        if not self.cap or not self._is_running:
            return False, None

        success, frame = self.cap.read()
        if not success:
            logger.warning("Failed to read frame from camera")
            return False, None

        # Flip frame horizontally for mirror effect
        frame = cv2.flip(frame, 1)
        return True, frame

    def stop(self):
        """Stop camera capture and release resources."""
        if self.cap:
            self.cap.release()
            self._is_running = False
            logger.info("Camera stopped")

    @property
    def is_running(self) -> bool:
        """Check if camera is running."""
        return self._is_running

    def __enter__(self):
        """Context manager entry."""
        self.start()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit."""
        self.stop()
