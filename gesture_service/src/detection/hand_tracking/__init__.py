"""Hand tracking package exports."""

from importlib import import_module
from typing import TYPE_CHECKING

__all__ = ["HandDetector", "run_demo", "LandmarkBuffer"]


def __getattr__(name: str):
	"""Lazy loader to keep module import side-effect free."""

	if name in __all__:
		module = import_module(".detector", __name__)
		return getattr(module, name)
	raise AttributeError(f"module '{__name__}' has no attribute '{name}'")


if TYPE_CHECKING:
	from .modules.hand_detector import HandDetector, run_demo
	from .modules.landmark_buffer import LandmarkBuffer