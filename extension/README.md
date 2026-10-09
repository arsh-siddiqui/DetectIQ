# 🛡 DetectIQ Browser Extension (Manifest V3)

A production-grade, SaaS-styled cybersecurity browser extension for real-time threat intelligence, deterministic heuristic inspection, URL safety verification, Quishing (QR code) defense, and phishing protection powered by DetectIQ.

---

## 🎨 Design System & Visual Features

- **Light SaaS Theme**: Polished interface (`#F8FAFC` slate background, `#FFFFFF` crisp cards, `#2563EB` primary blue, `#10B981` emerald, `#F59E0B` warning amber, `#EF4444` threat crimson).
- **Interactive SVG Risk Meter**: Dynamic semi-circle gauge displaying numerical score (`0 - 100`) and clear visual status pills (`SAFE`, `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`).
- **Indicator Signals Grid**: Categorized threat signals with icons, clean badges, and human-friendly security translations (translating raw keys like `urgency` or `credential_path` into clear, readable rationales).
- **Manual Content Analyzer**: Dedicated tab with sub-tabs (`[ URL ] [ EMAIL ] [ TEXT ] [ QR CODE ]`), character count, step-by-step progress animation, and detailed result breakdowns.
- **Enlarged In-Page Security Guard Modal**: Draggable, 395px responsive Shadow DOM card with animated progress risk gauge, customized slim scrollbars, color-coded bullets, and context-tailored verdict recommendations (`this URL` vs `this message`).
- **Reactive Webmail Safety Shield**: Powered by a zero-polling `MutationObserver` on Gmail (`mail.google.com`) and Outlook for instant inline pill injection and one-click email analysis.
- **Quishing Defense (QR Image Scanner)**: In-popup drag-and-drop scanner + right-click context menu image scanner using client-side offline decoding (`jsQR` + `OffscreenCanvas`) with zero image transmission.
- **Extension Status Badge**: Dynamic badge on browser toolbar icon (`SAFE`, `WARN`, `RISK`, `CRIT`).
- **Resilient Cloud & Offline Architecture**: Automatic keep-alive heartbeat alarm every 10 minutes to prevent Render free-tier cold sleep, 1.5s auto-retry on network interruption, and seamless offline heuristic fallback.

---

## 📁 Extension Architecture

```
extension/
├── manifest.json       # Manifest V3 setup, permissions & CSP
├── popup.html          # Main extension control center UI
├── popup.css           # Light SaaS design system stylesheet
├── popup.js            # Popup state machine & active tab scanner
├── background.js       # Background service worker (badge, keep-alive & context menus)
├── content.js          # Shadow DOM in-page floating threat overlay & MutationObserver shield
├── content.css         # Scoped styling for isolated Shadow DOM webpage overlays
├── api.js              # Universal DetectIQ API client & offline heuristic engine
├── blocked.html        # Pre-navigation critical threat block warning page
├── lib/
│   └── jsQR.js         # Offline, client-side QR code decoding library
├── tests/              # 46 automated extension unit, integration & E2E cloud tests
│   ├── run-all.js      # Central test runner (Node.js test runner)
│   ├── manifest.test.js
│   ├── background-unit.test.js
│   ├── alerts-and-overlays.test.js
│   ├── homograph-and-qr.test.js
│   ├── cold-start-and-recovery.test.js
│   └── live-cloud-e2e.test.js
└── icons/              # Extension icons (16x16, 48x48, 128x128)
```

---

## 🚀 How to Install & Test in Chrome / Edge / Brave

1. Open your browser and navigate to the Extensions management page:
   - **Chrome / Brave**: `chrome://extensions`
   - **Edge**: `edge://extensions`
2. Enable **Developer mode** (toggle switch in the top-right corner).
3. Click **Load unpacked** button.
4. Select the `extension/` folder located inside your `DETECTIQ` project directory:
   `d:\detectiq-fullstack\DETECTIQ\extension`
5. Pin the **DetectIQ** extension to your browser toolbar!

---

## 🛠 Testing Extension Workflows

1. **Active Tab Page Guard**:
   - Open any website (e.g. `https://google.com` or any local page).
   - Click the **DetectIQ** extension icon in your toolbar.
   - Click **Scan Page** to trigger real-time inspection.

2. **Webmail Safety Shield (Gmail & Outlook)**:
   - Open Gmail (`https://mail.google.com`) or Outlook.
   - Open any email thread. DetectIQ instantly injects the **DetectIQ Email Shield** banner into the email header via a reactive `MutationObserver`.
   - Click **"Analyze Email with DetectIQ Engine"** to review the email's risk score and threat indicators inside the floating Security Guard card.

3. **Context Menu Image QR Code Scanner (Quishing Protection)**:
   - Right-click any QR code image on any webpage or email.
   - Select **"🛡 Scan image for malicious QR code"**.
   - DetectIQ extracts the embedded destination link in-memory using `OffscreenCanvas` and `jsQR`, and automatically scans the target for phishing or malicious redirects.

4. **Right-Click Context Menu Link & Text Overlays**:
   - Highlight any suspicious text or right-click any link on a webpage.
   - Select **"🛡 Scan link with DetectIQ"** or **"🛡 Analyze text with DetectIQ"**.
   - The floating **DetectIQ Security Guard** card displays the risk score, visual meter, and bulleted security findings.

5. **IDN Homograph & Punycode Deception Engine**:
   - Detects deceptive domains mimicking trusted brands using international Punycode prefixes (`xn--`) or mixed-script Unicode characters (Cyrillic `\u0400-\u04FF` or Greek `\u0370-\u03FF` homoglyphs mimicking Latin ASCII).
   - Real-time pre-click protection in Hover Shield (`content.js`), navigation interceptor (`background.js`), and popup scanner (`api.js`).

6. **Settings & Backend Connection**:
   - Open the **Settings** tab in the popup.
   - Toggle between **Cloud (Render)** (`https://detectiq-api.onrender.com`) for production cloud demo, or **Localhost:5000** (`http://localhost:5000`) for local development.
   - Click **Test** to verify connection to the backend server.
   - *(Optional)* Paste your DetectIQ web application JWT token to automatically sync your browser scans with your central dashboard history.

---

## 🧪 Automated Test Suite

Run the full suite of **46 automated tests** (manifest checks, offline heuristics, background alarms, live cloud E2E, homoglyph detection, and Quishing decoders):

```bash
npm run test:extension
```

