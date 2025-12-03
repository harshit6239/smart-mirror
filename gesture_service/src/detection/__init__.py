"""High-level detection utilities."""

from importlib import import_module
from typing import TYPE_CHECKING

__all__ = ["HandDetector", "Landmark", "run_demo"]


def __getattr__(name: str):
	"""Lazily expose detector symbols to avoid re-import warnings."""

	if name in __all__:
		module = import_module(".hand_tracking.detector", __name__)
		return getattr(module, name)
	raise AttributeError(f"module '{__name__}' has no attribute '{name}'")


if TYPE_CHECKING:
	from .hand_tracking.common.classes import Landmark
	from .hand_tracking.modules.hand_detector import HandDetector, run_demo
