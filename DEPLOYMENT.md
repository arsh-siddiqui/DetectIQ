# DetectIQ Deployment Guide

This guide outlines the production deployment architecture and steps required to launch DetectIQ securely.

## A. Architecture Overview
- **Frontend**: Hosted on Vercel (React + Vite SPA)
- **Backend API**: Hosted on Render (Node.js + Express)
- **ML Service**: Hosted on Render (Python + FastAPI)
- **Database**: MongoDB Atlas
- **AI Integration**: Groq API
- **Threat Intelligence**: PhishDestroy API

## B. Local Development Commands
| Service  | Directory | Command |
| :--- | :--- | :--- |
| **Frontend** | `/` (root) | `npm run dev` |
| **Backend API** | `/server` | `npm run dev` |
| **ML Service** | `/ml` | `python -m uvicorn api.main:app --port 8001` |

## C. Production Build & Start Commands
| Service | Directory | Build Command | Start Command |
| :--- | :--- | :--- | :--- |
| **Frontend** | `/` (root) | `npm run build` | N/A (Static hosting) |
| **Backend API** | `/server` | `npm install` | `npm start` |
| **ML Service** | `/ml` | `pip install -r requirements.txt` | `python -m uvicorn api.main:app --host 0.0.0.0 --port $PORT` |

## D. Required Environment Variables

### Frontend (Vercel)
- `VITE_API_URL` = `https://<your-backend-render-url>/api`

### Backend (Render)
Configure these inside your Render dashboard:
- `NODE_ENV` = `production`
- `MONGO_URI` = `<Your MongoDB Atlas connection string>`
- `JWT_SECRET` = `<A long random secure string>`
- `JWT_EXPIRES_IN` = `7d`
- `FRONTEND_URL` = `https://<your-vercel-domain>`
- `PHISHDESTROY_API_URL` = `https://api.destroy.tools`
- `PHISHDESTROY_TIMEOUT_MS` = `4000`
- `THREAT_INTEL_CACHE_TTL` = `6`
- `ML_SERVICE_URL` = `https://<your-ml-render-url>`
- `GROQ_API_KEY` = `<Your Groq API Key>`
- `GROQ_MODEL` = `llama-3.1-8b-instant`

## E. Vercel Configuration (Frontend)
1. Import the root repository into Vercel.
2. Vercel will auto-detect Vite. Ensure the Build Command is `npm run build` and Output Directory is `dist`.
3. Add the `VITE_API_URL` environment variable.
4. **Routing**: The repository includes a `vercel.json` file which automatically configures the SPA rewrite (`/*` → `/index.html`) so refreshing the page won't result in a 404.

## F. Render Configuration (Backend & ML)
A `render.yaml` Blueprint is provided in the repository root. You can connect your Render account to the repository to automatically provision both the Node API and Python ML services.
1. Connect the Blueprint in the Render Dashboard.
2. Render will prompt you for the missing secret values (`MONGO_URI`, `JWT_SECRET`, `GROQ_API_KEY`, etc.).
3. Once deployed, note down the URL of the ML service and update the Node backend's `ML_SERVICE_URL`.
4. Note down the Node backend URL and update the Vercel frontend's `VITE_API_URL`.

## H. MongoDB Atlas Configuration
1. Ensure your Cluster's **Network Access** allows IP addresses from Render (or `0.0.0.0/0` if necessary).
2. Use a dedicated database user for this application with strictly `readWrite` access to the database.
3. Do **NOT** run `npm run cleanup` in production.
4. The database already correctly seeds the 34 Learn lessons through standard application startup or manual seeding.

## I. CORS Configuration
The backend automatically reads the `FRONTEND_URL` environment variable to securely configure CORS and issue Cross-Origin cookies (`Secure=true` and `SameSite=none`). Ensure your `FRONTEND_URL` exactly matches the Vercel production URL (e.g., no trailing slashes).

## J. SPA Routing Configuration
Configured automatically via `vercel.json`.

## K. Post-Deployment Testing Checklist

| Task | Status | Note |
| :--- | :--- | :--- |
| **GitHub push** | `[ ]` | Push `vercel.json` and `render.yaml` |
| **MongoDB Atlas** | `[ ]` | Configure cluster and get URI |
| **Vercel** | `[ ]` | Deploy frontend and set `VITE_API_URL` |
| **Render backend** | `[ ]` | Deploy Node app and set secrets |
| **Render ML** | `[ ]` | Deploy Python app |
| **API keys** | `[ ]` | Add Groq & JWT Secret to Render |
| **Environment vars** | `[ ]` | Cross-link URLs (`FRONTEND_URL`, `ML_SERVICE_URL`, `VITE_API_URL`) |
| **Live testing** | `[ ]` | Verify Login, Scanner, and Learn progress in browser |
