# DetectIQ — Comprehensive System Design Specification

---

## 1. System Requirements & Design Goals

### 1.1 Functional Requirements
1. **Multi-Channel Threat Detection**: Real-time evaluation of URLs, emails, SMS/messaging texts, QR code targets, and image screenshots.
2. **Personalized RAG Context**: Indexing of user baseline communications to dramatically reduce False Positives in spear-phishing detection.
3. **Multi-Provider Threat Intelligence**: Correlation across VirusTotal, PhishDestroy, URLhaus, AbuseIPDB, AlienVault OTX, and RDAP.
4. **Autonomous Ambient Defense**: Browser extension with instant hover shields, pre-navigation typosquatting interception, and credential form protection.
5. **Interactive Vulnerability Learning**: Structured curriculum with server-evaluated micro-assessments and user security posture mapping.

### 1.2 Non-Functional Requirements
- **Low Latency**: Under 1,500ms for standard heuristic/ML scans; under 3,000ms for full multi-provider enrichment.
- **High Availability**: 99.9% uptime with zero-dependency health checks and graceful offline heuristic fallbacks.
- **Fault Tolerance**: The platform must complete scans and return actionable safety guidance even if individual third-party intelligence providers time out or fail.
- **Strict Data Privacy**: Zero storage of raw credentials; cryptographic SHA-256 indexing of target URLs; strict tenant isolation.

---

## 2. Multi-Channel Ingestion & Processing Pipelines

```
                             ┌───────────────────────────────────────┐
                             │          INGESTION CHANNELS           │
                             │  URL │ Email │ Message │ QR │ Image   │
                             └───────────────────┬───────────────────┘
                                                 │
                                                 ▼
                             ┌───────────────────────────────────────┐
                             │       STAGE 1: INPUT NORMALIZER       │
                             │  • Protocol normalization (https://)  │
                             │  • QR payload extraction              │
                             │  • Tesseract.js / OCR image text      │
                             │  • RFC 5322 EML MIME parsing          │
                             └───────────────────┬───────────────────┘
                                                 │
                                                 ▼
                             ┌───────────────────────────────────────┐
                             │       STAGE 2: HEURISTIC GATE         │
                             │  • Typosquatting regex patterns       │
                             │  • Suspicious URL shortener check     │
                             │  • Raw IP host evaluation             │
                             │  • Urgent call-to-action signals      │
                             └───────────────────┬───────────────────┘
                                                 │
                                                 ▼
                             ┌───────────────────────────────────────┐
                             │     STAGE 3: MULTI-LAYER INFERENCE    │
                             │  • Scikit-Learn TF-IDF Classifiers    │
                             │  • Threat Intel (VirusTotal, OTX)     │
                             │  • FAISS RAG Baseline Comparison      │
                             │  • Groq Cloud LLM Context Reasoning   │
                             └───────────────────┬───────────────────┘
                                                 │
                                                 ▼
                             ┌───────────────────────────────────────┐
                             │       STAGE 4: EVIDENCE FUSION        │
                             │  Deterministic multi-signal synthesis │
                             │  Calculates numerical risk (0 - 100)  │
                             └───────────────────┬───────────────────┘
                                                 │
                                                 ▼
                             ┌───────────────────────────────────────┐
                             │        STAGE 5: CLIENT RESPONSE       │
                             │  Verdict, Category, Indicators, Recs  │
                             └───────────────────────────────────────┘
```

---

## 3. Evidence Fusion & Threat Scoring Mathematics

The Evidence Fusion layer deterministically reconciles signals from disparate sources:

$$\text{Final Risk Score} = \min\left(100, \sum_{i} W_i \cdot S_i + B_{\text{critical}}\right)$$

Where:
- $W_i$ represents the confidence weight of the source ($W_{\text{Intel}} = 0.40$, $W_{\text{Groq}} = 0.25$, $W_{\text{ML}} = 0.20$, $W_{\text{Heuristics}} = 0.15$).
- $S_i$ represents the normalized severity signal from each layer ($0 - 100$).
- $B_{\text{critical}}$ is an immediate bonus (+50 points) applied when authoritative threat intelligence (e.g. VirusTotal positive count $\ge 3$ or verified PhishDestroy entry) confirms malicious behavior.

### Threat Classification Tiers:
- **`0 - 20` (SAFE)**: Clean structural analysis, verified domain history, SSL valid.
- **`21 - 45` (LOW)**: Minor anomalies (new domain registration), no malicious reputation.
- **`46 - 70` (SUSPICIOUS / MEDIUM)**: Credential verification path, urgency keywords, unverified brand reference.
- **`71 - 85` (HIGH)**: Multiple threat signals, known suspicious host, ML confidence $> 0.85$.
- **`86 - 100` (CRITICAL)**: Confirmed typosquatting, malware host, blacklisted by intelligence providers.

---

## 4. Multi-Tier Caching Hierarchy

```
[Incoming Query] ──► Level 1: Extension In-Memory LRU Cache (Capped at 100 items, sub-millisecond)
                 ──► Level 2: MongoDB ThreatIntelCache (SHA-256 key, TTL index, 6-hour expiry)
                 ──► Level 3: Python FAISS In-Memory Dense Vector Cache (Sub-5ms similarity search)
                 ──► Cache Miss: Real-time External Intelligence Query & API Call
```

1. **L1 (Client Extension LRU Cache)**:
   - Eliminates repetitive network calls during rapid browsing across the same domain.
2. **L2 (MongoDB ThreatIntelCache)**:
   - Stores normalized threat records indexed by SHA-256 URL hashes.
   - Automatically purged by MongoDB TTL workers using `{ expiresAt: 1 }, { expireAfterSeconds: 0 }`.
3. **L3 (Python FAISS Dense Vector Memory)**:
   - Keeps user email vector representations resident in RAM, enabling real-time baseline retrieval without secondary disk I/O.

---

## 5. Scalability & Horizontal Growth Roadmap

```
                                      ┌────────────────────────────────┐
                                      │        CLOUDFLARE EDGE         │
                                      │  (DDoS Scrubbing, CDN Cache)   │
                                      └───────────────┬────────────────┘
                                                      │
                                                      ▼
                                      ┌────────────────────────────────┐
                                      │         LOAD BALANCER          │
                                      └───────────────┬────────────────┘
                                                      │
                               ┌──────────────────────┴──────────────────────┐
                               ▼                                             ▼
                ┌─────────────────────────────┐               ┌─────────────────────────────┐
                │     EXPRESS API NODE #1     │               │     EXPRESS API NODE #2     │
                └──────────────┬──────────────┘               └──────────────┬──────────────┘
                               │                                             │
                               ├──────────────────────┬──────────────────────┤
                               │                      │                      │
                               ▼                      ▼                      ▼
                ┌─────────────────────────────┐ ┌───────────┐ ┌─────────────────────────────┐
                │       REDIS CLUSTER         │ │  BULLMQ   │ │      FASTAPI ML WORKERS     │
                │  • Distributed Rate Limits  │ │  WORKERS  │ │  • Horizontal ML Replicas   │
                │  • Session & Cache Tier     │ │  (OCR/TI) │ │  • Persistent Vector DB     │
                └─────────────────────────────┘ └───────────┘ └─────────────────────────────┘
```

1. **Redis Distributed State**:
   - Replace in-memory rate limiting with Redis-backed token buckets across multiple Express instances.
2. **Asynchronous Worker Queue (BullMQ / Celery)**:
   - Offload heavy tasks (OCR screenshot extraction, batch forensic parsing) to background workers.
3. **Dedicated Vector Database (Pinecone / Milvus / Qdrant)**:
   - Transition from in-memory FAISS matrices to external distributed vector stores when user corpus exceeds 500,000 vectors.
