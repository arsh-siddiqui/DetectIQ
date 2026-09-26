# DetectIQ ML & RAG Pipeline

## Overview

This directory contains the machine learning and Retrieval-Augmented Generation (RAG) components of DetectIQ's multi-layer phishing detection system.

**Models**: 
- **Text Classifier**: TF-IDF Vectorizer (word n-gram 1-2 + char n-gram 3-5) + Logistic Regression
- **Personalized RAG Index**: FastEmbed (`sentence-transformers/all-MiniLM-L6-v2`, 384 dimensions) + FAISS (`IndexFlatIP`)
- **Reasoning Engine**: Groq LLM (`openai/gpt-oss-120b`)

**Datasets**: 
- **Email**: [zefang-liu/phishing-email-dataset](https://huggingface.co/datasets/zefang-liu/phishing-email-dataset) ($17,537$ deduplicated emails)
- **URL**: Phishing & Legitimate Websites Dataset ($100,000$ URLs from Tranco & PhishTank)
- **SMS / Message**: SMS Spam Collection Dataset ($5,572$ messages)

---

## Directory Structure

```
ml/
├── README.md                          # This file
├── requirements.txt                   # Python dependencies
├── download_dataset.py                # Download email dataset from Hugging Face
├── train.py                           # Training script for email classifier
├── evaluate.py                        # Standalone email ML evaluation script
├── evaluate_rag_vs_norag.py           # RAG A/B evaluation benchmark script (500 corpus)
├── evaluate_real_url_dataset.py       # Empirical 100,000 URL dataset evaluation script
├── evaluate_message_benchmark.py      # Empirical SMS smishing evaluation script
│
├── api/
│   ├── __init__.py
│   ├── main.py                        # FastAPI inference service
│   ├── rag.py                         # FastEmbed + FAISS vector memory RAG service
│   ├── schemas.py                     # Pydantic request/response schemas
│   └── predictor.py                   # Model loading + prediction
│
├── artifacts/                         # Trained model artifacts (.joblib)
│   ├── phishing_model.joblib
│   ├── tfidf_word_vectorizer.joblib
│   ├── tfidf_char_vectorizer.joblib
│   └── model_metadata.json
│
├── reports/                           # Generated evaluation reports & figures
│   ├── detectiq_paper_benchmark_raw.json
│   ├── rag_vs_norag_comparison_plot.png
│   ├── message_benchmark_results.json
│   ├── message_confusion_matrix.png
│   ├── url_100k_benchmark.json
│   ├── url_100k_confusion_matrix.png
│   └── confusion_matrix.png
│
└── data/                              # Datasets directory (CSV files)
    ├── phishing_dataset.csv
    ├── url_dataset.csv
    └── message_dataset.csv
```

---

## Empirical Benchmark Performance

| Channel / Configuration | Dataset Size | Test Set ($N$) | Accuracy | Precision | Recall | F1-Score | FPR | Specificity |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Email (Without RAG)** | 500 Email Corpus | 200 | 95.00% | 91.67% | 99.00% | 95.19% | 9.00% | 91.00% |
| **Email (With RAG — DetectIQ)** | 500 Email Corpus | 200 | **99.00%** | **99.00%** | **99.00%** | **99.00%** | **1.00%** | **99.00%** |
| **Email Standalone ML** | 17,537 Emails | 3,508 | **98.80%** | **97.82%** | **99.01%** | **98.41%** | **1.32%** | **98.68%** |
| **URL Phishing Engine** | 100,000 URLs | 20,000 | **99.60%** | **99.96%** | **99.24%** | **99.60%** | **0.04%** | **99.96%** |
| **SMS Smishing Engine** | 5,572 Messages | 1,034 | **98.55%** | **96.77%** | **91.60%** | **94.12%** | **0.44%** | **99.56%** |

---

## Running Benchmark Evaluation Scripts

### 1. Email RAG vs. Without-RAG Benchmark
```bash
python ml/evaluate_rag_vs_norag.py
```
*Evaluates the 500-email corpus A/B experiment and saves `rag_vs_norag_comparison_plot.png`.*

### 2. Standalone Email Classifier Evaluation
```bash
python ml/evaluate.py
```
*Evaluates the trained Logistic Regression model on 3,508 held-out test emails.*

### 3. URL Detection Benchmark (100,000 URLs)
```bash
python ml/evaluate_real_url_dataset.py
```
*Evaluates 100,000 URLs using 18 lexical/structural features + TF-IDF char n-grams on a 20,000 test split.*

### 4. SMS Smishing Benchmark
```bash
python ml/evaluate_message_benchmark.py
```
*Evaluates 5,572 SMS messages on a 1,034 test split.*

---

## FastEmbed + FAISS RAG Architecture

DetectIQ indexes historical legitimate communications for each user in an isolated FAISS vector database:

```text
Current Input Message ──> FastEmbed (all-MiniLM-L6-v2) ──> 384-Dim Normalized Vector
                                                                      │
                                                                      ▼
                                                      FAISS Search (User Vector Index)
                                                                      │
                                                                      ▼
                                                        Top-K Historical Baseline Context
                                                                      │
                                                                      ▼
                                                          Groq LLM Contextual Reasoning
```

### Key RAG Properties:
- **User Isolation**: Every user gets a dedicated, isolated FAISS index (`user_indexes[user_id]`).
- **Inner Product Cosine Similarity**: Vectors are normalized to unit length before indexing.
- **Data Leakage Prevention**: Evaluated test queries are strictly excluded from RAG retrieval memory during benchmark testing.
