"""Shared logging helpers for the gesture service ecosystem."""

from __future__ import annotations

import logging
from typing import Optional

_DEFAULT_FORMAT = "%(asctime)s %(levelname)s [%(name)s] %(message)s"


def setup_logging(level: Optional[str] = None) -> None:
    """Configure root logging once with a consistent format."""

    root_logger = logging.getLogger()
    if root_logger.handlers:
        if level:
            root_logger.setLevel(level.upper())
        return

    logging.basicConfig(level=(level or "INFO").upper(), format=_DEFAULT_FORMAT)


def get_logger(name: str) -> logging.Logger:
    """Return a module-scoped logger."""

    return logging.getLogger(name)
