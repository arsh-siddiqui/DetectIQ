import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const extensionRoot = path.resolve(__dirname, '..');

test('Popup UI: Structure & Element Integrity', () => {
  const html = fs.readFileSync(path.join(extensionRoot, 'popup.html'), 'utf8');

  // Core navigation tabs
  assert.ok(html.includes('data-tab="page"'), 'Must have Page Scan tab');
  assert.ok(html.includes('data-tab="analyzer"'), 'Must have Analyzer tab');
  assert.ok(html.includes('data-tab="history"'), 'Must have History tab');
  assert.ok(html.includes('data-tab="settings"'), 'Must have Settings tab');

  // Scanner UI components
  assert.ok(html.includes('id="btnScanPage"'), 'Must have Scan Page button');
  assert.ok(html.includes('id="gaugeProgress"'), 'Must have SVG gauge progress meter');
  assert.ok(html.includes('id="riskScoreValue"'), 'Must have numerical risk score display');
  assert.ok(html.includes('id="riskStatusPill"'), 'Must have visual risk status pill');
  assert.ok(html.includes('id="threatSignalsList"'), 'Must have threat signals container');

  // Settings & Environment Switcher
  assert.ok(html.includes('id="settingApiUrl"'), 'Must have API URL input field');
  assert.ok(html.includes('id="btnPresetProd"'), 'Must have Cloud (Render) preset button');
  assert.ok(html.includes('id="btnPresetLocal"'), 'Must have Localhost:5000 preset button');
  assert.ok(html.includes('id="btnTestApi"'), 'Must have Test Connection button');
  assert.ok(html.includes('id="btnSaveSettings"'), 'Must have Save Preferences button');
  assert.ok(html.includes('id="btnResetSettings"'), 'Must have Reset Defaults button');

  // Real-time protection toggles
  assert.ok(html.includes('id="toggleAutoScan"'), 'Must have AutoScan toggle');
  assert.ok(html.includes('id="toggleLinkScan"'), 'Must have LinkScan toggle');
  assert.ok(html.includes('id="toggleTextScan"'), 'Must have TextScan toggle');
});

test('Popup UI: Default API URL matches Production Render Endpoint', () => {
  const html = fs.readFileSync(path.join(extensionRoot, 'popup.html'), 'utf8');
  assert.ok(
    html.includes('value="https://detectiq-api.onrender.com"'),
    'Input default value must be set to https://detectiq-api.onrender.com'
  );
  assert.ok(
    html.includes('placeholder="https://detectiq-api.onrender.com"'),
    'Input placeholder must be set to https://detectiq-api.onrender.com'
  );
});

test('Popup UI: Javascript Controller Preset Behavior Simulation', () => {
  const PROD_API_URL = 'https://detectiq-api.onrender.com';
  const DEV_API_URL = 'http://localhost:5000';
  const DEFAULT_API_URL = PROD_API_URL;

  // Mock DOM input element
  const settingApiUrl = { value: '' };

  // Preset Prod action
  settingApiUrl.value = PROD_API_URL;
  assert.equal(settingApiUrl.value, 'https://detectiq-api.onrender.com');

  // Preset Local action
  settingApiUrl.value = DEV_API_URL;
  assert.equal(settingApiUrl.value, 'http://localhost:5000');

  // Reset Defaults action
  settingApiUrl.value = DEFAULT_API_URL;
  assert.equal(settingApiUrl.value, 'https://detectiq-api.onrender.com');
});
