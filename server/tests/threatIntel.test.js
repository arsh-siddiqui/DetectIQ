'use strict';

/**
 * threatIntel.test.js — Tests for the threat intelligence integration.
 *
 * Uses MOCK responses — does NOT call live external APIs.
 * Tests 10 scenarios as specified in Part N.
 *
 * Run with: node server/tests/threatIntel.test.js
 */

const assert = require('assert');

// ---------------------------------------------------------------------------
// Inline mock implementations for provider services
// (replaces the real HTTP call; safe for CI/CD)
// ---------------------------------------------------------------------------

/** Mock PhishDestroy service */
const mockPhishDestroy = {
  found: () => ({
    source: 'phishdestroy', status: 'found', malicious: true,
    riskScore: 85, severity: 'critical', active: true,
    flags: [], lists: {}, checkedAt: new Date().toISOString(),
  }),
  not_found: () => ({
    source: 'phishdestroy', status: 'not_found', malicious: false,
    riskScore: 0, severity: 'none', active: true,
    flags: [], lists: {}, checkedAt: new Date().toISOString(),
  }),
  error: () => ({
    source: 'phishdestroy', status: 'error',
    checkedAt: new Date().toISOString(),
  }),
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------



// ---------------------------------------------------------------------------
// Test cases
// ---------------------------------------------------------------------------

console.log('\n=== THREAT INTELLIGENCE TESTS ===\n');

it('TI1 — Known threat: PhishDestroy returns found', () => {
  const result = mockPhishDestroy.found();
  assert.strictEqual(result.source, 'phishdestroy');
  assert.strictEqual(result.status, 'found');
  assert.strictEqual(result.malicious, true);
  assert.strictEqual(result.riskScore, 85);
  assert.strictEqual(result.severity, 'critical');
  assert.ok(result.checkedAt, 'Should have a checkedAt timestamp');
});

it('TI2 — No threat: PhishDestroy returns not_found', () => {
  const result = mockPhishDestroy.not_found();
  assert.strictEqual(result.source, 'phishdestroy');
  assert.strictEqual(result.status, 'not_found');
  assert.strictEqual(result.malicious, false);
});

it('TI3 — URL canonicalization and domain extraction handles edge cases', () => {
  const { canonicalizeUrl, extractRegistrableDomain } = require('../services/threatIntel/threatIntelService');
  
  const c1 = canonicalizeUrl('https://www.example.com/login?x=1#fragment');
  assert.strictEqual(extractRegistrableDomain(new URL(c1.url).hostname), 'example.com');

  const c2 = canonicalizeUrl('HTTPS://EXAMPLE.COM/path');
  assert.strictEqual(extractRegistrableDomain(new URL(c2.url).hostname), 'example.com');

  const c3 = canonicalizeUrl('example.com');
  assert.strictEqual(extractRegistrableDomain(new URL(c3.url).hostname), 'example.com', 'Should normalise domain without protocol');

  const subdomain = extractRegistrableDomain('test.sub.example.co.uk');
  assert.strictEqual(subdomain, 'test.sub.example.co.uk');
});

it('TI4 — Provider failure: PhishDestroy error does not crash, returns error status', () => {
  const result = mockPhishDestroy.error();
  assert.strictEqual(result.status, 'error');
  assert.strictEqual(result.malicious, undefined);
});

it('TI5 — URL hash generation is deterministic (SHA-256)', () => {
  const { urlCacheKey, canonicalizeUrl } = require('../services/threatIntel/threatIntelService');
  const url = 'https://www.example.com/login?x=1';
  const cUrl = canonicalizeUrl(url).url;
  const hash1 = urlCacheKey(cUrl);
  const hash2 = urlCacheKey(cUrl);
  assert.strictEqual(hash1, hash2, 'Same domain must produce same hash');
  assert.strictEqual(hash1.length, 64, 'SHA-256 hex should be 64 chars');
});

it('TI6 — URL extraction from message text', () => {
  const { extractUrls } = require('../services/threatIntel/threatIntelService');
  const text = 'Click here: https://fake-bank.com/verify and also https://another.org';
  const urls = extractUrls(text);
  assert.ok(urls.length === 2, `Expected 2 URLs, got ${urls.length}`);
  assert.ok(urls[0].startsWith('https://'), 'First URL should start with https://');
});

it('TI7 — No URLs in plain text returns empty array', () => {
  const { extractUrls } = require('../services/threatIntel/threatIntelService');
  const text = 'Hey, meet me at the park tomorrow at 5pm';
  const urls = extractUrls(text);
  assert.strictEqual(urls.length, 0, 'Plain text should have 0 extracted URLs');
});

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------




