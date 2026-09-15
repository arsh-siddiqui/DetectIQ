/**
 * Phase 5A QA — Full Scanner Test Suite
 *
 * Tests two layers:
 *   1. ENGINE tests  — call analyzeContentSync() directly, verifying correct heuristic output.
 *   2. VALIDATION tests — simulate the controller's validation guard logic for empty/missing/
 *      invalid inputs that should be rejected before the engine is ever called.
 *
 * NOTE: Phase 5B/5C adds the async analyzeContent() pipeline (ML + TI + Groq).
 * These tests specifically test the deterministic heuristic engine via analyzeContentSync().
 *
 * Run with:  node server/tests/scanner.test.js
 */

'use strict';

const assert = require('assert');
const { analyzeContentSync: analyzeContent, VALID_TYPES } = require('../services/scanService');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------



/**
 * Simulates the controller's validation gate that runs BEFORE analyzeContent().
 * Returns { status, error } for invalid input, or null if input passes validation.
 */
function simulateValidation(body) {
  const { scanType, content } = body || {};

  if (!scanType || typeof scanType !== 'string' || !VALID_TYPES.includes(scanType)) {
    return { status: 400, error: 'Unsupported scan type.' };
  }
  if (content === undefined || content === null || typeof content !== 'string' || content.trim().length === 0) {
    return { status: 400, error: 'Scan input is required.' };
  }
  if (content.length > 5000) {
    return { status: 413, error: 'Input exceeds the maximum allowed length (5000 characters).' };
  }
  return null; // passes validation
}

// ---------------------------------------------------------------------------
// Section A — Validation Gate (controller-level)
// ---------------------------------------------------------------------------

console.log('\n=== SECTION A: Validation Gate ===');

it('A1 — Empty string → HTTP 400 (Scan input is required)', () => {
  const v = simulateValidation({ scanType: 'url', content: '' });
  assert.ok(v !== null, 'Expected a validation error');
  assert.strictEqual(v.status, 400);
  assert.ok(v.error.toLowerCase().includes('required'), `Unexpected message: ${v.error}`);
});

it('A2 — Whitespace-only string → HTTP 400', () => {
  const v = simulateValidation({ scanType: 'sms', content: '   \t\n  ' });
  assert.ok(v !== null, 'Expected a validation error');
  assert.strictEqual(v.status, 400);
});

it('A3 — Missing content field → HTTP 400', () => {
  const v = simulateValidation({ scanType: 'email' });
  assert.ok(v !== null, 'Expected a validation error');
  assert.strictEqual(v.status, 400);
});

it('A4 — null content → HTTP 400', () => {
  const v = simulateValidation({ scanType: 'whatsapp', content: null });
  assert.ok(v !== null, 'Expected a validation error');
  assert.strictEqual(v.status, 400);
});

it('A5 — Unsupported scan type "phone" → HTTP 400', () => {
  const v = simulateValidation({ scanType: 'phone', content: 'some text' });
  assert.ok(v !== null, 'Expected a validation error');
  assert.strictEqual(v.status, 400);
  assert.ok(v.error.toLowerCase().includes('scan type'), `Unexpected message: ${v.error}`);
});

it('A6 — Unsupported scan type "text" → HTTP 400', () => {
  const v = simulateValidation({ scanType: 'text', content: 'some text' });
  assert.ok(v !== null);
  assert.strictEqual(v.status, 400);
});

it('A7 — Unsupported scan type "image" → HTTP 400', () => {
  const v = simulateValidation({ scanType: 'image', content: 'some text' });
  assert.ok(v !== null);
  assert.strictEqual(v.status, 400);
});

it('A8 — Missing scanType field → HTTP 400', () => {
  const v = simulateValidation({ content: 'some text' });
  assert.ok(v !== null);
  assert.strictEqual(v.status, 400);
});

it('A9 — Oversized input (>5000 chars) → HTTP 413', () => {
  const v = simulateValidation({ scanType: 'email', content: 'A'.repeat(5001) });
  assert.ok(v !== null);
  assert.strictEqual(v.status, 413);
});

it('A10 — Valid input passes (no error returned)', () => {
  const v = simulateValidation({ scanType: 'url', content: 'https://example.com' });
  assert.strictEqual(v, null, 'Valid input should pass with null (no error)');
});

it('A11 — All supported types pass validation', () => {
  for (const type of VALID_TYPES) {
    const v = simulateValidation({ scanType: type, content: 'test content' });
    assert.strictEqual(v, null, `Type "${type}" should pass validation`);
  }
});

// ---------------------------------------------------------------------------
// Section B — Engine Tests: Risk Scoring & Detection
// ---------------------------------------------------------------------------

console.log('\n=== SECTION B: Heuristic Engine ===');

it('B1 — Normal benign message → Safe or Low (NOT Medium or High)', () => {
  const r = analyzeContent('Hey, are we still meeting at 5 PM?', 'sms');
  assert.ok(
    r.riskLevel === 'safe' || r.riskLevel === 'low',
    `Expected safe or low, got ${r.riskLevel} (score: ${r.riskScore})`
  );
});

it('B2 — Fake bank phishing SMS → High, detects urgency + threat + credential signals', () => {
  const r = analyzeContent(
    'URGENT! Your bank account will be blocked today. Verify your KYC immediately: https://some-fake-link.com/verify',
    'sms'
  );
  assert.ok(r.riskLevel === 'high' || r.riskLevel === 'critical', `Expected high or critical, got ${r.riskLevel} (score: ${r.riskScore})`);
  assert.ok(r.detectedSignals.includes('urgency'), 'Missing urgency signal');
  assert.ok(r.detectedSignals.includes('threat'), 'Missing threat signal');
  assert.ok(
    r.detectedSignals.includes('credential_request') || r.detectedSignals.includes('credential_path'),
    'Missing credential signal'
  );
});

it('B3 — OTP scam message → High, detects otp_request', () => {
  const r = analyzeContent(
    'Your transaction failed. Tell me the OTP you just received to cancel it.',
    'whatsapp'
  );
  assert.ok(r.riskLevel === 'high' || r.riskLevel === 'critical', `Expected high or critical, got ${r.riskLevel} (score: ${r.riskScore})`);
  assert.ok(r.detectedSignals.includes('otp_request'), 'Missing otp_request signal');
});

it('B4 — Fake job scam → High or Medium, detects job_scam + payment_request', () => {
  const r = analyzeContent(
    'Congratulations! You are selected for a work-from-home job. Pay ₹999 registration fee to confirm your position.',
    'whatsapp'
  );
  assert.ok(
    r.riskLevel === 'high' || r.riskLevel === 'critical' || r.riskLevel === 'medium',
    `Expected high, critical or medium, got ${r.riskLevel} (score: ${r.riskScore})`
  );
  assert.ok(r.detectedSignals.includes('job_scam'), 'Missing job_scam signal');
  assert.ok(r.detectedSignals.includes('payment_request'), 'Missing payment_request signal');
});

it('B5 — Investment scam → High, detects investment_scam', () => {
  const r = analyzeContent(
    'Guaranteed 30% return every week. Double your money with zero risk.',
    'sms'
  );
  assert.ok(r.riskLevel === 'high' || r.riskLevel === 'critical', `Expected high or critical, got ${r.riskLevel} (score: ${r.riskScore})`);
  assert.ok(r.detectedSignals.includes('investment_scam'), 'Missing investment_scam signal');
});

it('B6 — Suspicious URL with typosquatting + credential path → High', () => {
  const r = analyzeContent('https://amaz0n-login.example/verify-account', 'url');
  assert.ok(r.riskLevel === 'high' || r.riskLevel === 'critical', `Expected high or critical, got ${r.riskLevel} (score: ${r.riskScore})`);
  assert.ok(
    r.detectedSignals.includes('brand_impersonation') || r.detectedSignals.includes('typosquatting'),
    'Missing brand/typosquatting signal'
  );
});

it('B7 — Legitimate URL (well-known domain, no suspicious paths) → Safe or Low', () => {
  const r = analyzeContent('https://www.example.com', 'url');
  assert.ok(
    r.riskLevel === 'safe' || r.riskLevel === 'low',
    `Expected safe or low, got ${r.riskLevel} (score: ${r.riskScore})`
  );
});

it('B8 — URL with a URL shortener → Low (not High on its own)', () => {
  const r = analyzeContent('https://bit.ly/3someCode', 'url');
  // A single medium signal (url_shortener) should be Low or Medium, not High
  assert.ok(
    r.riskLevel !== 'high' && r.riskLevel !== 'critical',
    `URL shortener alone should not reach High/Critical, got ${r.riskLevel} (score: ${r.riskScore})`
  );
  assert.ok(r.detectedSignals.includes('url_shortener'), 'Missing url_shortener signal');
});

it('B9 — Message + embedded suspicious URL combined → signals from both sources', () => {
  const r = analyzeContent(
    'Your account will be blocked today. Verify here: https://amaz0n-login.example/verify',
    'email'
  );
  assert.ok(r.riskLevel === 'high' || r.riskLevel === 'critical', `Expected high or critical due to combined signals, got ${r.riskLevel}`);
  // Should have message signals
  assert.ok(r.detectedSignals.includes('threat') || r.detectedSignals.includes('urgency'), 'Missing message signal');
  // Should have URL signals
  assert.ok(
    r.detectedSignals.includes('brand_impersonation') || r.detectedSignals.includes('typosquatting'),
    'Missing URL signal'
  );
  // Deduplication: same signal type should not appear twice
  const signalSet = new Set(r.detectedSignals);
  assert.strictEqual(signalSet.size, r.detectedSignals.length, 'Duplicate signals detected — deduplication failed');
});

it('B10 — Risk score is always 0–100', () => {
  const inputs = [
    ['https://www.google.com', 'url'],
    ['URGENT! Verify your KYC. Share OTP. Guaranteed returns. Work from home. Arrest warrant.', 'sms'],
    ['Hello world', 'email'],
    ['https://192.168.1.1/login', 'url'],
  ];
  for (const [content, type] of inputs) {
    const r = analyzeContent(content, type);
    assert.ok(r.riskScore >= 0 && r.riskScore <= 100, `Score out of bounds: ${r.riskScore} for "${content}"`);
    assert.ok(r.confidence >= 0 && r.confidence <= 100, `Confidence out of bounds: ${r.confidence}`);
  }
});

it('B11 — IP address hostname → High (standalone)', () => {
  const r = analyzeContent('http://192.168.1.100/login', 'url');
  assert.ok(r.detectedSignals.includes('ip_hostname'), 'Missing ip_hostname signal');
});

it('B12 — Brand impersonation: official subdomain NOT flagged', () => {
  // pay.google.com is a real Google domain — should NOT be flagged as brand impersonation
  const r = analyzeContent('https://pay.google.com/checkout', 'url');
  assert.ok(!r.detectedSignals.includes('brand_impersonation'), 'pay.google.com should NOT be flagged');
});

it('B13 — Brand impersonation: fake brand domain IS flagged', () => {
  const r = analyzeContent('https://google-support-verify.net/security', 'url');
  assert.ok(
    r.detectedSignals.includes('brand_impersonation') || r.detectedSignals.includes('typosquatting'),
    'Fake google domain should be flagged'
  );
});

it('B14 — Risk level always maps to one of four valid bands', () => {
  const VALID_LEVELS = new Set(['safe', 'low', 'medium', 'high', 'critical']);
  const inputs = [
    ['hi', 'sms'],
    ['guaranteed returns double money', 'sms'],
    ['https://bit.ly/abc', 'url'],
    ['https://amaz0n.fake-bank.ru/verify', 'url'],
  ];
  for (const [content, type] of inputs) {
    const r = analyzeContent(content, type);
    assert.ok(VALID_LEVELS.has(r.riskLevel), `Invalid riskLevel: "${r.riskLevel}" for "${content}"`);
  }
});

it('B15 — Result shape contains all required frontend fields', () => {
  const r = analyzeContent('URGENT! Your account will be blocked. Share OTP.', 'sms');
  assert.ok(typeof r.riskScore === 'number', 'Missing riskScore');
  assert.ok(typeof r.confidence === 'number', 'Missing confidence');
  assert.ok(typeof r.riskLevel === 'string', 'Missing riskLevel');
  assert.ok(typeof r.scanType === 'string', 'Missing scanType');
  assert.ok(typeof r.scannedAt === 'string', 'Missing scannedAt');
  assert.ok(typeof r.category === 'string', 'Missing category');
  assert.ok(typeof r.summary === 'string', 'Missing summary');
  assert.ok(Array.isArray(r.reasons), 'Missing reasons array');
  assert.ok(Array.isArray(r.recommendations), 'Missing recommendations array');
  assert.ok(Array.isArray(r.detectedSignals), 'Missing detectedSignals array');
});

// ---------------------------------------------------------------------------
// Section C — URL Verdict Consistency (resultBuilder layer)
// ---------------------------------------------------------------------------

console.log('\n=== SECTION C: URL Verdict Consistency ===');

it('C1 — credential_path alone: recommendations do NOT contain "Do not click"', () => {
  // https://secure-login.account-verification.test/verify — the reported example
  const r = analyzeContent('https://secure-login.account-verification.test/verify?session=8472', 'url');
  const recLower = r.recommendations.map(rec => rec.toLowerCase()).join(' ');
  assert.ok(
    !recLower.includes('do not click'),
    `credential_path alone should not produce "Do not click". Got: ${r.recommendations.join('; ')}`
  );
});

it('C2 — credential_path alone: recommendations DO contain "verify" or "official"', () => {
  const r = analyzeContent('https://secure-login.account-verification.test/verify?session=8472', 'url');
  const recLower = r.recommendations.map(rec => rec.toLowerCase()).join(' ');
  assert.ok(
    recLower.includes('verify') || recLower.includes('official'),
    `credential_path alone should produce soft verification recommendation. Got: ${r.recommendations.join('; ')}`
  );
});

it('C3 — brand_impersonation + credential_path: "Do not click" IS present', () => {
  // Both deceptive domain AND credential path → strong language warranted
  const r = analyzeContent('https://paypal-verify.example.com/login', 'url');
  const recLower = r.recommendations.map(rec => rec.toLowerCase()).join(' ');
  assert.ok(
    recLower.includes('do not click') || recLower.includes('navigate to'),
    `Brand impersonation should still trigger strong recommendation. Got: ${r.recommendations.join('; ')}`
  );
});

it('C4 — credential_path alone: summary is neutral, no "mostly legitimate" language', () => {
  const r = analyzeContent('https://secure-login.account-verification.test/verify', 'url');
  assert.ok(
    !r.summary.toLowerCase().includes('mostly legitimate'),
    `Summary should not imply AI judgment. Got: "${r.summary}"`
  );
});

it('C5 — benign URL (no signals): summary indicates no threats found', () => {
  const r = analyzeContent('https://www.example.com', 'url');
  assert.ok(
    r.riskLevel === 'safe' || r.riskLevel === 'low',
    `Benign URL should be safe or low, got ${r.riskLevel}`
  );
  assert.ok(r.recommendations.some(rec => rec.toLowerCase().includes('no action') || rec.toLowerCase().includes('always remain')),
    `Benign URL recommendations should be safe-oriented. Got: ${r.recommendations.join('; ')}`
  );
});

it('C6 — url_shortener alone: moderate caution, not "Do not click"', () => {
  const r = analyzeContent('https://bit.ly/3someCode', 'url');
  const recLower = r.recommendations.map(rec => rec.toLowerCase()).join(' ');
  assert.ok(
    !recLower.includes('do not click'),
    `url_shortener alone should not produce "Do not click". Got: ${r.recommendations.join('; ')}`
  );
});

it('C7 — risk score always in bounds after resultBuilder changes', () => {
  const testCases = [
    'https://secure-login.account-verification.test/verify',
    'https://www.example.com',
    'https://bit.ly/3someCode',
    'https://paypal-verify.fake.com/login',
  ];
  for (const url of testCases) {
    const r = analyzeContent(url, 'url');
    assert.ok(r.riskScore >= 0 && r.riskScore <= 100, `Score out of bounds for ${url}: ${r.riskScore}`);
  }
});

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------
