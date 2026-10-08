import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const extensionRoot = path.resolve(__dirname, '..');

// Read content.js and blocked.html
const contentJs = fs.readFileSync(path.join(extensionRoot, 'content.js'), 'utf8');
const blockedHtml = fs.readFileSync(path.join(extensionRoot, 'blocked.html'), 'utf8');

test('Alerts & Overlays: Pre-Click Hover Shield Link Inspection', () => {
  // Regex patterns from content.js
  const isSuspiciousShortener = /bit\.ly|tinyurl\.com|t\.co|is\.gd|buff\.ly|ow\.ly|rebrand\.ly/i;
  const isTyposquat = /rnicrosof|g00gl|paypa1|bankofamenca|login-verify-account/i;
  const isIpHost = /^https?:\/\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/i;

  function evaluateLink(href) {
    if (href.startsWith('javascript:') || href.startsWith('#')) return null;
    const isNonHttpsCred = href.startsWith('http://') && /login|password|auth|verify|bank|account/i.test(href);

    if (isTyposquat.test(href)) return 'Deceptive typosquatting domain!';
    if (isSuspiciousShortener.test(href)) return 'Shortened URL hides true destination.';
    if (isIpHost.test(href)) return 'Direct IP host link (High Risk).';
    if (isNonHttpsCred) return 'Unencrypted credential link!';
    return null;
  }

  // 1. URL Shorteners
  assert.equal(evaluateLink('https://bit.ly/urgent-account-update'), 'Shortened URL hides true destination.');
  assert.equal(evaluateLink('https://tinyurl.com/secure-document'), 'Shortened URL hides true destination.');
  assert.equal(evaluateLink('https://t.co/redirect-now'), 'Shortened URL hides true destination.');

  // 2. Typosquatting
  assert.equal(evaluateLink('https://rnicrosoft-office365.com'), 'Deceptive typosquatting domain!');
  assert.equal(evaluateLink('https://paypa1-dispute-service.com'), 'Deceptive typosquatting domain!');
  assert.equal(evaluateLink('https://sub.login-verify-account.net'), 'Deceptive typosquatting domain!');

  // 3. Raw IP Addresses
  assert.equal(evaluateLink('http://192.168.1.100/admin'), 'Direct IP host link (High Risk).');
  assert.equal(evaluateLink('https://104.244.42.1/webmail'), 'Direct IP host link (High Risk).');

  // 4. Insecure HTTP Credential Form Links
  assert.equal(evaluateLink('http://mybank.com/login.html'), 'Unencrypted credential link!');
  assert.equal(evaluateLink('http://portal.org/verify-account'), 'Unencrypted credential link!');

  // 5. Clean URLs (No alert triggered)
  assert.equal(evaluateLink('https://github.com/explore'), null);
  assert.equal(evaluateLink('https://google.com/search?q=test'), null);
  assert.equal(evaluateLink('https://developer.mozilla.org/en-US/'), null);
  assert.equal(evaluateLink('javascript:void(0)'), null);
  assert.equal(evaluateLink('#top'), null);
});

test('Alerts & Overlays: Credential Phishing Interceptor Form Shield', () => {
  function shouldTriggerFormWarning(currentUrl, inputType, inputNameOrId) {
    const isSensitive = inputType === 'password' || /otp|pass|card|ssn|secret/i.test(inputNameOrId || '');
    if (!isSensitive) return false;

    const isHttps = currentUrl.startsWith('https://');
    const isUntrustedDomain = !isHttps || /rnicrosof|g00gl|paypa1|bankofamenca|login-verify/i.test(currentUrl);

    return isUntrustedDomain;
  }

  // Dangerous Cases: Sensitive inputs on HTTP or Typosquatted Domains
  assert.equal(shouldTriggerFormWarning('http://unencrypted-login.com', 'password', 'user_pass'), true);
  assert.equal(shouldTriggerFormWarning('https://paypa1-fake.com/login', 'password', 'pwd'), true);
  assert.equal(shouldTriggerFormWarning('http://my-service.org', 'text', 'user_otp_code'), true);
  assert.equal(shouldTriggerFormWarning('http://payment.net', 'text', 'card_number'), true);
  assert.equal(shouldTriggerFormWarning('http://tax-portal.com', 'text', 'applicant_ssn'), true);

  // Safe Cases: Sensitive inputs on legitimate HTTPS
  assert.equal(shouldTriggerFormWarning('https://github.com/login', 'password', 'password'), false);
  assert.equal(shouldTriggerFormWarning('https://google.com/signin', 'password', 'passwd'), false);

  // Non-sensitive inputs (search, comments, etc.)
  assert.equal(shouldTriggerFormWarning('http://blog.com', 'text', 'comment_body'), false);
  assert.equal(shouldTriggerFormWarning('http://news.com', 'search', 'query'), false);
});

test('Alerts & Overlays: Webmail Shield Integration Presence in content.js', () => {
  // Ensure Gmail and Outlook targeting logic exists
  assert.ok(contentJs.includes('mail.google.com'), 'Must target Gmail in content.js');
  assert.ok(contentJs.includes('outlook'), 'Must target Outlook in content.js');
  assert.ok(contentJs.includes('.a3s.aiL'), 'Must target Gmail email container selector');
  assert.ok(contentJs.includes('DetectIQ Email Shield'), 'Must render DetectIQ Email Shield pill');
  assert.ok(contentJs.includes('Analyze Email with DetectIQ Engine'), 'Must include one-click email analysis trigger');
});

test('Alerts & Overlays: Shadow DOM Isolation Architecture in content.js', () => {
  assert.ok(contentJs.includes('attachShadow({ mode: \'open\' })'), 'Must attach isolated Shadow DOM host');
  assert.ok(contentJs.includes('SHOW_LOADING_OVERLAY'), 'Must handle SHOW_LOADING_OVERLAY message');
  assert.ok(contentJs.includes('SHOW_RESULT_OVERLAY'), 'Must handle SHOW_RESULT_OVERLAY message');
  assert.ok(contentJs.includes('btnDismissFormWarn'), 'Must provide dismiss functionality for warning banners');
});

test('Alerts & Overlays: Blocked Warning Page Query Param Decoding', () => {
  // Simulate decoding parameters inside blocked.html
  function parseBlockedParams(queryString) {
    const params = new URLSearchParams(queryString);
    return {
      targetUrl: params.get('url') || 'Unknown URL',
      score: parseInt(params.get('score'), 10) || 95,
      reason: params.get('reason') || 'Deceptive malicious activity detected.'
    };
  }

  const query = '?url=https%3A%2F%2Fpaypa1-fake.com%2Flogin&score=98&reason=Critical%20typosquatting%20threat';
  const decoded = parseBlockedParams(query);

  assert.equal(decoded.targetUrl, 'https://paypa1-fake.com/login');
  assert.equal(decoded.score, 98);
  assert.equal(decoded.reason, 'Critical typosquatting threat');

  // Verify blocked.html structure
  assert.ok(blockedHtml.includes('id="targetUrl"'), 'blocked.html must have targetUrl placeholder');
  assert.ok(blockedHtml.includes('id="reasonText"'), 'blocked.html must have reasonText display');
  assert.ok(blockedHtml.includes('id="btnBypass"'), 'blocked.html must have safety bypass control');
  assert.ok(blockedHtml.includes('id="btnBackToSafety"'), 'blocked.html must have back-to-safety action');
});
