# DetectIQ — Comprehensive Testing Strategy & Quality Assurance

---

## 1. Testing Philosophy & Test Pyramid

DetectIQ enforces strict quality gates using a multi-layer test pyramid:
- **Layer 1: Unit Tests**: Fast, isolated tests for algorithms, validators, XSS sanitizers, normalization functions, and heuristic rules.
- **Layer 2: Integration Tests**: Supertest HTTP evaluations across Express controllers, MongoDB schemas, and authentication cookies.
- **Layer 3: Browser Extension Automated Suite**: Manifest V3 validation, background worker filters, in-page hover shields, Shadow DOM overlays, and popup controller state machine.
- **Layer 4: Live Cloud E2E & Threat Matrix**: Live network tests against the deployed Render cloud backend (`https://detectiq-api.onrender.com`).

---

## 2. Test Execution Commands

| Target | Command | Test Count | Description |
| :--- | :--- | :---: | :--- |
| **All Tests** | `npm run test:all` | **359 Tests** | Master runner executing both Vitest and Extension suites. |
| **Vitest Platform** | `npm test` | **326 Tests** | Backend APIs, DB models, enrichment, and frontend components. |
| **Extension Suite** | `npm run test:extension` | **33 Tests** | MV3 specifications, background worker, alerts, and live cloud E2E. |

---

## 3. Test Suites Directory Map

### 3.1 Backend & Frontend Platform (`vitest run` — 36 Files)
- `server/tests/userProfile.test.js`: Profile update, password change, bcrypt validation.
- `server/tests/unifiedScanner.test.js`: Multi-channel scan input validation (`url`, `email`, `sms`, `qr`, `screenshot`).
- `server/tests/scanner.test.js`: Core heuristic gate and signal counting.
- `server/tests/evidenceFusion.test.js`: Multi-source signal weighting and threat score calculation.
- `server/tests/urlVerdictConsistency.test.js`: Consistency across edge-case combinations.
- `server/tests/ragIntegration.test.js`: Personalized RAG data flow and FAISS similarity lookup.
- `server/tests/threatIntel.test.js`: VirusTotal, PhishDestroy, and threat intelligence service integration.
- `server/tests/enrichment.test.js`: Indicator extraction, normalization, and private IP filtering.
- `server/tests/forensics.test.js` & `api_forensics.test.js`: EML email parser and forensic report generator.
- `server/tests/googleAuth.test.js`: Google OAuth 2.0 callback and token issuance.
- `server/tests/investigationGraph.test.js`: Telemetry graph builder and copilot queries.
- `src/components/ui/Notification.test.js`: Frontend toast alert rendering, severity tones, and dismissal.
- `src/services/apiClient.test.js`: Network error detection (`isBackendUnreachable`) and Axios timeout defaults.
- `src/utils/intelligenceMapping.test.js`: Threat map coordinate parsing and VirusTotal status mapping.
- `src/utils/urlValidation.test.js`: URL protocol normalization and XSS script protocol blocking.

### 3.2 Browser Extension Automated Suite (`node extension/tests/run-all.js` — 8 Files)
- `extension/tests/manifest.test.js`: Manifest V3 compliance, permissions, host permissions, and icon assets.
- `extension/tests/api-unit.test.js`: `DetectIQApi` client, storage fallback, score boundaries, and offline heuristic engine.
- `extension/tests/background-unit.test.js`: Typosquatting regex, download inspector, badge thresholds, and LRU cache eviction.
- `extension/tests/popup-ui.test.js`: DOM structure, preset switcher (`Cloud (Render)` ↔ `Localhost:5000`).
- `extension/tests/alerts-and-overlays.test.js`: Hover shield link inspector, form credential phishing banner, webmail shield, and `blocked.html` query parameter parser.
- `extension/tests/rate-limiting.test.js`: Anti-brute-force threshold enforcement (HTTP 429).
- `extension/tests/live-cloud-e2e.test.js`: Real-time cloud health probe and basic scan verification.
- `extension/tests/cloud-threat-matrix.test.js`: Multi-vector live cloud scans (GitHub, MDN, credential harvesting, banking smishing, urgent invoices).

---

## 4. Continuous Quality Assurance

To verify that changes have not caused regressions before pushing to GitHub:
```bash
# 1. Run full test suite
npm run test:all

# 2. Check code linting
npm run lint
```
