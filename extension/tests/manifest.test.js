import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const extensionRoot = path.resolve(__dirname, '..');

test('Manifest V3: JSON Syntax & Core Specification', () => {
  const manifestPath = path.join(extensionRoot, 'manifest.json');
  assert.ok(fs.existsSync(manifestPath), 'manifest.json must exist in extension directory');

  const raw = fs.readFileSync(manifestPath, 'utf8');
  let manifest;
  assert.doesNotThrow(() => {
    manifest = JSON.parse(raw);
  }, 'manifest.json must be valid JSON');

  assert.equal(manifest.manifest_version, 3, 'Manifest version must be MV3');
  assert.ok(manifest.name && manifest.name.includes('DetectIQ'), 'Name must include DetectIQ');
  assert.ok(manifest.version, 'Version must be declared');
  assert.ok(manifest.description, 'Description must be declared');
});

test('Manifest V3: Permissions & Host Permissions', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(extensionRoot, 'manifest.json'), 'utf8'));

  const expectedPermissions = [
    'activeTab',
    'tabs',
    'scripting',
    'storage',
    'contextMenus',
    'webNavigation',
    'downloads',
    'notifications',
    'alarms'
  ];

  for (const perm of expectedPermissions) {
    assert.ok(manifest.permissions.includes(perm), `Missing required permission: ${perm}`);
  }

  assert.ok(Array.isArray(manifest.host_permissions), 'host_permissions must be an array');
  assert.ok(manifest.host_permissions.includes('<all_urls>'), 'host_permissions must include <all_urls> for universal URL inspection');
});

test('Manifest V3: Referenced File Assets Exist on Disk', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(extensionRoot, 'manifest.json'), 'utf8'));

  // Background service worker
  assert.ok(manifest.background?.service_worker, 'Service worker must be declared');
  const bgPath = path.join(extensionRoot, manifest.background.service_worker);
  assert.ok(fs.existsSync(bgPath), `Background script ${manifest.background.service_worker} must exist`);

  // Action popup
  assert.ok(manifest.action?.default_popup, 'default_popup must be declared');
  const popupPath = path.join(extensionRoot, manifest.action.default_popup);
  assert.ok(fs.existsSync(popupPath), `Popup file ${manifest.action.default_popup} must exist`);

  // Action & root icons
  for (const size of ['16', '48', '128']) {
    const iconRel = manifest.icons?.[size];
    assert.ok(iconRel, `Icon ${size} must be defined in icons object`);
    assert.ok(fs.existsSync(path.join(extensionRoot, iconRel)), `Icon file ${iconRel} must exist`);

    const actionIconRel = manifest.action?.default_icon?.[size];
    assert.ok(actionIconRel, `Icon ${size} must be defined in action.default_icon`);
    assert.ok(fs.existsSync(path.join(extensionRoot, actionIconRel)), `Action icon file ${actionIconRel} must exist`);
  }

  // Content scripts
  assert.ok(Array.isArray(manifest.content_scripts) && manifest.content_scripts.length > 0, 'content_scripts must have at least one entry');
  for (const cs of manifest.content_scripts) {
    assert.ok(cs.matches.includes('<all_urls>'), 'content_scripts must match <all_urls>');
    for (const jsFile of cs.js || []) {
      assert.ok(fs.existsSync(path.join(extensionRoot, jsFile)), `Content JS file ${jsFile} must exist`);
    }
    for (const cssFile of cs.css || []) {
      assert.ok(fs.existsSync(path.join(extensionRoot, cssFile)), `Content CSS file ${cssFile} must exist`);
    }
  }

  // Warning blocked page
  assert.ok(fs.existsSync(path.join(extensionRoot, 'blocked.html')), 'blocked.html must exist for phishing interceptor');
});
