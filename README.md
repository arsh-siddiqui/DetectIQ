# DetectIQ — Multi-Layer Cyber Fraud Awareness & Phishing Protection

**Learn Smart. Detect Fast. Stay Safe.**

DetectIQ is an enterprise cybersecurity platform that combines a multi-layer threat detection engine (TF-IDF ML Classifiers + FastEmbed FAISS Personalized RAG + Threat Intelligence + Groq LLM) with multi-channel scanning (Email, URL, SMS/Message, QR Code, Screenshot) and vulnerability-focused interactive learning.

---

## 🌟 Key Features & Benchmark Performance

### 🛡️ 1. Personalized RAG-Based Phishing Detection Architecture
DetectIQ evaluates emails, web URLs, SMS texts, and QR payloads using a multi-layer detection pipeline:

1. **Layer 1 — Deterministic Heuristic Engine**: High-speed keyword, domain, urgency, and pattern analysis.
2. **Layer 2 — Scikit-Learn ML Classifiers**: Dual word/character n-gram TF-IDF vectorizers paired with Logistic Regression models.
3. **Layer 3 — Threat Intelligence Enrichment**: Real-time reputation checks across VirusTotal, AbuseIPDB, URLhaus, AlienVault OTX, RDAP, and IP Geolocation.
4. **Layer 4 — Personalized FAISS RAG Retrieval**: Indexing historical legitimate user communications into per-user FAISS vector memory (`all-MiniLM-L6-v2`, 384 dimensions) to establish baseline context.
5. **Layer 5 — Groq LLM Contextual Reasoning**: Evaluates potential spear-phishing deviations against personalized email history context (`openai/gpt-oss-120b`).
6. **Evidence Fusion Layer**: Synthesizes all multi-layer signals deterministically into a unified risk assessment.

---

## 📊 Empirical Performance Benchmarks

| Detection Channel | Dataset / Corpus Size | Test Split ($N$) | Accuracy | Precision | Recall | F1-Score | FPR | Specificity |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Email (Without RAG)** | 500 Email Corpus | 200 | 95.00% | 91.67% | 99.00% | 95.19% | 9.00% | 91.00% |
| **Email (With RAG — DetectIQ)** | 500 Email Corpus | 200 | **99.00%** | **99.00%** | **99.00%** | **99.00%** | **1.00%** | **99.00%** |
| **Email Standalone ML** | 17,537 Emails (`phishing_dataset.csv`) | 3,508 | **98.80%** | **97.82%** | **99.01%** | **98.41%** | **1.32%** | **98.68%** |
| **URL Phishing Engine** | 100,000 URLs (`url_dataset.csv`) | 20,000 | **99.60%** | **99.96%** | **99.24%** | **99.60%** | **0.04%** | **99.96%** |
| **SMS Smishing Engine** | 5,572 Messages (`message_dataset.csv`) | 1,034 | **98.55%** | **96.77%** | **91.60%** | **94.12%** | **0.44%** | **99.56%** |

> **Key RAG Impact**: Enabling personalized FAISS email RAG memory reduced False Positive Rate (FPR) from **9.00% to 1.00%** (an **88.89% relative false alarm reduction**) while increasing detection accuracy from **95.00% to 99.00%**.

---

## 📚 2. Vulnerability-Focused Learning & Security Profile
- **Vulnerability Curriculum**: Structured knowledge base focusing on theory, identification, impact, and prevention strategies.
- **Adaptive Assessments**: Server-side evaluations to validate understanding, track learner weaknesses safely, and isolate progress.
- **Security Profile Tracking**: Real-time mastery mapping that ties learning outcomes directly to the user's overarching security posture.

---

## 🔐 3. User Isolation & Security
- **Strict JWT Isolation**: FAISS vector retrieval, scan history, and MongoDB learning progress are robustly user-isolated.
- **Data Leakage Prevention**: Evaluated test queries are strictly excluded from RAG retrieval memory during benchmark testing.

---

## 🚀 Quick Start & Installation

### Prerequisites
- **Node.js**: v18+ and npm
- **Python**: v3.9+ (for ML inference microservice)
- **MongoDB Atlas** or local MongoDB instance

### 1. Frontend Setup
```bash
npm install
npm run dev
```

### 2. Backend API Setup
```bash
cd server
npm install
cp .env.example .env
npm run seed
npm run dev
```

### 3. ML/RAG Microservice Setup
```bash
cd ml
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
python -m uvicorn api.main:app --port 8543
```

---

## 📄 License
MIT License. Built for cybersecurity awareness and fraud protection.
