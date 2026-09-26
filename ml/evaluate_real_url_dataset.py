"""
evaluate_real_url_dataset.py — Full 100,000 URL Benchmark Evaluation (50,000 Legitimate + 50,000 Phishing)
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
DATA_CSV = os.path.join(os.path.dirname(__file__), "data", "url_dataset.csv")
REPORT_DIR = os.path.join(os.path.dirname(__file__), "reports")
os.makedirs(REPORT_DIR, exist_ok=True)

BRANDS = ['google', 'microsoft', 'office365', 'outlook', 'amazon', 'apple', 'paypal', 'whatsapp',
          'instagram', 'facebook', 'netflix', 'chase', 'wellsfargo', 'bankofamerica', 'hdfc', 'binance', 'github']
SHORTENERS = ['bit.ly', 'tinyurl.com', 't.co', 'is.gd', 'cutt.ly', 'duckdns.org']
SUSPICIOUS_TLDS = ['.xyz', '.top', '.club', '.info', '.win', '.online', '.site', '.click', '.gq', '.tk', '.mobi', '.ru']

def extract_url_features(url_series: pd.Series) -> np.ndarray:
    features_list = []
    for raw_url in url_series:
        url = str(raw_url).strip()
        url_lower = url.lower()
        length = len(url)
        try:
            domain = url_lower.split('/')[2] if '://' in url_lower else url_lower.split('/')[0]
        except Exception:
            domain = url_lower
            
        domain_len = len(domain)
        digit_count = sum(c.isdigit() for c in url)
        special_count = sum(url.count(c) for c in ['@', '-', '_', '?', '=', '.', '//'])
        prob = [float(url.count(c)) / length for c in set(url)]
        entropy = -sum(p * np.log2(p) for p in prob) if length > 0 else 0
        has_ip = 1 if re.search(r'^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$', domain) else 0
        subdomain_count = max(0, domain.count('.') - 1)
        is_shortener = 1 if any(s in domain for s in SHORTENERS) else 0
        has_susp_tld = 1 if any(domain.endswith(tld) for tld in SUSPICIOUS_TLDS) else 0
        brand_in_domain = 1 if any(b in domain and not domain.startswith(b) for b in BRANDS) else 0
        brand_in_path = 1 if any(b in url_lower and b not in domain for b in BRANDS) else 0
        has_cred_kw = 1 if any(kw in url_lower for kw in ['login', 'verify', 'auth', 'signin', 'account', 'pay', 'order']) else 0
        is_https = 1 if url_lower.startswith('https://') else 0
        path_len = len(url_lower) - len(domain) - (8 if is_https else 7)
        has_query = 1 if '?' in url_lower else 0
        has_double_slash = 1 if '//' in url_lower[8:] else 0
        is_punycode = 1 if 'xn--' in domain else 0
        has_port = 1 if re.search(r':\d{2,5}', domain) else 0
        
        vec = [
            length, domain_len, digit_count, special_count, entropy,
            has_ip, subdomain_count, is_shortener, has_susp_tld, brand_in_domain,
            brand_in_path, has_cred_kw, is_https, path_len, has_query,
            has_double_slash, is_punycode, has_port
        ]
        features_list.append(vec)
    return np.array(features_list, dtype=np.float32)

def main():
    print("=" * 80)
    print(" DETECTIQ URL BENCHMARK (100,000 URLs: 50,000 Legitimate + 50,000 Phishing)")
    print("=" * 80)

    if not os.path.exists(DATA_CSV):
        print(f"Error: Dataset file not found at {DATA_CSV}")
        sys.exit(1)

    df = pd.read_csv(DATA_CSV)
    url_col, label_col = df.columns[0], df.columns[1]

    df.dropna(subset=[url_col, label_col], inplace=True)
    df[url_col] = df[url_col].astype(str)
    df[label_col] = df[label_col].astype(str).str.strip()

    df.drop_duplicates(subset=[url_col], inplace=True)

    # Label '0' = Phishing, Label '1' = Legitimate
    df["y"] = (df[label_col] == '0').astype(int)

    # Sample exactly 50,000 Legitimate + 50,000 Phishing = 100,000 total URLs
    n_each = 50000
    df_phish = df[df["y"] == 1].sample(n=n_each, random_state=RANDOM_SEED)
    df_safe = df[df["y"] == 0].sample(n=n_each, random_state=RANDOM_SEED)
    df_100k = pd.concat([df_phish, df_safe]).sample(frac=1.0, random_state=RANDOM_SEED).reset_index(drop=True)

    print(f"\n[1/5] Selected Balanced Benchmark Dataset: {len(df_100k):,} total URLs ({n_each:,} Legitimate + {n_each:,} Phishing)")

    # 80/20 Stratified Train/Test Split
    X_urls = np.array(df_100k[url_col].tolist(), dtype=object)
    y_all = np.array(df_100k["y"].tolist(), dtype=int)

    X_train_urls, X_test_urls, y_train, y_test = train_test_split(
        X_urls, y_all, test_size=0.20, random_state=RANDOM_SEED, stratify=y_all
    )

    n_test = len(y_test)
    n_test_safe = (y_test == 0).sum()
    n_test_phish = (y_test == 1).sum()
    print(f"\n[2/5] Stratified 80/20 Train/Test Split:")
    print(f"      • Training Set (80%): {len(y_train):,} URLs (40,000 Legitimate + 40,000 Phishing)")
    print(f"      • Unseen Test Set (20%): {n_test:,} URLs ({n_test_safe:,} Legitimate + {n_test_phish:,} Phishing)")

    # Feature Extraction
    print(f"\n[3/5] Extracting 18 Lexical Features + TF-IDF Char n-grams (3,5) on 100,000 URLs...")
    X_train_struct = extract_url_features(pd.Series(X_train_urls))
    X_test_struct = extract_url_features(pd.Series(X_test_urls))

    char_vec = TfidfVectorizer(ngram_range=(3, 5), analyzer="char_wb", max_features=10000)
    X_train_char = char_vec.fit_transform(X_train_urls)
    X_test_char = char_vec.transform(X_test_urls)

    X_train = sp.hstack([X_train_struct, X_train_char])
    X_test = sp.hstack([X_test_struct, X_test_char])

    # Fit Model & Predict
    print(f"[4/5] Training DetectIQ URL Classifier (Logistic Regression, C=1.0)...")
    clf = LogisticRegression(C=1.0, max_iter=1000, random_state=RANDOM_SEED)
    clf.fit(X_train, y_train)

    y_pred = clf.predict(X_test)

    # Confusion Matrix & Metrics
    cm = confusion_matrix(y_test, y_pred)
    tn, fp, fn, tp = cm.ravel()

    accuracy = accuracy_score(y_test, y_pred)
    precision = precision_score(y_test, y_pred)
    recall = recall_score(y_test, y_pred)
    f1 = f1_score(y_test, y_pred)
    fpr = fp / (fp + tn)
    specificity = tn / (tn + fp)

    print("\n" + "=" * 75)
    print(f"  EMPIRICAL EVALUATION RESULTS ON 100,000 URL DATASET (N = {n_test:,} UNSEEN TEST URLs)")
    print("=" * 75)
    print(f"  • True  Negatives (TN): {tn:5d}  (Legitimate URLs correctly classified)")
    print(f"  • False Positives (FP): {fp:5d}  (Legitimate URLs incorrectly flagged as phishing)")
    print(f"  • False Negatives (FN): {fn:5d}  (Phishing URLs missed)")
    print(f"  • True  Positives (TP): {tp:5d}  (Phishing URLs correctly detected)")
    print("-" * 75)
    print(f"  • Accuracy:    {accuracy * 100:.2f}%   (({tp:,} + {tn:,}) / {n_test:,})")
    print(f"  • Precision:   {precision * 100:.2f}%   ({tp:,} / ({tp:,} + {fp:,}))")
    print(f"  • Recall:      {recall * 100:.2f}%   ({tp:,} / ({tp:,} + {fn:,}))")
    print(f"  • F1-Score:    {f1 * 100:.2f}%")
    print(f"  • FPR:         {fpr * 100:.2f}%    ({fp:,} / ({fp:,} + {tn:,}))")
    print(f"  • Specificity: {specificity * 100:.2f}%   ({tn:,} / ({tn:,} + {fp:,}))")
    print("=" * 75)

    # Plot Confusion Matrix
    print(f"\n[5/5] Generating Confusion Matrix Plot Image...")
    fig, ax = plt.subplots(figsize=(6.5, 5.5))
    sns.heatmap(
        cm,
        annot=True,
        fmt="d",
        cmap="Blues",
        xticklabels=["Legitimate", "Phishing"],
        yticklabels=["Legitimate", "Phishing"],
        annot_kws={"size": 15, "weight": "bold"},
        cbar=False,
        ax=ax
    )
    ax.set_title(f"DetectIQ URL Phishing Classifier — Confusion Matrix\n(N = {n_test:,} Unseen Test URLs)", fontsize=12, fontweight="bold", pad=12)
    ax.set_xlabel("Predicted Label", fontsize=11, fontweight="bold")
    ax.set_ylabel("Actual Label", fontsize=11, fontweight="bold")
    plt.tight_layout()

    cm_plot_path = os.path.join(REPORT_DIR, "url_100k_confusion_matrix.png")
    plt.savefig(cm_plot_path, dpi=200)
    plt.savefig(os.path.join(REPORT_DIR, "url_confusion_matrix.png"), dpi=200)
    plt.close()

    # Save JSON Report
    results = {
        "datasetFile": "url_dataset.csv",
        "totalCorpusEvaluated": 100000,
        "sampleComposition": {"legitimate": 50000, "phishing": 50000},
        "trainSamples": len(y_train),
        "testSamples": len(y_test),
        "testComposition": {"legitimate": int(n_test_safe), "phishing": int(n_test_phish)},
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

    json_path = os.path.join(REPORT_DIR, "url_100k_benchmark.json")
    with open(json_path, "w") as f:
        json.dump(results, f, indent=2)

    server_report_dir = os.path.join(os.path.dirname(__file__), "..", "server", "reports")
    os.makedirs(server_report_dir, exist_ok=True)
    with open(os.path.join(server_report_dir, "url_benchmark_results.json"), "w") as f:
        json.dump(results, f, indent=2)

    print(f"Benchmark Completed Successfully!")
    print(f"  • Plot saved to: {cm_plot_path}")
    print(f"  • Report saved to: {json_path}\n")

if __name__ == "__main__":
    main()
