# DetectIQ — Production Deployment Guide & Infrastructure Operations

This document outlines the step-by-step procedures to deploy, configure, and operate DetectIQ across production cloud infrastructure.

---

## 1. Production Architecture Overview

| Tier | Platform | Component | Live Production Endpoint / Identifier |
| :--- | :--- | :--- | :--- |
| **Frontend** | Vercel | React 19 + Vite SPA | Deployed Vercel URL (`https://<project>.vercel.app`) |
| **Backend API** | Render | Node.js Express Server | `https://detectiq-api.onrender.com` |
| **AI / ML Service** | Render | Python FastAPI Microservice | `https://detectiq-ml.onrender.com` |
| **Database** | MongoDB Atlas | Replica Set Cluster | `mongodb+srv://<user>:<pwd>@cluster.mongodb.net/detectiq` |
| **Browser Extension** | Chrome / Edge | Manifest V3 Extension | Loaded from `/extension` directory |

---

## 2. Complete Environment Variables Matrix

### 2.1 Frontend (Vercel)
| Variable | Required | Description | Example |
| :--- | :---: | :--- | :--- |
| `VITE_API_URL` | **Yes** | Public HTTPS endpoint of Express API (must include `/api`) | `https://detectiq-api.onrender.com/api` |

### 2.2 Backend API (Render: `detectiq-api`)
| Variable | Required | Description | Example |
| :--- | :---: | :--- | :--- |
| `NODE_ENV` | **Yes** | Node environment mode | `production` |
| `PORT` | **Yes** | Service port assigned by Render | `5000` (or dynamic `$PORT`) |
| `MONGO_URI` | **Yes** | MongoDB Atlas connection string | `mongodb+srv://user:pass@cluster.mongodb.net/detectiq` |
| `JWT_SECRET` | **Yes** | 64+ char random secret key | `super-secure-random-secret-key-12345` |
| `JWT_EXPIRES_IN` | No | Token lifetime | `7d` |
| `FRONTEND_URL` | **Yes** | Vercel frontend URL for CORS origin matching | `https://<your-project>.vercel.app` |
| `ML_SERVICE_URL` | **Yes** | URL of Render Python ML service | `https://detectiq-ml.onrender.com` |
| `ML_INTERNAL_TOKEN`| **Yes** | Shared secret between Node & Python | `shared-internal-token-secret-xyz` |
| `GROQ_API_KEY` | **Yes** | Groq Cloud API Key | `gsk_...` |
| `GROQ_MODEL` | No | Llama model for reasoning | `llama-3.1-8b-instant` |
| `PHISHDESTROY_API_URL`| No | PhishDestroy threat intel API | `https://api.destroy.tools` |
| `THREAT_INTEL_CACHE_TTL`| No | Cache TTL in hours | `6` |

### 2.3 Python ML Service (Render: `detectiq-ml`)
| Variable | Required | Description | Example |
| :--- | :---: | :--- | :--- |
| `PYTHON_VERSION` | **Yes** | Runtime version | `3.10.0` |
| `ML_INTERNAL_TOKEN`| **Yes** | Shared secret (must match Node backend) | `shared-internal-token-secret-xyz` |

---

## 3. Step-by-Step Deployment Guide

### Step 1: MongoDB Atlas Configuration
1. Log in to [MongoDB Atlas](https://cloud.mongodb.com).
2. Create or select a Cluster.
3. In **Network Access**: Add IP Access List entry `0.0.0.0/0` (allowing Render outbound IPs) or specific Render static IPs.
4. In **Database Access**: Create a dedicated database user with `readWrite` permissions on the `detectiq` database.
5. Copy the connection string (`mongodb+srv://...`).

---

### Step 2: Render Infrastructure as Code (`render.yaml`)
A ready-to-use Blueprint is included in the project root: [render.yaml](file:///d:/detectiq-fullstack/DETECTIQ/render.yaml).

1. Log in to [Render Dashboard](https://dashboard.render.com).
2. Click **New +** → **Blueprint**.
3. Connect your GitHub repository (`arsh-siddiqui/DetectIQ`).
4. Render automatically parses `render.yaml` and provisions both services:
   - `detectiq-api` (Express backend)
   - `detectiq-ml` (Python FastAPI ML service)
5. Enter the secret variables prompted by Render (`MONGO_URI`, `JWT_SECRET`, `GROQ_API_KEY`, `ML_INTERNAL_TOKEN`).
6. Click **Apply**.
7. Once deployed, note your service URLs:
   - Backend: `https://detectiq-api.onrender.com`
   - ML: `https://detectiq-ml.onrender.com`

---

### Step 3: Frontend Deployment on Vercel
1. Log in to [Vercel](https://vercel.com).
2. Click **Add New...** → **Project** and import `arsh-siddiqui/DetectIQ`.
3. Framework Preset: **Vite** (auto-detected).
4. Build Command: `npm run build`.
5. Output Directory: `dist`.
6. Add Environment Variable:
   - `VITE_API_URL` = `https://detectiq-api.onrender.com/api`
7. Click **Deploy**.
8. Copy your production Vercel domain and update `FRONTEND_URL` in your Render backend environment variables.

---

### Step 4: Browser Extension Setup
1. Open **Chrome / Edge / Brave** and navigate to `chrome://extensions`.
2. Toggle on **Developer mode** (top-right).
3. Click **Load unpacked** and select the `/extension` directory.
4. Pin **DetectIQ** to your toolbar.
5. In the extension popup, open **Settings**:
   - The endpoint is pre-configured to `https://detectiq-api.onrender.com`.
   - Click **Test** to confirm green `Connected to DetectIQ Server (200 OK)`.

---

## 4. Verification & Smoke Testing

Run the full automated test suite to verify full system readiness:
```bash
# Runs full project tests (326 Vitest tests + 33 Extension automated tests):
npm run test:all
```

Manual Smoke Test Checklist:
- [x] `GET https://detectiq-api.onrender.com/api/health` returns `200 OK` (`dbConnected: true`).
- [x] User registration & login on Vercel web app works with secure cookies.
- [x] Scan a URL (`https://google.com`) returns clean assessment.
- [x] Scan a phishing lure returns high threat indicators and recommendations.
- [x] Browser extension scans page with zero local servers running.
