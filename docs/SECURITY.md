# DetectIQ — Security Architecture, Threat Model & Hardening Policy

---

## 1. Security Architecture & Threat Model

DetectIQ processes untrusted and potentially malicious digital inputs (phishing URLs, scam emails, obfuscated scripts, malicious attachments, and social engineering payloads). The platform is architected around **Defense in Depth**, **Least Privilege**, and **Complete Isolation of Untrusted Content**.

```
[Untrusted Web Input] ──► Input Sanitization & Length Caps (Express-Validator)
                       ──► Multi-Tier Rate Limiting (Prevents Brute-Force & Denial of Wallet)
                       ──► Dual-Mode Secure Token Authentication
                       ──► Isolated ML Inference (No Direct Shell/OS Execution)
                       ──► Deterministic Evidence Fusion
```

---

## 2. Authentication & Authorization Security

### 2.1 Dual-Mode JWT Implementation
- **Web Applications**:
  - Tokens are transmitted via `httpOnly`, `Secure` (in production), and `SameSite=None` or `Lax` cookies (`JWT_COOKIE_NAME`).
  - **Mitigation**: Protects against token theft via client-side JavaScript Cross-Site Scripting (XSS).
- **Browser Extension & CLI Tools**:
  - Authenticates using `Authorization: Bearer <token>` HTTP header.
- **Password Storage**:
  - Hashed using `bcryptjs` with salt rounds = 10.
  - Raw password field is declared `{ select: false }` in Mongoose models to prevent accidental leakage in JSON serialization.
- **Role-Based Access Control (RBAC)**:
  - Enforced via `authorize(...roles)` middleware. Administrative routes (`/api/admin/*`) require explicit role validation.

---

## 3. Microservice Security (`ML_INTERNAL_TOKEN`)

The Express gateway and the Python FastAPI ML microservice communicate over internal HTTP channels. To prevent unauthorized execution of ML prediction and vector retrieval endpoints:
- A shared secret (`ML_INTERNAL_TOKEN`) is enforced as a required header:
  ```http
  Authorization: Bearer <ML_INTERNAL_TOKEN>
  ```
- External or unauthenticated requests are rejected immediately with `403 Forbidden` (`detail: "Forbidden: Invalid or missing internal token."`).

---

## 4. Network Hardening & Origin Security

### 4.1 Strict CORS Policy
CORS access is locked down in [server/server.js](file:///d:/detectiq-fullstack/DETECTIQ/server/server.js):
```javascript
cors({
  origin: function (origin, callback) {
    if (
      !origin ||
      origin === env.FRONTEND_URL ||
      /^http:\/\/localhost:517\d$/.test(origin) ||
      /^chrome-extension:\/\/[a-z0-9]+$/.test(origin) ||
      origin.startsWith('chrome-extension://') ||
      origin.startsWith('moz-extension://')
    ) {
      callback(null, origin || true);
    } else {
      callback(null, env.FRONTEND_URL);
    }
  },
  credentials: true
})
```
- Unauthorized origins cannot access user session cookies or query internal API routes.

### 4.2 HTTP Security Headers (Helmet)
Express integrates `helmet()`, injecting standard defensive headers:
- `X-Content-Type-Options: nosniff` (prevents MIME type sniffing)
- `X-Frame-Options: SAMEORIGIN` (mitigates clickjacking)
- `Strict-Transport-Security: max-age=15552000; includeSubDomains` (enforces HTTPS)
- `X-DNS-Prefetch-Control: off`

---

## 5. Rate Limiting & Denial-of-Service Defense

Tiered rate limiting is enforced via `express-rate-limit` ([rateLimiter.js](file:///d:/detectiq-fullstack/DETECTIQ/server/middleware/rateLimiter.js)):

| Scope | Window | Quota | Defense Target |
| :--- | :--- | :--- | :--- |
| **Global `/api`** | 15 Minutes | 150 req / IP | Prevents scraping and API resource exhaustion. |
| **Auth `/api/auth`** | 15 Minutes | 15 req / IP | Defends against brute-force password guessing and credential stuffing. |
| **Scan `/api/scan`** | 1 Minute | 40 req / IP | Protects external third-party API quotas and AI token usage. |
| **Health `/api/health`**| None | Unlimited | Guaranteed uptime probe availability. |

---

## 6. Input Validation & XSS Defenses

1. **Payload Sanitization**:
   - `express-validator` validates all route inputs (types, string formats, length boundaries).
   - Payloads are capped at safe string lengths (max 5,000 to 10,000 characters).
2. **HTML Entity Sanitizer (`escapeHtml`)**:
   - The extension and frontend utilize centralized XSS escaping utilities ([api.js](file:///d:/detectiq-fullstack/DETECTIQ/extension/api.js#L222)):
   ```javascript
   static escapeHtml(str) {
     return String(str || '')
       .replace(/&/g, '&amp;')
       .replace(/</g, '&lt;')
       .replace(/>/g, '&gt;')
       .replace(/"/g, '&quot;')
       .replace(/'/g, '&#039;');
   }
   ```
   - Automatically parses nested signal objects and threat messages to prevent injection into DOM elements.
3. **Shadow DOM Isolation**:
   - Browser extension in-page overlays use closed Shadow DOM trees (`attachShadow({ mode: 'open' })`), completely isolating extension UI from host page scripts and CSS.

---

## 7. Data Privacy & Isolation

- **Tenant Boundary Enforcement**: Queries for scan history, personalized email patterns, and learning progress strictly enforce `{ userId: req.user._id }`.
- **Target URL Hashing**: Stored threat cache records use SHA-256 digests (`urlHash`) as primary lookup keys. Raw target URLs are omitted from default database projections (`select: false`).
- **No Evaluation Leakage**: Test samples used for performance evaluation are strictly barred from user FAISS memory.

---

## 8. Responsible Disclosure Policy

If you discover a security vulnerability within DetectIQ, please disclose it responsibly:
- **Email**: `security@detectiq.org` (or open a confidential GitHub Security Advisory)
- Please do not publicly disclose the issue until a patch has been released.
