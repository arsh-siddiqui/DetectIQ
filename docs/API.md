# DetectIQ — REST API Specification & Contract Reference

**Base URL (Local)**: `http://localhost:5000/api`  
**Base URL (Production)**: `https://detectiq-api.onrender.com/api`  
**Content-Type**: `application/json`

---

## 1. Authentication & Session Management (`/api/auth`)

### 1.1 User Registration
- **Endpoint**: `POST /api/auth/register`
- **Access**: Public (Subject to Auth Rate Limiter: 15 req / 15 min)
- **Request Body**:
  ```json
  {
    "name": "Jane Doe",
    "email": "jane@example.com",
    "password": "SecurePassword123!"
  }
  ```
- **Response** (`201 Created`):
  ```json
  {
    "success": true,
    "message": "User registered successfully.",
    "user": {
      "id": "67057a1b4f1c9d001234abcd",
      "name": "Jane Doe",
      "email": "jane@example.com",
      "role": "user",
      "createdAt": "2026-10-08T15:00:00.000Z"
    }
  }
  ```
- **Cookies**: Sets `httpOnly`, `Secure` (production), `SameSite=None` auth cookie containing the signed JWT.

---

### 1.2 User Login
- **Endpoint**: `POST /api/auth/login`
- **Access**: Public (Subject to Auth Rate Limiter: 15 req / 15 min)
- **Request Body**:
  ```json
  {
    "email": "jane@example.com",
    "password": "SecurePassword123!"
  }
  ```
- **Response** (`200 OK`):
  ```json
  {
    "success": true,
    "message": "Login successful.",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "67057a1b4f1c9d001234abcd",
      "name": "Jane Doe",
      "email": "jane@example.com",
      "role": "user"
    }
  }
  ```

---

### 1.3 User Logout
- **Endpoint**: `POST /api/auth/logout`
- **Access**: Public
- **Response** (`200 OK`):
  ```json
  {
    "success": true,
    "message": "Logged out successfully."
  }
  ```
- **Cookie Effect**: Clears the auth cookie.

---

### 1.4 Get Authenticated User Context
- **Endpoint**: `GET /api/auth/me`
- **Access**: Private (Requires valid cookie or `Authorization: Bearer <token>`)
- **Response** (`200 OK`):
  ```json
  {
    "success": true,
    "user": {
      "id": "67057a1b4f1c9d001234abcd",
      "name": "Jane Doe",
      "email": "jane@example.com",
      "role": "user",
      "stats": {
        "scansCount": 42,
        "threatsBlocked": 8
      }
    }
  }
  ```

---

## 2. Threat Detection & Evidence Fusion (`/api/scan`)

### 2.1 Unified Threat Scan
- **Endpoint**: `POST /api/scan`
- **Access**: Public / Optional Authentication (Subject to Scan Rate Limiter: 40 req / min)
- **Supported `scanType` Values**:
  - `'url'` — Website addresses, links, domains
  - `'email'` — Email headers, subjects, body text
  - `'message'` — SMS smishing, WhatsApp lures, raw text
  - `'qr'` — Decoded QR code URLs or SMS payloads
  - `'screenshot'` — OCR extracted textual content
- **Request Body**:
  ```json
  {
    "scanType": "url",
    "content": "https://rnicrosoft-office365-verify.com/login"
  }
  ```
- **Response** (`200 OK`):
  ```json
  {
    "success": true,
    "message": "Scan complete.",
    "data": {
      "result": {
        "score": 95,
        "level": "critical",
        "verdict": "PHISHING",
        "category": "Phishing Target",
        "confidence": 0.98,
        "summary": "High-confidence brand impersonation and credential harvesting target detected.",
        "reasons": [
          {
            "title": "Typosquatting Detected",
            "detail": "Domain rnicrosoft-office365-verify.com mimics Microsoft via visual character deception.",
            "severity": "critical",
            "source": "Heuristics"
          },
          {
            "title": "Suspicious URL Structure",
            "detail": "Credential path pattern '/login' detected without authorized organization registration.",
            "severity": "high",
            "source": "Heuristics"
          }
        ],
        "recommendations": [
          "CRITICAL PHISHING THREAT! Do not enter passwords or personal data on this page.",
          "Close this tab immediately and report the domain."
        ],
        "recommendation": "CRITICAL PHISHING THREAT! Do not enter passwords or personal data on this page.",
        "evidence": {
          "verifiedThreatIntel": [],
          "heuristicsAndAi": [
            { "signal": "typosquatting", "weight": 40 },
            { "signal": "credential_path", "weight": 25 }
          ]
        },
        "ml": { "confidence": 0.96, "prediction": "phishing" },
        "rag": null,
        "intelligence": {
          "virusTotal": null,
          "urlhaus": null,
          "rdap": { "registrar": "NameCheap", "ageDays": 2 }
        },
        "timestamp": "2026-10-08T15:20:00.000Z"
      },
      "savedToHistory": false
    }
  }
  ```

---

## 3. User Profile & Security Posture (`/api/users`)

### 3.1 Update Profile
- **Endpoint**: `PUT /api/users/profile`
- **Access**: Private (Authenticated)
- **Request Body**:
  ```json
  { "name": "Jane Smith" }
  ```
- **Response** (`200 OK`): Returns updated user object.

### 3.2 Change Password
- **Endpoint**: `PUT /api/users/password`
- **Access**: Private (Authenticated)
- **Request Body**:
  ```json
  {
    "currentPassword": "OldPassword123!",
    "newPassword": "NewSecurePassword456!"
  }
  ```
- **Response** (`200 OK`):
  ```json
  { "success": true, "message": "Password updated successfully." }
  ```

---

## 4. Vulnerability Learning & Curriculum (`/api/vulnerabilities` & `/api/progress`)

### 4.1 List Curriculum Modules
- **Endpoint**: `GET /api/vulnerabilities`
- **Access**: Public
- **Response** (`200 OK`): Array of 34 cybersecurity curriculum modules categorized by attack vector (Phishing, Social Engineering, Credential Attacks, Malware, Identity Spoofing).

### 4.2 Get User Learning Progress
- **Endpoint**: `GET /api/progress`
- **Access**: Private (Authenticated)
- **Response** (`200 OK`): Completed lessons, quiz scores, overall security posture index, and identified weak areas.

### 4.3 Submit Lesson Assessment
- **Endpoint**: `POST /api/progress/assessment`
- **Access**: Private (Authenticated)
- **Request Body**:
  ```json
  {
    "vulnerabilityId": "phish-spear-01",
    "answers": [ { "questionId": 1, "selectedOption": 2 } ]
  }
  ```
- **Response** (`200 OK`): Score evaluation, explanation of correct/incorrect choices, and posture delta.

---

## 5. Email History & RAG Training (`/api/email-history`)

### 5.1 Upload Historical Legitimate Emails
- **Endpoint**: `POST /api/email-history`
- **Access**: Private (Authenticated)
- **Request Body**:
  ```json
  {
    "sender": "boss@somaiya.edu",
    "subject": "Semester Exam Timetable Review",
    "body": "Dear faculty, please review the attached schedule for semester exams.",
    "isLegitimate": true
  }
  ```
- **Response** (`201 Created`):
  ```json
  { "success": true, "message": "Email added to personalized baseline history." }
  ```
- **Background Event**: Dispatches vector embedding generation to Python ML microservice to update user's in-memory FAISS index.

---

## 6. Security Investigations & Forensic Reports (`/api/security` & `/api/email-forensics`)

### 6.1 List Active Investigations
- **Endpoint**: `GET /api/security/investigations`
- **Access**: Private (Authenticated)
- **Query Parameters**: `?riskLevel=high&limit=10&page=1`
- **Response** (`200 OK`): Paginated security investigation records.

### 6.2 Deep Email Forensics Analysis
- **Endpoint**: `POST /api/email-forensics/analyze`
- **Access**: Private (Authenticated)
- **Request Body**: Multipart form data with `.eml` file OR raw email header/body text.
- **Response** (`200 OK`): Complete forensic breakdown: SPF/DKIM/DMARC status, hop-by-hop Received header route timeline, attachment SHA-256 entropy analysis, and IOC extraction.

---

## 7. System Health Probes (`/api/health`)

- **Endpoint**: `GET /api/health`
- **Access**: Public (Bypasses rate limiting)
- **Response** (`200 OK`):
  ```json
  {
    "success": true,
    "message": "DetectIQ API is running.",
    "dbConnected": true,
    "env": "production"
  }
  ```

---

## 8. Python ML Microservice Internal Contract

Called exclusively by Express server using header `Authorization: Bearer <ML_INTERNAL_TOKEN>`.

| Endpoint | Method | Input | Output | Description |
| :--- | :--- | :--- | :--- | :--- |
| **`/health`** | `GET` | None | `{ status: "ok", model_loaded: true }` | Liveness & model readiness |
| **`/predict`** | `POST` | `{ text: "...", threshold: 0.5 }` | `{ is_phishing: bool, confidence: float }` | TF-IDF ML Inference |
| **`/embed`** | `POST` | `{ text: "..." }` | `{ vector: [float x 384] }` | Dense vector embedding |
| **`/retrieve`** | `POST` | `{ user_id: "...", query: "...", k: 3 }` | `{ matches: [...] }` | FAISS vector similarity search |
| **`/rag-context`**| `POST` | `{ user_id: "...", email: "..." }` | `{ context: "...", match_count: int }`| Synthesized RAG baseline prompt |
