# 🛡 DetectIQ Browser Extension (Manifest V3)

A production-grade, SaaS-styled cybersecurity browser extension for real-time threat intelligence, deterministic heuristic inspection, URL safety verification, and phishing protection powered by DetectIQ.

---

## 🎨 Design System & Visual Features

- **Light SaaS Theme**: Polished light interface (`#F8FAFC` slate background, `#FFFFFF` crisp cards, `#2563EB` primary blue, `#14B8A6` teal, `#F59E0B` warning accent).
- **Interactive SVG Risk Meter**: Dynamic semi-circle gauge displaying animated numerical score (`0 - 100`) and clear visual status pills (`SAFE`, `LOW`, `SUSPICIOUS`, `HIGH`, `CRITICAL`).
- **Indicator Signals Grid**: Categorized threat signals with icons, clean badges, and concise descriptions.
- **Manual Content Analyzer**: Dedicated tab with sub-tabs (`[ URL ] [ EMAIL ] [ TEXT ]`), character count, step-by-step progress animation, and detailed result breakdowns.
- **In-Page Floating Overlay**: Draggable, shadow-DOM isolated floating security card triggered via right-click context menu ("Scan link with DetectIQ" / "Analyze text with DetectIQ").
- **Extension Status Badge**: Dynamic badge on browser toolbar icon (`SAFE`, `WARN`, `RISK`, `CRIT`).
- **Settings & API Configuration**: Custom backend API endpoint (`http://localhost:5000`), real-time protection toggles, and user token authentication.

---

## 📁 Extension Architecture

```
extension/
├── manifest.json       # Manifest V3 setup & permissions
├── popup.html          # Main extension control center UI
├── popup.css           # Light SaaS design system stylesheet
├── popup.js            # Popup state machine & active tab scanner
├── background.js       # Background service worker (badge & context menus)
├── content.js          # Shadow DOM in-page floating threat overlay
├── content.css         # Scoped styling for webpage overlays
├── create_icons.cjs    # Icon generation utility
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

2. **Manual Analyzer & In-Popup QR Code Scanner**:
   - Open the **Analyzer** tab in the popup.
   - Select `URL`, `Email Text`, `Raw Text`, or `QR Code`.
   - In **QR Code** mode:
     - Drag & drop a QR code image, click to browse, or paste directly with `Ctrl+V`.
     - The extension uses local, offline JavaScript decoding (`jsQR`) to extract the destination URL without sending image data to external servers.
     - The decoded target is automatically verified against DetectIQ threat intelligence and heuristic engines.

3. **IDN Homograph & Punycode Deception Engine**:
   - Detects deceptive domains mimicking trusted brands using international Punycode prefixes (`xn--`) or mixed-script Unicode characters (Cyrillic `\u0400-\u04FF` or Greek `\u0370-\u03FF` homoglyphs mimicking Latin ASCII).
   - Real-time pre-click protection in Hover Shield (`content.js`), navigation interceptor (`background.js`), and popup scanner (`api.js`).

4. **Right-Click Context Menu Overlay**:
   - Highlight any text or right-click any link on a webpage.
   - Select **"🛡 Scan link with DetectIQ"** or **"🛡 Analyze text with DetectIQ"**.
   - Notice the floating **DetectIQ Security Card** appearing smoothly in the bottom-right corner.

5. **Settings & Backend Connection**:
   - Open the **Settings** tab.
   - Click **Cloud (Render)** (`https://detectiq-api.onrender.com`) for production cloud demo, or **Localhost:5000** (`http://localhost:5000`) for local backend development.
   - Click **Test** to verify connection to the backend server.

