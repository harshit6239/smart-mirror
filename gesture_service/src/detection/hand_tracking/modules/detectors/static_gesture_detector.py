"""Static hand gesture detection built on pre-trained classifiers."""

from __future__ import annotations

import pathlib
from typing import Optional, Sequence, Tuple

from ...common import classes
from ..utils.model_loader import load_model_bundle


class StaticGestureDetector:
    """Encapsulates static gesture inference over a single landmark frame."""

    _DEFAULT_MODEL_DIR = (
        pathlib.Path(__file__).resolve().parent.parent.parent / "gesture_models/static_gestures/models"
    )
    _ENCODER_FILENAME = "static_gesture_label_encoder.pkl"
    _CLASSIFIER_FILENAME = "static_gesture_classifier.pkl"

    def __init__(
        self,
        *,
        confidence_threshold: float = 0.4,
        model_dir: pathlib.Path | str | None = None,
        classifier: object | None = None,
        label_encoder: object | None = None,
    ) -> None:
        self._confidence_threshold = confidence_threshold
        self._model_dir = pathlib.Path(model_dir) if model_dir else self._DEFAULT_MODEL_DIR

        if classifier is None or label_encoder is None:
            self._label_encoder, self._classifier = load_model_bundle(
                self._model_dir,
                encoder_filename=self._ENCODER_FILENAME,
                classifier_filename=self._CLASSIFIER_FILENAME,
            )
        else:
            self._label_encoder = label_encoder
            self._classifier = classifier

    @property
    def confidence_threshold(self) -> float:
        return self._confidence_threshold

    @confidence_threshold.setter
    def confidence_threshold(self, value: float) -> None:
        self._confidence_threshold = float(value)

    def predict(
        self, landmarks: Sequence[classes.Landmark]
    ) -> Optional[Tuple[str, float]]:
        """Return the static gesture prediction (label, confidence) or None."""

        if not landmarks:
            return None

        feature_vector: list[float] = []
        for landmark in sorted(landmarks, key=lambda lm: lm.id):
            feature_vector.extend((float(landmark.x), float(landmark.y)))

        prediction = self._classifier.predict([feature_vector])[0]
        probabilities = self._classifier.predict_proba([feature_vector])[0]
        confidence = float(max(probabilities))

        if confidence < self._confidence_threshold:
            return None

        label = self._label_encoder.inverse_transform([prediction])[0]
        return label, confidence


__all__ = ["StaticGestureDetector"]
