"""
evaluate_message_benchmark.py — DetectIQ SMS/Smishing Message Benchmark Evaluation

Evaluates DetectIQ Message Classifier on the SMS Spam Collection dataset:
- Total raw messages: 5,572 (4,825 Legitimate / Ham, 747 Smishing / Spam)
- Deduplicated: 5,169 unique messages (4,516 Legitimate, 653 Smishing)
- Stratified 80/20 Train/Test Split (4,135 Train / 1,034 Unseen Test Messages)
- Features: TF-IDF Word (1,2) + TF-IDF Char (3,5) n-grams
- Classifier: Logistic Regression (balanced class weights, C=1.0)
- Outputs exact integer counts (TP, TN, FP, FN), derived metrics, confusion matrix plot & report
"""

import os
import sys
import json
import re
import numpy as np
import pandas as pd
import scipy.sparse as sp
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import seaborn as sns

from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, confusion_matrix

RANDOM_SEED = 42
TEST_SIZE = 0.20

DATA_CSV = os.path.join(os.path.dirname(__file__), "data", "message_dataset.csv")
REPORT_DIR = os.path.join(os.path.dirname(__file__), "reports")
os.makedirs(REPORT_DIR, exist_ok=True)

def clean_text(text: str) -> str:
    if not isinstance(text, str):
        return ""
    text = text.lower()
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"([!?.,-])\1+", r"\1", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()

def main():
    print("=" * 80)
    print(" DETECTIQ SMS / MESSAGE PHISHING BENCHMARK EVALUATION")
    print(f" Dataset File: {DATA_CSV}")
    print("=" * 80)

    if not os.path.exists(DATA_CSV):
        print(f"Error: Dataset not found at {DATA_CSV}")
        sys.exit(1)

    # Load CSV with encoding fallback
    try:
        df = pd.read_csv(DATA_CSV, encoding="utf-8")
    except UnicodeDecodeError:
        df = pd.read_csv(DATA_CSV, encoding="latin-1")

    print(f"\n[1/5] Raw Dataset Loaded: {len(df):,} messages | Columns: {list(df.columns)}")

    # Detect text and label columns (v1=label, v2=text in SMS Spam collection)
    label_col, text_col = None, None
    for col in df.columns:
        cl = col.lower().strip()
        if cl in ("v1", "label", "class", "type"):
            label_col = col
        if cl in ("v2", "text", "message", "body", "sms"):
            text_col = col

    if not label_col or not text_col:
        label_col, text_col = df.columns[0], df.columns[1]

    print(f"      • Text Column: '{text_col}' | Label Column: '{label_col}'")

    df = df[[text_col, label_col]].copy()
    df.columns = ["text", "label"]
    df.dropna(inplace=True)
    df["text"] = df["text"].astype(str)
    df["label"] = df["label"].astype(str).str.strip().str.lower()

    # Deduplicate
    before_dedup = len(df)
    df.drop_duplicates(subset=["text"], inplace=True)
    print(f"      • Cleaned & Deduplicated: {before_dedup:,} -> {len(df):,} unique messages")

    # Map labels: ham = 0 (Legitimate), spam = 1 (Smishing / Phishing)
    df["y"] = df["label"].apply(lambda x: 1 if "spam" in x or "phish" in x or x == "1" else 0)
    
    n_ham = (df["y"] == 0).sum()
    n_spam = (df["y"] == 1).sum()
    print(f"      • Class Distribution: Legitimate / Safe (0) = {n_ham:,} | Smishing / Phishing (1) = {n_spam:,}")

    # Text Preprocessing
    df["text_clean"] = df["text"].apply(clean_text)

    # Stratified 80/20 Train/Test Split
    X_texts = np.array(df["text_clean"].tolist(), dtype=object)
    y_all = np.array(df["y"].tolist(), dtype=int)

    X_train_raw, X_test_raw, y_train, y_test = train_test_split(
        X_texts, y_all, test_size=TEST_SIZE, random_state=RANDOM_SEED, stratify=y_all
    )

    n_test = len(y_test)
    n_test_safe = (y_test == 0).sum()
    n_test_phish = (y_test == 1).sum()
    print(f"\n[2/5] Stratified 80/20 Split:")
    print(f"      • Training Set (80%): {len(y_train):,} messages ({(y_train==0).sum():,} Safe + {(y_train==1).sum():,} Smishing)")
    print(f"      • Unseen Test Set (20%): {n_test:,} messages ({n_test_safe:,} Safe + {n_test_phish:,} Smishing)")

    # TF-IDF Feature Extraction
    print(f"\n[3/5] Extracting TF-IDF Word (1,2) + Char (3,5) n-gram features...")
    word_vec = TfidfVectorizer(ngram_range=(1, 2), max_features=10000, sublinear_tf=True, strip_accents="unicode")
    char_vec = TfidfVectorizer(ngram_range=(3, 5), max_features=5000, analyzer="char_wb", sublinear_tf=True, strip_accents="unicode")

    X_train_word = word_vec.fit_transform(X_train_raw)
    X_test_word = word_vec.transform(X_test_raw)

    X_train_char = char_vec.fit_transform(X_train_raw)
    X_test_char = char_vec.transform(X_test_raw)

    X_train = sp.hstack([X_train_word, X_train_char])
    X_test = sp.hstack([X_test_word, X_test_char])

    # Model Training
    print(f"[4/5] Training DetectIQ Message Classifier (Logistic Regression, C=1.0)...")
    clf = LogisticRegression(C=1.0, class_weight="balanced", max_iter=1000, random_state=RANDOM_SEED)
    clf.fit(X_train, y_train)

    y_pred = clf.predict(X_test)

    # Calculate exact confusion matrix & metrics
    cm = confusion_matrix(y_test, y_pred)
    tn, fp, fn, tp = cm.ravel()

    accuracy = accuracy_score(y_test, y_pred)
    precision = precision_score(y_test, y_pred)
    recall = recall_score(y_test, y_pred)
    f1 = f1_score(y_test, y_pred)
    fpr = fp / (fp + tn)
    specificity = tn / (tn + fp)

    print("\n" + "=" * 75)
    print(f"  EMPIRICAL MESSAGE EVALUATION RESULTS (N = {n_test:,} UNSEEN TEST MESSAGES)")
    print("=" * 75)
    print(f"  • True  Negatives (TN): {tn:4d}  (Legitimate messages correctly classified)")
    print(f"  • False Positives (FP): {fp:4d}  (Legitimate messages incorrectly flagged as smishing)")
    print(f"  • False Negatives (FN): {fn:4d}  (Smishing messages missed)")
    print(f"  • True  Positives (TP): {tp:4d}  (Smishing messages correctly detected)")
    print("-" * 75)
    print(f"  • Accuracy:    {accuracy * 100:.2f}%   (({tp} + {tn}) / {n_test})")
    print(f"  • Precision:   {precision * 100:.2f}%   ({tp} / ({tp} + {fp}))")
    print(f"  • Recall:      {recall * 100:.2f}%   ({tp} / ({tp} + {fn}))")
    print(f"  • F1-Score:    {f1 * 100:.2f}%")
    print(f"  • FPR:         {fpr * 100:.2f}%    ({fp} / ({fp} + {tn}))")
    print(f"  • Specificity: {specificity * 100:.2f}%   ({tn} / ({tn} + {fp}))")
    print("=" * 75)

    # Plot Confusion Matrix
    print(f"\n[5/5] Generating Message Confusion Matrix Plot Image...")
    fig, ax = plt.subplots(figsize=(6, 5))
    sns.heatmap(
        cm,
        annot=True,
        fmt="d",
        cmap="Blues",
        xticklabels=["Safe Message", "Smishing"],
        yticklabels=["Safe Message", "Smishing"],
        annot_kws={"size": 16, "weight": "bold"},
        cbar=False,
        ax=ax
    )
    ax.set_title(f"DetectIQ Message Classifier — Confusion Matrix\n(N = {n_test:,} Unseen Test Messages)", fontsize=12, fontweight="bold", pad=12)
    ax.set_xlabel("Predicted Label", fontsize=11, fontweight="bold")
    ax.set_ylabel("Actual Label", fontsize=11, fontweight="bold")
    plt.tight_layout()

    cm_plot_path = os.path.join(REPORT_DIR, "message_confusion_matrix.png")
    plt.savefig(cm_plot_path, dpi=200)
    plt.close()

    # Save JSON Report
    results = {
        "datasetFile": "message_dataset.csv",
        "totalRawRows": before_dedup,
        "deduplicatedRows": len(df),
        "classDistribution": {"legitimate": int(n_ham), "smishing": int(n_spam)},
        "trainSamples": len(y_train),
        "testSamples": len(y_test),
        "testComposition": {"legitimate": int(n_test_safe), "smishing": int(n_test_phish)},
        "rawCounts": {"TP": int(tp), "TN": int(tn), "FP": int(fp), "FN": int(fn)},
        "metrics": {
            "accuracy": round(float(accuracy), 4),
            "precision": round(float(precision), 4),
            "recall": round(float(recall), 4),
            "f1": round(float(f1), 4),
            "fpr": round(float(fpr), 4),
            "specificity": round(float(specificity), 4)
        }
    }

    json_path = os.path.join(REPORT_DIR, "message_benchmark_results.json")
    with open(json_path, "w") as f:
        json.dump(results, f, indent=2)

    server_report_dir = os.path.join(os.path.dirname(__file__), "..", "server", "reports")
    os.makedirs(server_report_dir, exist_ok=True)
    with open(os.path.join(server_report_dir, "message_benchmark_results.json"), "w") as f:
        json.dump(results, f, indent=2)

    print(f"Benchmark Completed Successfully!")
    print(f"  • Plot saved to: {cm_plot_path}")
    print(f"  • Report saved to: {json_path}\n")

if __name__ == "__main__":
    main()
