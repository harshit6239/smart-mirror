"""Logging configuration and utilities."""

import logging
import sys
from typing import Optional


def setup_logging(level: int = logging.INFO, format_string: Optional[str] = None):
    """
    Setup logging configuration.

    Args:
        level: Logging level
        format_string: Custom format string
    """
    if format_string is None:
        format_string = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"

    logging.basicConfig(
        level=level,
        format=format_string,
        handlers=[
            logging.StreamHandler(sys.stdout)
        ]
    )


def get_logger(name: str) -> logging.Logger:
    """
    Get a logger instance.

    Args:
        name: Logger name (typically __name__)

    Returns:
        Logger instance
    """
    return logging.getLogger(name)
