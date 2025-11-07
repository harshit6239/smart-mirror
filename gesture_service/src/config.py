"""Configuration settings for the gesture service."""

import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Tuple


def _get_bool_env(key: str, default: bool) -> bool:
    """Get boolean value from environment variable."""
    value = os.getenv(key)
    if value is None:
        return default
    return value.lower() in ('true', '1', 'yes', 'on')


def _get_int_env(key: str, default: int) -> int:
    """Get integer value from environment variable."""
    value = os.getenv(key)
    if value is None:
        return default
    try:
        return int(value)
    except ValueError:
        return default


def _get_float_env(key: str, default: float) -> float:
    """Get float value from environment variable."""
    value = os.getenv(key)
    if value is None:
        return default
    try:
        return float(value)
    except ValueError:
        return default


def _get_str_env(key: str, default: str) -> str:
    """Get string value from environment variable."""
    return os.getenv(key, default)


def _load_env_file():
    """Load environment variables from .env file if it exists."""
    env_path = Path(__file__).parent.parent / '.env'
    if env_path.exists():
        with open(env_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                # Skip comments and empty lines
                if not line or line.startswith('#'):
                    continue
                # Parse KEY=VALUE
                if '=' in line:
                    key, value = line.split('=', 1)
                    key = key.strip()
                    value = value.strip()
                    # Only set if not already in environment
                    if key and not os.getenv(key):
                        os.environ[key] = value


# Load .env file on module import
_load_env_file()


@dataclass
class CameraConfig:
    """Camera configuration settings."""
    device_id: int = 0
    width: int = 640
    height: int = 480
    fps: int = 30

    def __post_init__(self):
        """Override with environment variables if present."""
        self.device_id = _get_int_env('CAMERA_DEVICE_ID', self.device_id)
        self.width = _get_int_env('CAMERA_WIDTH', self.width)
        self.height = _get_int_env('CAMERA_HEIGHT', self.height)
        self.fps = _get_int_env('CAMERA_FPS', self.fps)


@dataclass
class WebSocketConfig:
    """WebSocket server configuration."""
    host: str = "0.0.0.0"
    port: int = 5001

    def __post_init__(self):
        """Override with environment variables if present."""
        self.host = _get_str_env('WEBSOCKET_HOST', self.host)
        self.port = _get_int_env('WEBSOCKET_PORT', self.port)


@dataclass
class GestureConfig:
    """Gesture detection configuration."""
    min_detection_confidence: float = 0.7
    min_tracking_confidence: float = 0.5
    max_num_hands: int = 2
    gesture_cooldown: float = 0.5  # Cooldown time in seconds to avoid duplicate detections

    def __post_init__(self):
        """Override with environment variables if present."""
        self.min_detection_confidence = _get_float_env('GESTURE_MIN_DETECTION_CONFIDENCE', self.min_detection_confidence)
        self.min_tracking_confidence = _get_float_env('GESTURE_MIN_TRACKING_CONFIDENCE', self.min_tracking_confidence)
        self.max_num_hands = _get_int_env('GESTURE_MAX_NUM_HANDS', self.max_num_hands)
        self.gesture_cooldown = _get_float_env('GESTURE_COOLDOWN', self.gesture_cooldown)


@dataclass
class AppConfig:
    """Main application configuration."""
    camera: CameraConfig = field(default_factory=CameraConfig)
    websocket: WebSocketConfig = field(default_factory=WebSocketConfig)
    gesture: GestureConfig = field(default_factory=GestureConfig)
    debug: bool = True

    def __post_init__(self):
        """Override with environment variables if present."""
        self.debug = _get_bool_env('DEBUG', self.debug)

    @classmethod
    def from_profile(cls, profile: str) -> 'AppConfig':
        """
        Load configuration from a specific profile.
        
        Args:
            profile: Configuration profile name ('windows', 'raspberry_pi', etc.)
        
        Returns:
            AppConfig instance with profile-specific settings
        """
        if profile == 'raspberry_pi':
            # Raspberry Pi optimized settings
            config = cls()
            config.camera.width = 320
            config.camera.height = 240
            config.camera.fps = 15
            config.gesture.max_num_hands = 1
            config.debug = False
            
            # Still allow .env overrides
            config.camera.__post_init__()
            config.websocket.__post_init__()
            config.gesture.__post_init__()
            config.__post_init__()
            
            return config
        
        # Default profile
        return cls()


# Global configuration instance
# Can be overridden by setting CONFIG_PROFILE environment variable
_profile = os.getenv('CONFIG_PROFILE', 'default')
config = AppConfig.from_profile(_profile)
