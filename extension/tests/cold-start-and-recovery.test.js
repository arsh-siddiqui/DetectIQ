import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const extensionRoot = path.resolve(__dirname, '..');

await import('../api.js');
const DetectIQApi = globalThis.DetectIQApi;

const CLOUD_API_URL = 'https://detectiq-api.onrender.com';
const EXTENSION_ORIGIN = 'chrome-extension://nkbihfbeogaeaoehlefnkodbefgpgknn';

test('Cold Start & Recovery 1: Live Cloud Health Probe (GET /api/health)', async () => {
  const response = await fetch(`${CLOUD_API_URL}/api/health`, {
    headers: { 'Origin': EXTENSION_ORIGIN }
  });

  assert.equal(response.status, 200, 'Health endpoint must respond with HTTP 200');
  const data = await response.json();
  assert.equal(data.success, true, 'Health check must return success: true');
  assert.equal(data.dbConnected, true, 'Database must be connected');
  assert.equal(data.env, 'production', 'Environment must be production');
});

test('Cold Start & Recovery 2: CORS Preflight (OPTIONS /api/scan) allows Chrome Extension Origin', async () => {
  const response = await fetch(`${CLOUD_API_URL}/api/scan`, {
    method: 'OPTIONS',
    headers: {
      'Origin': EXTENSION_ORIGIN,
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type'
    }
  });

  assert.equal(response.status, 204, 'Preflight OPTIONS must respond with 204 No Content');
  const allowOrigin = response.headers.get('access-control-allow-origin');
  assert.equal(allowOrigin, EXTENSION_ORIGIN, 'CORS must allow chrome-extension origin');
  const allowCredentials = response.headers.get('access-control-allow-credentials');
  assert.equal(allowCredentials, 'true', 'Credentials must be allowed for extension communication');
});

test('Cold Start & Recovery 3: Live Cloud Scan for mail.google.com (Gmail URL)', async () => {
  const response = await fetch(`${CLOUD_API_URL}/api/scan`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Origin': EXTENSION_ORIGIN
    },
    body: JSON.stringify({
      scanType: 'url',
      content: 'https://mail.google.com/mail/u/0/#inbox'
    })
  });

  assert.equal(response.status, 200, 'Gmail scan must succeed with 200 OK');
  const data = await response.json();
  assert.equal(data.success, true);
  const result = data.data.result;
  assert.equal(result.classification, 'legitimate');
  assert.equal(result.riskLevel, 'safe');
  assert.ok(result.riskScore < 20, 'Authentic Gmail URL must have a low risk score');
  assert.ok(Array.isArray(result.reasons) && result.reasons.length > 0, 'Must include threat evaluation signals');
});

test('Cold Start & Recovery 4: Live Cloud Scan for detectiq-api.onrender.com (Self Domain)', async () => {
  const response = await fetch(`${CLOUD_API_URL}/api/scan`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Origin': EXTENSION_ORIGIN
    },
    body: JSON.stringify({
      scanType: 'url',
      content: 'https://detectiq-api.onrender.com'
    })
  });

  assert.equal(response.status, 200, 'Self API scan must return 200 OK');
  const data = await response.json();
  assert.equal(data.success, true);
  assert.ok(data.data.result, 'Must include scan result');
  assert.ok(data.data.result.riskScore <= 30, 'DetectIQ API domain must be classified as safe');
});

test('Cold Start & Recovery 5: Extension API Client performScan handles Live Cloud without fallback', async () => {
  const scan = await DetectIQApi.performScan('url', 'https://mail.google.com');

  assert.equal(scan.success, true, 'performScan must report success: true');
  assert.equal(scan.isOfflineFallback, false, 'Live scan must not drop into offline fallback');
  assert.equal(typeof scan.score, 'number');
  assert.ok(scan.score < 25, 'Legitimate domain must produce safe score');
  assert.ok(scan.verdict, 'Verdict must be populated');
  assert.ok(scan.recommendation, 'Actionable recommendation must be populated');
});

test('Cold Start & Recovery 6: Extension Background Keep-Alive Alarm Configuration', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(extensionRoot, 'manifest.json'), 'utf8'));
  assert.ok(manifest.permissions.includes('alarms'), 'manifest.json must include alarms permission');

  const bgCode = fs.readFileSync(path.join(extensionRoot, 'background.js'), 'utf8');
  assert.ok(bgCode.includes('detectiq-keepalive'), 'background.js must register detectiq-keepalive alarm');
  assert.ok(bgCode.includes('periodInMinutes: 10'), 'Keep-alive alarm must fire every 10 minutes');
  assert.ok(bgCode.includes('healthCheck()'), 'Keep-alive alarm must ping healthCheck');
});

test('Cold Start & Recovery 7: Popup UI Script Auto-Recovery and Timeout Tolerance', () => {
  const popupCode = fs.readFileSync(path.join(extensionRoot, 'popup.js'), 'utf8');
  assert.ok(popupCode.includes('wakeTimer'), 'popup.js must contain wakeTimer for cold-start UX');
  assert.ok(popupCode.includes('Retrying...'), 'popup.js retry button must show real-time feedback');
  assert.ok(popupCode.includes('whitelistedDomains'), 'popup.js must check whitelistedDomains');
  assert.ok(popupCode.includes('Verified Trusted Domain'), 'popup.js must render trusted status immediately for whitelisted sites');

  const apiCode = fs.readFileSync(path.join(extensionRoot, 'api.js'), 'utf8');
  assert.ok(apiCode.includes('35000'), 'api.js must configure 35-second cold-start tolerance');
  assert.ok(apiCode.includes('Auto-retrying cloud engine in 1.5s'), 'api.js must include auto-retry backoff');
});
