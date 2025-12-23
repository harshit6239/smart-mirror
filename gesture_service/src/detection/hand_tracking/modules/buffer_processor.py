"""Factory utilities for constructing dynamic gesture buffer processors."""

from __future__ import annotations

from typing import Any, Callable, Dict

from .landmark_buffer import LandmarkBuffer
from .buffer_processors import (
	BufferProcessor,
	DynamicGestureDetection,
	PCABufferProcessor,
	MLBufferProcessor,
)


ProcessorFactory = Callable[..., BufferProcessor]

_PROCESSOR_FACTORIES: Dict[str, ProcessorFactory] = {}


def register_buffer_processor(name: str, factory: ProcessorFactory) -> None:
	"""Register a buffer processor factory under the provided name."""

	normalized = name.strip().lower()
	if not normalized:
		raise ValueError("Processor name must not be empty")
	_PROCESSOR_FACTORIES[normalized] = factory


def create_buffer_processor(
	name: str,
	buffer: LandmarkBuffer,
	/,
	**kwargs: Any,
) -> BufferProcessor:
	"""Instantiate the requested buffer processor using the registered factory."""

	normalized = name.strip().lower()
	factory = _PROCESSOR_FACTORIES.get(normalized)
	if factory is None:
		available = ", ".join(sorted(_PROCESSOR_FACTORIES)) or "<none>"
		raise ValueError(
			f"Unknown buffer processor '{name}'. Available options: {available}"
		)
	return factory(buffer=buffer, **kwargs)


# Register built-in processors. Additional processors can be registered elsewhere.
register_buffer_processor("ml", MLBufferProcessor)
register_buffer_processor("pca", PCABufferProcessor)

__all__ = [
	"DynamicGestureDetection",
	"BufferProcessor",
	"ProcessorFactory",
	"create_buffer_processor",
	"register_buffer_processor",
]
