# Contributing to DetectIQ

Thank you for your interest in contributing to **DetectIQ**! As an enterprise-grade cybersecurity platform combining heuristic detection, machine learning, personalized RAG, and live threat intelligence, we uphold rigorous standards for code quality, security, and test verification.

---

## 1. Code of Conduct

DetectIQ adheres to open, respectful, and collaborative communication. All contributors are expected to foster an inclusive, safe, and professional environment.

---

## 2. Development Workflow

### 2.1 Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **Python**: v3.10+ (for ML inference microservice)
- **Git**

### 2.2 Local Repository Setup
1. Fork and clone the repository:
   ```bash
   git clone https://github.com/arsh-siddiqui/DetectIQ.git
   cd DetectIQ
   ```
2. Install frontend and root dependencies:
   ```bash
   npm install
   ```
3. Set up the Express backend:
   ```bash
   cd server
   npm install
   cp .env.example .env
   # Configure MONGO_URI, JWT_SECRET, GROQ_API_KEY
   cd ..
   ```
4. Set up the Python ML microservice:
   ```bash
   cd ml
   python -m venv .venv
   # Windows:
   .\.venv\Scripts\activate
   # Linux/macOS:
   source .venv/bin/activate
   pip install -r requirements.txt
   cd ..
   ```

---

## 3. Testing Requirements (Mandatory)

DetectIQ requires all automated test suites to pass with **zero regressions** before any pull request is merged:

```bash
# Run entire test suite (Vitest + Extension tests)
npm run test:all

# Run Vitest unit & integration test suite (326 tests)
npm test

# Run Browser Extension automated test suite (33 tests)
npm run test:extension

# Run fast code linting
npm run lint
```

### Writing New Tests
- **Frontend / React Components**: Add unit tests under `src/components/**/__tests__` or alongside the component file with `.test.js` or `.test.jsx`.
- **Backend Services**: Add unit tests in `server/tests/`. Ensure network requests to third-party threat intelligence APIs are mocked using deterministic fixtures.
- **Browser Extension**: Add test cases to `extension/tests/` and register them in `extension/tests/run-all.js`.

---

## 4. Coding Standards & Conventions

### 4.1 Security & Safety Best Practices
- **No Hardcoded Secrets**: Never commit API keys, JWT secrets, or connection strings. Use environment variables defined in `.env.example`.
- **Input Sanitization**: Always validate and sanitize user inputs using `express-validator` and `escapeHtml`.
- **Defense in Depth**: Every external API call (VirusTotal, PhishDestroy, Groq) must feature timeouts and defensive `try/catch` fallbacks to avoid blocking scans.

### 4.2 Commit Message Guidelines
We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:
- `feat: add live DNS over HTTPS resolution to scanner`
- `fix: correct scanType normalization for browser extension`
- `docs: update API contract for threat intelligence response`
- `test: add unit tests for notification toast system`
- `refactor: modularize evidence fusion risk scoring weights`

---

## 5. Pull Request Process

1. Create a descriptive branch:
   ```bash
   git checkout -b feat/your-feature-name
   ```
2. Implement your changes adhering to existing architecture.
3. Verify all tests pass locally:
   ```bash
   npm run test:all
   ```
4. Push to your branch and submit a Pull Request to `main`.
5. Provide a clear description detailing the problem solved, design trade-offs, and proof of passing tests.

---

## 6. Security Vulnerability Reporting

If you discover a potential security vulnerability within DetectIQ, **please do not open a public GitHub issue**. Instead, follow the responsible disclosure procedure outlined in [SECURITY.md](SECURITY.md) or contact the core maintainers directly at `security@detectiq.dev`.
