"""
train.py — Train the DetectIQ Phishing Text Classifier.

Model: TF-IDF Vectorizer + Logistic Regression
Dataset: zefang-liu/phishing-email-dataset (Hugging Face, LGPL-3.0)
Split: 80% train / 20% test, stratified, random_seed=42

Usage:
    # Step 1: download dataset (once)
    python ml/download_dataset.py

    # Step 2: train
    python ml/train.py

Outputs:
    ml/artifacts/tfidf_vectorizer.joblib
    ml/artifacts/phishing_model.joblib
    ml/artifacts/model_metadata.json
    ml/reports/evaluation.json
    ml/reports/confusion_matrix.png
"""

import json
import os
import sys
import re
from datetime import datetime, timezone

# ---------------------------------------------------------------------------
# Configuration — edit here to tune
# ---------------------------------------------------------------------------
RANDOM_SEED = 42
TEST_SIZE = 0.20
MAX_FEATURES_WORD = 30000   # word ngram features
MAX_FEATURES_CHAR = 20000   # char ngram features
LR_C = 1.0                  # Logistic Regression regularisation strength
LR_MAX_ITER = 1000

DATA_CSV = os.path.join(os.path.dirname(__file__), "data", "phishing_dataset.csv")
ARTIFACT_DIR = os.path.join(os.path.dirname(__file__), "artifacts")
REPORT_DIR = os.path.join(os.path.dirname(__file__), "reports")

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def clean_text(text: str) -> str:
    """
    Normalise text for TF-IDF while preserving phishing-relevant signals.

    What we do:
      - Lowercase
      - Collapse excessive whitespace (but keep single spaces)
      - Remove HTML tags (common in email bodies)
      - Collapse repeated punctuation  e.g. '!!!' → '!'
      - Strip leading/trailing whitespace

    What we deliberately keep:
      - URLs and domains (strong phishing signals)
      - Numbers (amount, OTP, phone, date)
      - Urgent wording (act now, immediately, verify)
      - Account / credential terminology
    """
    if not isinstance(text, str):
        return ""
    text = text.lower()
    # Strip HTML tags
    text = re.sub(r"<[^>]+>", " ", text)
    # Collapse repeated punctuation  e.g. !!!! → !
    text = re.sub(r"([!?.,-])\1+", r"\1", text)
    # Collapse runs of whitespace
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def build_features(train_texts, test_texts):
    """
    Fit a combined word + character n-gram TF-IDF on training data only,
    then transform both train and test sets.

    Using a FeatureUnion of:
      - word ngram TF-IDF  (1,2) — captures unigrams and bigrams
      - char ngram TF-IDF  (3,5) — captures character-level patterns
                                   useful for obfuscated text like "v3rify"
    """
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.pipeline import FeatureUnion
    import scipy.sparse as sp

    print("[train] Fitting TF-IDF word ngram vectorizer (1,2)...")
    word_vec = TfidfVectorizer(
        ngram_range=(1, 2),
        max_features=MAX_FEATURES_WORD,
        sublinear_tf=True,
        strip_accents="unicode",
        analyzer="word",
        token_pattern=r"(?u)\b\w\w+\b",
        min_df=2,
    )

    print("[train] Fitting TF-IDF char ngram vectorizer (3,5)...")
    char_vec = TfidfVectorizer(
        ngram_range=(3, 5),
        max_features=MAX_FEATURES_CHAR,
        sublinear_tf=True,
        strip_accents="unicode",
        analyzer="char_wb",
        min_df=3,
    )

    X_train_word = word_vec.fit_transform(train_texts)
    X_test_word  = word_vec.transform(test_texts)

    X_train_char = char_vec.fit_transform(train_texts)
    X_test_char  = char_vec.transform(test_texts)

    X_train = sp.hstack([X_train_word, X_train_char])
    X_test  = sp.hstack([X_test_word,  X_test_char])

    return X_train, X_test, word_vec, char_vec


# ---------------------------------------------------------------------------
# Main training routine
# ---------------------------------------------------------------------------

def main():
    import pandas as pd
    import numpy as np
    import joblib
    import matplotlib
    matplotlib.use("Agg")  # headless rendering
    import matplotlib.pyplot as plt
    from sklearn.linear_model import LogisticRegression
    from sklearn.model_selection import train_test_split
    from sklearn.metrics import (
        accuracy_score,
        precision_score,
        recall_score,
        f1_score,
        roc_auc_score,
        confusion_matrix,
        classification_report,
    )

    os.makedirs(ARTIFACT_DIR, exist_ok=True)
    os.makedirs(REPORT_DIR, exist_ok=True)

    # -----------------------------------------------------------------------
    # 1. Load dataset
    # -----------------------------------------------------------------------
    if not os.path.exists(DATA_CSV):
        print(f"[train] Dataset not found at {DATA_CSV}.")
        print("[train] Run: python ml/download_dataset.py")
        sys.exit(1)

    print(f"[train] Loading dataset from {DATA_CSV} ...")
    df = pd.read_csv(DATA_CSV)
    print(f"[train] Raw rows: {len(df):,} | columns: {list(df.columns)}")

    # -----------------------------------------------------------------------
    # 2. Identify text + label columns
    # -----------------------------------------------------------------------
    text_col = None
    label_col = None
    for col in df.columns:
        col_lower = col.lower().strip()
        if col_lower in ("email text", "email_text", "text", "body", "message"):
            text_col = col
        if col_lower in ("email type", "email_type", "label", "class"):
            label_col = col

    # Fallback heuristics
    if text_col is None:
        str_cols = [c for c in df.columns if df[c].dtype == object]
        if str_cols:
            text_col = max(str_cols, key=lambda c: df[c].str.len().mean())
    if label_col is None:
        for col in df.columns:
            if df[col].nunique() <= 5 and col != text_col:
                label_col = col
                break

    if text_col is None or label_col is None:
        print(f"[train] ERROR: Could not detect text/label columns. Columns: {list(df.columns)}")
        sys.exit(1)

    print(f"[train] Text column: '{text_col}' | Label column: '{label_col}'")

    # -----------------------------------------------------------------------
    # 3. Clean + deduplicate
    # -----------------------------------------------------------------------
    df = df[[text_col, label_col]].copy()
    df.columns = ["text", "label"]
    df.dropna(inplace=True)
    df["text"] = df["text"].astype(str)
    df["label"] = df["label"].astype(str).str.strip()

    before_dedup = len(df)
    df.drop_duplicates(subset=["text"], inplace=True)
    print(f"[train] Deduplicated: {before_dedup:,} -> {len(df):,} rows "
          f"(removed {before_dedup - len(df):,} duplicates)")

    # -----------------------------------------------------------------------
    # 4. Encode labels (binary: phishing=1, safe=0)
    # -----------------------------------------------------------------------
    label_values = df["label"].unique()
    print(f"[train] Label values: {label_values}")

    # Detect phishing label — common patterns
    phishing_labels = [v for v in label_values
                       if "phish" in v.lower() or v.lower() in ("1", "spam", "malicious")]
    if not phishing_labels:
        # If no obvious phishing label, use the minority class
        counts = df["label"].value_counts()
        phishing_labels = [counts.index[-1]]  # minority class

    phishing_label = phishing_labels[0]
    print(f"[train] Phishing label mapped to 1: '{phishing_label}'")

    df["y"] = (df["label"] == phishing_label).astype(int)
    print(f"[train] Class distribution:\n{df['y'].value_counts().rename({0:'safe', 1:'phishing'})}")

    # -----------------------------------------------------------------------
    # 5. Preprocess text
    # -----------------------------------------------------------------------
    print("[train] Preprocessing text...")
    df["text_clean"] = df["text"].apply(clean_text)

    # -----------------------------------------------------------------------
    # 6. Train/test split
    # -----------------------------------------------------------------------
    X = df["text_clean"].values
    y = df["y"].values

    X_train_raw, X_test_raw, y_train, y_test = train_test_split(
        X, y,
        test_size=TEST_SIZE,
        random_state=RANDOM_SEED,
        stratify=y,
    )
    print(f"[train] Train: {len(X_train_raw):,} | Test: {len(X_test_raw):,}")

    # -----------------------------------------------------------------------
    # 7. TF-IDF feature extraction
    # -----------------------------------------------------------------------
    X_train, X_test, word_vec, char_vec = build_features(X_train_raw, X_test_raw)
    print(f"[train] Feature matrix shape: train={X_train.shape} | test={X_test.shape}")

    # Save vectorizers
    word_vec_path = os.path.join(ARTIFACT_DIR, "tfidf_word_vectorizer.joblib")
    char_vec_path = os.path.join(ARTIFACT_DIR, "tfidf_char_vectorizer.joblib")
    joblib.dump(word_vec, word_vec_path)
    joblib.dump(char_vec, char_vec_path)
    print(f"[train] Saved vectorizers to {ARTIFACT_DIR}/")

    # -----------------------------------------------------------------------
    # 8. Train Logistic Regression
    # -----------------------------------------------------------------------
    print(f"[train] Training LogisticRegression(C={LR_C}, class_weight='balanced', max_iter={LR_MAX_ITER})...")
    model = LogisticRegression(
        C=LR_C,
        class_weight="balanced",
        max_iter=LR_MAX_ITER,
        random_state=RANDOM_SEED,
        solver="lbfgs",
        n_jobs=-1,
    )
    model.fit(X_train, y_train)
    print("[train] Training complete.")

    # Save model
    model_path = os.path.join(ARTIFACT_DIR, "phishing_model.joblib")
    joblib.dump(model, model_path)
    print(f"[train] Saved model to {model_path}")

    # -----------------------------------------------------------------------
    # 9. Evaluate on held-out test set
    # -----------------------------------------------------------------------
    print("[train] Evaluating on test set...")
    y_pred = model.predict(X_test)
    y_prob = model.predict_proba(X_test)[:, 1]  # probability of phishing class

    accuracy  = accuracy_score(y_test, y_pred)
    precision = precision_score(y_test, y_pred, zero_division=0)
    recall    = recall_score(y_test, y_pred, zero_division=0)
    f1        = f1_score(y_test, y_pred, zero_division=0)
    roc_auc   = roc_auc_score(y_test, y_prob)
    cm        = confusion_matrix(y_test, y_pred)

    tn, fp, fn, tp = cm.ravel()

    print("\n" + "="*50)
    print("  EVALUATION RESULTS")
    print("="*50)
    print(f"  Accuracy:  {accuracy:.4f}")
    print(f"  Precision: {precision:.4f}")
    print(f"  Recall:    {recall:.4f}")
    print(f"  F1-score:  {f1:.4f}")
    print(f"  ROC-AUC:   {roc_auc:.4f}")
    print(f"\n  Confusion Matrix:")
    print(f"    True  Negatives (TN): {tn}")
    print(f"    False Positives (FP): {fp}")
    print(f"    False Negatives (FN): {fn}")
    print(f"    True  Positives (TP): {tp}")
    print("="*50)
    print(classification_report(y_test, y_pred, target_names=["safe", "phishing"]))

    # -----------------------------------------------------------------------
    # 10. Save evaluation report
    # -----------------------------------------------------------------------
    trained_at = datetime.now(timezone.utc).isoformat()

    evaluation = {
        "trainedAt": trained_at,
        "trainSamples": int(len(X_train_raw)),
        "testSamples": int(len(X_test_raw)),
        "randomSeed": RANDOM_SEED,
        "testSize": TEST_SIZE,
        "accuracy":  round(float(accuracy),  4),
        "precision": round(float(precision), 4),
        "recall":    round(float(recall),    4),
        "f1":        round(float(f1),        4),
        "rocAuc":    round(float(roc_auc),   4),
        "confusionMatrix": {
            "trueNegatives":  int(tn),
            "falsePositives": int(fp),
            "falseNegatives": int(fn),
            "truePositives":  int(tp),
        },
        "phishingLabel": phishing_label,
    }

    eval_path = os.path.join(REPORT_DIR, "evaluation.json")
    with open(eval_path, "w") as f:
        json.dump(evaluation, f, indent=2)
    print(f"[train] Evaluation report saved to {eval_path}")

    # -----------------------------------------------------------------------
    # 11. Plot confusion matrix
    # -----------------------------------------------------------------------
    import seaborn as sns
    fig, ax = plt.subplots(figsize=(6, 5))
    sns.heatmap(
        cm,
        annot=True,
        fmt="d",
        cmap="Blues",
        xticklabels=["Safe", "Phishing"],
        yticklabels=["Safe", "Phishing"],
        ax=ax,
    )
    ax.set_xlabel("Predicted")
    ax.set_ylabel("Actual")
    ax.set_title("DetectIQ Phishing Classifier — Confusion Matrix")
    plt.tight_layout()
    cm_path = os.path.join(REPORT_DIR, "confusion_matrix.png")
    plt.savefig(cm_path, dpi=150)
    plt.close()
    print(f"[train] Confusion matrix plot saved to {cm_path}")

    # -----------------------------------------------------------------------
    # 12. Save model metadata
    # -----------------------------------------------------------------------
    metadata = {
        "modelName": "DetectIQ Phishing Text Classifier",
        "version": "1.0.0",
        "algorithm": "TF-IDF (word 1-2gram + char 3-5gram) + Logistic Regression",
        "dataset": "zefang-liu/phishing-email-dataset",
        "datasetLicense": "LGPL-3.0",
        "trainedAt": trained_at,
        "randomSeed": RANDOM_SEED,
        "trainSamples": int(len(X_train_raw)),
        "testSamples": int(len(X_test_raw)),
        "tfidfWordNgramRange": [1, 2],
        "tfidfCharNgramRange": [3, 5],
        "tfidfMaxFeaturesWord": MAX_FEATURES_WORD,
        "tfidfMaxFeaturesChar": MAX_FEATURES_CHAR,
        "lrC": LR_C,
        "lrMaxIter": LR_MAX_ITER,
        "lrClassWeight": "balanced",
        "accuracy":  round(float(accuracy),  4),
        "precision": round(float(precision), 4),
        "recall":    round(float(recall),    4),
        "f1":        round(float(f1),        4),
        "rocAuc":    round(float(roc_auc),   4),
        "artifacts": {
            "model": "artifacts/phishing_model.joblib",
            "wordVectorizer": "artifacts/tfidf_word_vectorizer.joblib",
            "charVectorizer": "artifacts/tfidf_char_vectorizer.joblib",
        },
    }

    meta_path = os.path.join(ARTIFACT_DIR, "model_metadata.json")
    with open(meta_path, "w") as f:
        json.dump(metadata, f, indent=2)
    print(f"[train] Model metadata saved to {meta_path}")
    print("\n[train] All done. Run the FastAPI service with:")
    print("  python -m uvicorn ml.api.main:app --port 8001\n")


if __name__ == "__main__":
    main()
