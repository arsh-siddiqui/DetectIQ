# DetectIQ — Comprehensive System Design & Architecture Specification

## 1. Executive Summary & Architecture Overview

**DetectIQ** is a multi-layer cybersecurity platform engineered to detect, explain, and mitigate cyber fraud, phishing, and social engineering attacks across multi-channel attack surfaces (Web URLs, Emails, SMS / Smishing, QR Codes, and Screenshots).

The system adopts a **decoupled microservices architecture**:
- **Client Layer**: React 19 Single Page Application (SPA) + Manifest V3 Chromium Extension (Chrome/Edge/Brave).
- **Application & Gateway Layer**: Node.js / Express REST API managing authentication, session security, database operations, business logic, rate limiting, and evidence fusion.
- **AI / Inference Microservice**: Python 3.10 / FastAPI service running Scikit-Learn TF-IDF classifiers and personalized FAISS dense vector retrieval (`all-MiniLM-L6-v2`, 384 dimensions).
- **External AI & Intelligence Layer**: Groq Cloud LLM (`llama-3.1-8b-instant`), PhishDestroy API, VirusTotal, AbuseIPDB, URLhaus, AlienVault OTX, RDAP, and IP Geolocation.
- **Persistence Layer**: MongoDB Atlas for transactional data, audit logs, and cache; in-memory FAISS indices for vector embeddings.

---

## 2. High-Level System Architecture

```
                                  ┌────────────────────────────────────────────────────────┐
                                  │                     CLIENT LAYER                       │
                                  │   React 19 SPA (Vercel)  │  Browser Extension (MV3)    │
                                  └───────────────┬────────────────────────┬───────────────┘
                                                  │ HTTPS                  │ HTTPS / Extension API
                                                  ▼                        ▼
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│                             API GATEWAY & BACKEND (Node.js / Express)                    │
│                                                                                          │
│  [Helmet Security Headers]      [Strict CORS Regex]       [Rate Limiters (Express)]      │
│  [JWT & Cookie Auth Guard]      [Input Sanitizers]        [Morgan HTTP Logger]           │
│                                                                                          │
│  Routes:                                                                                 │
│   • /api/auth       (Login, Register, Google OAuth 2.0, Session)                         │
│   • /api/scan       (Unified Multi-Channel Threat Scanner & Evidence Fusion)             │
│   • /api/users      (Profile, Password Management, Posture Tracking)                     │
│   • /api/vulnerabilities & /api/progress (Interactive Education & Micro-Assessments)    │
│   • /api/email-history & /api/email-forensics (RAG Training Data & Deep Inspections)     │
│   • /api/admin      (Audit Logs, System Threat Telemetry)                                │
│   • /api/health     (Zero-Dependency Liveness & Database Readiness Probe)                │
└──────────────┬─────────────────────────┬───────────────────────────────┬─────────────────┘
               │ Internal Token (Bearer) │ Mongoose Pool                 │ HTTPS (TLS 1.3)
               ▼                         ▼                               ▼
┌──────────────────────────────┐  ┌─────────────────────────┐  ┌───────────────────────────┐
│     AI / ML MICROSERVICE     │  │     MONGODB ATLAS       │  │  EXTERNAL INTELLIGENCE    │
│      (Python / FastAPI)      │  │  (Replica Set Clusters) │  │  • Groq Cloud LLM         │
│  • TF-IDF Classifiers        │  │  • Users & Profiles     │  │  • PhishDestroy API       │
│  • Logistic Regression       │  │  • Scans & Evidence     │  │  • VirusTotal             │
│  • FastEmbed Embeddings      │  │  • ThreatIntelCache(TTL)│  │  • AbuseIPDB              │
│  • FAISS Vector Memory       │  │  • LearningProgress     │  │  • URLhaus / OTX          │
│  • Endpoints:                │  │  • AdminLogs & History  │  │  • RDAP / GeoIP           │
│    /predict, /embed,         │  └─────────────────────────┘  └───────────────────────────┘
│    /retrieve, /rag-context   │
└──────────────────────────────┘
```

---

## 3. Database Architecture & Data Modeling

DetectIQ uses **MongoDB Atlas** with optimized schema definitions, compound indexes, and TTL lifecycle eviction:

### Core Schemas & Indexing Strategy:

1. **`User`**:
   - Fields: `name`, `email` (unique index, lowercase), `password` (bcrypt hashed, `select: false`), `role` (`'user'` | `'admin'`), `googleId`, `avatar`, `stats`.
   - Security: Password field is excluded from queries by default to prevent accidental leakage in API serialization.

2. **`Scan`**:
   - Fields: `userId` (indexed for user scan history), `scanType` (`'url'` | `'email'` | `'sms'` | `'whatsapp'` | `'qr'` | `'message'` | `'screenshot'`), `content` (truncated/hashed for privacy), `score` (`0 - 100`), `verdict` (`'legitimate'` | `'suspicious'` | `'phishing'`), `riskLevel` (`'safe'` | `'low'` | `'suspicious'` | `'high'` | `'critical'`), `evidence` (structured signals object), `timestamp`.
   - Compound Indexes: `{ userId: 1, createdAt: -1 }` for low-latency pagination of user scan history.

3. **`ThreatIntelCache` (Automated TTL Eviction)**:
   - Fields: `urlHash` (SHA-256 hash, unique index), `normalizedUrl` (`select: false`), `providers` (PhishDestroy, VirusTotal, GeoIP), `checkedAt`, `expiresAt`.
   - **TTL Index**: `{ expiresAt: 1 }, { expireAfterSeconds: 0 }`. MongoDB background thread automatically purges stale threat cache entries without requiring cron maintenance.

4. **`EmailHistory` & FAISS Vector Memory**:
   - Fields: `userId`, `sender`, `subject`, `body`, `isLegitimate`, `embeddingId`.
   - Provides baseline communications for personalized RAG vector retrieval.

5. **`LearningProgress`, `AssessmentAttempt`, `Vulnerability`**:
   - Stores user educational progression across 34 interactive lessons, tracking skill mastery and identifying personal cyber vulnerabilities.

---

## 4. Authentication & Authorization Flow

DetectIQ implements defense-in-depth access control:

- **Dual-Mode JWT Transmission**:
  - **Web SPA**: Delivered via `httpOnly`, `Secure` (in production), `SameSite=None` or `Lax` cookies (`JWT_COOKIE_NAME`) to prevent JavaScript token theft via Cross-Site Scripting (XSS).
  - **Browser Extension & CLI**: Accepted via `Authorization: Bearer <token>` header.
- **Middleware Layers**:
  - `protect`: Verifies JWT signature and extracts user ID; validates active account existence in MongoDB.
  - `optionalAuth`: Allows anonymous public scanning while attaching authenticated profile context when available.
  - `authorize(...roles)`: Enforces Role-Based Access Control (RBAC) (e.g. `authorize('admin')` for telemetry and audit log review).
- **Microservice Authentication (`ML_INTERNAL_TOKEN`)**:
  - Direct HTTP calls between Express and FastAPI must present an `Authorization: Bearer <ML_INTERNAL_TOKEN>` header. External callers attempting direct access receive `403 Forbidden`.

---

## 5. Multi-Layer Threat Detection Pipeline

When content is scanned via `/api/scan`, DetectIQ routes the request through a 6-stage pipeline:

```
[Incoming Payload] ──► Stage 1: Fast Heuristics (Keyword, Regex, SSL, Typosquatting)
                   ──► Stage 2: Scikit-Learn ML Inference (TF-IDF N-grams)
                   ──► Stage 3: Threat Intelligence Query (PhishDestroy / VirusTotal / Cache)
                   ──► Stage 4: Personalized FAISS RAG Retrieval (Historical Baseline)
                   ──► Stage 5: Groq LLM Contextual Reasoning (Llama-3.1-8b-instant)
                   ──► Stage 6: Deterministic Evidence Fusion (Calculates Final Risk Score)
```

### Empirical Detection Benchmarks:
- **Email with Personalized RAG**: **99.00% Accuracy**, **1.00% False Positive Rate** (88.89% false alarm reduction compared to 9.00% FPR without RAG).
- **URL Phishing Engine**: **99.60% Accuracy**, **99.96% Precision** (100,000 URLs).
- **SMS Smishing Engine**: **98.55% Accuracy**, **96.77% Precision** (5,572 messages).

---

## 6. Rate Limiting & Denial-of-Service Defense

To safeguard system availability and protect third-party API quotas, DetectIQ enforces multi-tier rate limiting via `express-rate-limit`:

| Route Target | Limit Window | Max Requests | Purpose |
| :--- | :--- | :--- | :--- |
| **`/api` (Global)** | 15 Minutes | 150 req / IP | Baseline API throttling; prevents client flooding. |
| **`/api/auth`** | 15 Minutes | 15 req / IP | Mitigates brute-force credential stuffing and password guessing. |
| **`/api/scan`** | 1 Minute | 40 req / IP | Shields Groq, ML, and Threat Intel APIs from denial-of-wallet spikes. |
| **`/api/health`** | Unlimited | ∞ | Always accessible for uptime monitors, Render health probes, and extension pings. |

---

## 7. Caching & Performance Optimization

1. **SHA-256 Threat Intelligence Cache**:
   - Normalizes raw URLs (lowercasing, trailing slash removal, protocol stripping).
   - Generates SHA-256 hash key stored in `ThreatIntelCache`.
   - Repeated queries resolve in sub-millisecond DB lookups rather than 3-second third-party HTTP round-trips.
2. **Browser Extension In-Memory LRU Cache**:
   - Caps ambient navigation scan cache at 100 entries.
   - Automatically evicts oldest entries using Map iterator keys.
3. **Whitelisted Domains Bypass**:
   - Extension provides a one-click local whitelist, bypassing repetitive scans for verified trusted domains.

---

## 8. Security Controls & Hardening Checklist

- [x] **Helmet Security**: Automatic HTTP headers (`X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Strict-Transport-Security`).
- [x] **Strict CORS Policy**: Allows only approved frontend origins (`FRONTEND_URL`), Vite dev servers (`http://localhost:517x`), and browser extensions (`chrome-extension://*`, `moz-extension://*`).
- [x] **Input Sanitization**: Express-validator middleware strips invalid characters and enforces length limits.
- [x] **XSS Mitigation**: Client-side and extension HTML escaping utility (`DetectIQApi.escapeHtml`) handles both strings and nested object errors.
- [x] **Database Isolation**: Tenant isolation per `userId` on history, scan records, and FAISS vector indices.
- [x] **No Hardcoded Secrets**: Secrets (`JWT_SECRET`, `MONGO_URI`, `GROQ_API_KEY`, `ML_INTERNAL_TOKEN`) are strictly managed through environment variables.

---

## 9. Testing & Quality Assurance

DetectIQ maintains comprehensive automated testing across all system layers:

1. **Backend Integration & Unit Tests** (`vitest` / `supertest`):
   - Pipeline consistency tests (`server/tests/urlVerdictConsistency.test.js`).
   - RAG retrieval tests (`server/tests/ragIntegration.test.js`).
   - Multi-channel input validation tests (`server/tests/unifiedScanner.test.js`).
2. **Browser Extension Test Suite** (`npm run test:extension`):
   - `manifest.test.js`: Manifest V3 compliance and asset presence.
   - `api-unit.test.js`: Score-to-tier mappings, input rejection, XSS escaping, offline heuristic fallback.
   - `background-unit.test.js`: Typosquatting regex, download inspector, badge thresholds, LRU cache eviction.
   - `popup-ui.test.js`: DOM integrity, environment preset switcher (`Cloud (Render)` ↔ `Localhost:5000`).
   - `live-cloud-e2e.test.js`: Live network validation against `https://detectiq-api.onrender.com`.

---

## 10. CI/CD, Deployment & Infrastructure

- **Frontend**: Hosted on **Vercel** with single-page application routing rules (`vercel.json` rewrites `/*` → `/index.html`).
- **Backend & ML Microservices**: Automated provisioning on **Render** via Blueprint [render.yaml](file:///d:/detectiq-fullstack/DETECTIQ/render.yaml):
  - `detectiq-api`: Node.js web service running Express API.
  - `detectiq-ml`: Python web service running FastAPI + Uvicorn with auto-healing health check path `/health`.
- **Browser Extension**: Manifest V3 compliant package loaded unpacked in Developer Mode or distributable via Chrome Web Store.

---

## 11. Monitoring, Observability & Scaling Roadmap

### Observability:
- **Liveness Probes**: `/api/health` returns status without requiring DB connection; reports MongoDB status independently (`dbConnected: true/false`).
- **Structured HTTP Logs**: Morgan middleware logs traffic with HTTP status codes and response times.
- **Admin Audit Trail**: Admin action logging in MongoDB for sensitive security events.

### Future Scaling Architecture:
- **Redis Cache Layer**: Replace in-memory rate limiting and distributed caching with Redis Cluster when horizontally scaling Express instances.
- **Asynchronous Task Queue (BullMQ / Celery)**: Decouple intensive screenshot OCR and multi-provider intelligence scans into background worker pools.
- **Persistent Vector Database (Pinecone / Qdrant / Milvus)**: Migrate in-memory FAISS indices to dedicated vector database clusters as user email corpus exceeds 100,000 vectors.
- **CDN Edge Caching**: Cloudflare edge proxy for static asset distribution and DDoS scrubbing.
