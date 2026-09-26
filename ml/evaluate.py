"""
evaluate.py — Standalone evaluation on held-out test data.

Loads saved artifacts and re-evaluates on the same 20% test split.
Use this to verify model performance without retraining.

Usage:
    python ml/evaluate.py
"""

import json
import os
import sys
import re

RANDOM_SEED = 42
TEST_SIZE = 0.20

ARTIFACT_DIR = os.path.join(os.path.dirname(__file__), "artifacts")
DATA_CSV = os.path.join(os.path.dirname(__file__), "data", "phishing_dataset.csv")
REPORT_DIR = os.path.join(os.path.dirname(__file__), "reports")


def clean_text(text: str) -> str:
    if not isinstance(text, str):
        return ""
    text = text.lower()
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"([!?.,-])\1+", r"\1", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def main():
    try:
        import joblib
        import numpy as np
        import pandas as pd
        import scipy.sparse as sp
        from sklearn.model_selection import train_test_split
        from sklearn.metrics import (
            accuracy_score, precision_score, recall_score,
            f1_score, roc_auc_score, confusion_matrix, classification_report,
        )
    except ImportError as e:
        print(f"[evaluate] Missing dependency: {e}. Run: pip install -r ml/requirements.txt")
        sys.exit(1)

    # Load artifacts
    model_path = os.path.join(ARTIFACT_DIR, "phishing_model.joblib")
    word_vec_path = os.path.join(ARTIFACT_DIR, "tfidf_word_vectorizer.joblib")
    char_vec_path = os.path.join(ARTIFACT_DIR, "tfidf_char_vectorizer.joblib")
    meta_path = os.path.join(ARTIFACT_DIR, "model_metadata.json")

    for p in [model_path, word_vec_path, char_vec_path]:
        if not os.path.exists(p):
            print(f"[evaluate] Artifact not found: {p}")
            print("[evaluate] Run: python ml/train.py")
            sys.exit(1)

    print("[evaluate] Loading artifacts...")
    model    = joblib.load(model_path)
    word_vec = joblib.load(word_vec_path)
    char_vec = joblib.load(char_vec_path)

    with open(meta_path) as f:
        metadata = json.load(f)
    phishing_label = metadata.get("phishingLabel", "Phishing Email")

    # Load + preprocess data (same as training)
    df = pd.read_csv(DATA_CSV)
    text_col, label_col = None, None
    for col in df.columns:
        col_lower = col.lower().strip()
        if col_lower in ("email text", "email_text", "text", "body", "message"):
            text_col = col
        if col_lower in ("email type", "email_type", "label", "class"):
            label_col = col

    df = df[[text_col, label_col]].copy()
    df.columns = ["text", "label"]
    df.dropna(inplace=True)
    df["text"] = df["text"].astype(str)
    df["label"] = df["label"].astype(str).str.strip()
    df.drop_duplicates(subset=["text"], inplace=True)
    df["y"] = (df["label"] == phishing_label).astype(int)
    df["text_clean"] = df["text"].apply(clean_text)

    X = np.array(df["text_clean"].tolist(), dtype=object)
    y = np.array(df["y"].tolist(), dtype=int)
    _, X_test_raw, _, y_test = train_test_split(
        X, y, test_size=TEST_SIZE, random_state=RANDOM_SEED, stratify=y
    )

    # Transform
    X_test_word = word_vec.transform(X_test_raw)
    X_test_char = char_vec.transform(X_test_raw)
    X_test = sp.hstack([X_test_word, X_test_char])

    # Evaluate
    y_pred = model.predict(X_test)
    y_prob = model.predict_proba(X_test)[:, 1]

    accuracy  = accuracy_score(y_test, y_pred)
    precision = precision_score(y_test, y_pred, zero_division=0)
    recall    = recall_score(y_test, y_pred, zero_division=0)
    f1        = f1_score(y_test, y_pred, zero_division=0)
    roc_auc   = roc_auc_score(y_test, y_prob)
    cm        = confusion_matrix(y_test, y_pred)
    tn, fp, fn, tp = cm.ravel()

    print("\n" + "="*50)
    print("  STANDALONE EVALUATION RESULTS")
    print("="*50)
    print(f"  Test samples:  {len(y_test):,}")
    print(f"  Accuracy:      {accuracy:.4f}")
    print(f"  Precision:     {precision:.4f}")
    print(f"  Recall:        {recall:.4f}")
    print(f"  F1-score:      {f1:.4f}")
    print(f"  ROC-AUC:       {roc_auc:.4f}")
    print(f"\n  Confusion Matrix:")
    print(f"    True  Negatives (TN): {tn}")
    print(f"    False Positives (FP): {fp}")
    print(f"    False Negatives (FN): {fn}")
    print(f"    True  Positives (TP): {tp}")
    print("="*50)
    print(classification_report(y_test, y_pred, target_names=["safe", "phishing"]))


if __name__ == "__main__":
    main()
