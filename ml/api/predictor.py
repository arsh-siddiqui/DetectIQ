"""
predictor.py — Loads trained ML artifacts and provides prediction interface.

Artifacts are loaded ONCE at module import time. The predictor is thread-safe
because TF-IDF transform and model.predict_proba are read-only operations.
"""

import json
import os
import re
from typing import Dict, Any

import joblib
import scipy.sparse as sp

ARTIFACT_DIR = os.path.join(os.path.dirname(__file__), "..", "artifacts")


def _clean_text(text: str) -> str:
    """Mirror of train.py clean_text — must be identical."""
    if not isinstance(text, str):
        return ""
    text = text.lower()
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"([!?.,-])\1+", r"\1", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


class PhishingPredictor:
    """
    Loads the trained TF-IDF + Logistic Regression artifacts and exposes
    a single `predict(text)` method that returns label + probability.

    Raises RuntimeError at construction time if any artifact is missing,
    so the FastAPI startup health check catches it immediately.
    """

    def __init__(self):
        model_path    = os.path.join(ARTIFACT_DIR, "phishing_model.joblib")
        word_vec_path = os.path.join(ARTIFACT_DIR, "tfidf_word_vectorizer.joblib")
        char_vec_path = os.path.join(ARTIFACT_DIR, "tfidf_char_vectorizer.joblib")
        meta_path     = os.path.join(ARTIFACT_DIR, "model_metadata.json")

        for path in [model_path, word_vec_path, char_vec_path, meta_path]:
            if not os.path.exists(path):
                raise RuntimeError(
                    f"ML artifact not found: {path}. "
                    "Run 'python ml/train.py' first to generate artifacts."
                )

        self._model    = joblib.load(model_path)
        self._word_vec = joblib.load(word_vec_path)
        self._char_vec = joblib.load(char_vec_path)

        with open(meta_path) as f:
            self._metadata = json.load(f)

        self._version = self._metadata.get("version", "1.0.0")
        self._name    = self._metadata.get("modelName", "DetectIQ Phishing Text Classifier")

    def predict(self, text: str) -> Dict[str, Any]:
        """
        Predict whether the given text is phishing or safe.

        Returns:
            {
                "label": "phishing" | "safe",
                "probability": float (0.0–1.0, phishing class),
                "model": {"name": str, "version": str}
            }
        """
        cleaned = _clean_text(text)

        # Transform using both vectorizers, hstack (same as training)
        X_word = self._word_vec.transform([cleaned])
        X_char = self._char_vec.transform([cleaned])
        X = sp.hstack([X_word, X_char])

        # predict_proba returns [[prob_safe, prob_phishing]]
        proba = self._model.predict_proba(X)[0]
        phishing_prob = float(proba[1])

        label = "phishing" if phishing_prob >= 0.5 else "safe"

        return {
            "label": label,
            "probability": round(phishing_prob, 4),
            "model": {
                "name": self._name,
                "version": self._version,
            },
        }

    @property
    def metadata(self) -> Dict[str, Any]:
        return self._metadata

    @property
    def version(self) -> str:
        return self._version


# ---------------------------------------------------------------------------
# Module-level singleton — loaded once when the FastAPI app starts
# ---------------------------------------------------------------------------
_predictor_instance: PhishingPredictor | None = None
_load_error: str | None = None


def get_predictor() -> PhishingPredictor:
    global _predictor_instance, _load_error
    if _predictor_instance is None and _load_error is None:
        try:
            _predictor_instance = PhishingPredictor()
        except Exception as e:
            _load_error = str(e)
    if _predictor_instance is None:
        raise RuntimeError(f"Model not loaded: {_load_error}")
    return _predictor_instance


def is_model_loaded() -> bool:
    try:
        get_predictor()
        return True
    except Exception:
        return False


# Eagerly try to load at import time (FastAPI startup)
try:
    _predictor_instance = PhishingPredictor()
except Exception as e:
    _load_error = str(e)
