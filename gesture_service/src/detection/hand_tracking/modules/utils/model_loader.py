"""Utility helpers for loading model artifacts used by gesture detectors."""

from __future__ import annotations

from pathlib import Path
from typing import Any, Tuple

import joblib


def load_model_bundle(
    model_dir: Path | str,
    *,
    encoder_filename: str,
    classifier_filename: str,
) -> Tuple[Any, Any]:
    """Load paired label encoder and classifier artifacts from disk."""

    directory = Path(model_dir)
    encoder_path = directory / encoder_filename
    classifier_path = directory / classifier_filename

    with open(encoder_path, "rb") as encoder_file:
        label_encoder = joblib.load(encoder_file)

    with open(classifier_path, "rb") as classifier_file:
        classifier = joblib.load(classifier_file)

    return label_encoder, classifier


__all__ = ["load_model_bundle"]
