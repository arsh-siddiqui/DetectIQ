'use strict';

/**
 * urlVerdictConsistency.test.js
 *
 * Tests the complete verdict/recommendation pipeline for the six key URL scenarios:
 *   A. credential URL + not_observed TI     → needs_review
 *   B. credential URL + unavailable TI      → needs_review
 *   C. credential URL + not_configured TI   → needs_review
 *   D. confirmed malicious provider         → phishing
 *   E. genuinely benign URL                 → legitimate
 *   F. AI unavailable summary language
 *
 * Plus regression cases:
 *   G. low risk + zero signals              → legitimate (not needs_review)
 *   H. medium + credential_path             → suspicious
 *   I. high + credential_path               → phishing
 */

const assert = require('assert');
const { fuseEvidence } = require('../services/scanner/evidenceFusion');
const { analyzeContentSync } = require('../services/scanService');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function heuristicFromUrl(url) {
  return analyzeContentSync(url, 'url');
}

function syntheticHeuristic(riskLevel, signals = []) {
  const defaultScores = { safe: 0, low: 20, medium: 50, high: 80, critical: 95 };
  return {
    riskLevel,
    riskScore: defaultScores[riskLevel] ?? 0,
    confidence: 58,
    scanType: 'url',
    scannedAt: new Date().toISOString(),
    category: 'Test Category',
    summary: 'Test summary',
    reasons: [],
    recommendations: [],
    detectedSignals: signals,
  };
}

function tiNotFound() {
  return { threatintel: { provider: 'TestProvider', status: 'not_found', malicious: false } };
}

function tiMalicious(riskScore = 85) {
  return { threatintel: { provider: 'TestProvider', status: 'found', malicious: true, riskScore, severity: 'high' } };
}

const TI_UNAVAILABLE = null;
const TI_NOT_CONFIGURED = null;
const ML_NOT_APPLICABLE = { status: 'unavailable', reason: 'not_applicable_for_url' };

console.log('\n=== URL VERDICT CONSISTENCY TESTS ===\n');

// A — credential URL + not_observed
console.log('--- A: credential URL + not_observed ---');

it('A1 - credential URL + TI not_found -> classification is needs_review', () => {
  const h = heuristicFromUrl('https://secure-login.account-verification.test/verify?session=8472');
  const result = fuseEvidence(h, ML_NOT_APPLICABLE, tiNotFound(), null);
  assert.strictEqual(result.classification, 'needs_review',
    `Expected needs_review, got "${result.classification}" (riskLevel: ${result.riskLevel})`);
});

it('A2 - credential URL + TI not_found -> riskLevel stays low', () => {
  const h = heuristicFromUrl('https://secure-login.account-verification.test/verify?session=8472');
  const result = fuseEvidence(h, ML_NOT_APPLICABLE, tiNotFound(), null);
  assert.strictEqual(result.riskLevel, 'low', `Expected low, got ${result.riskLevel}`);
});

it('A3 - credential URL + TI not_found -> recommendations contain verify not "do not click"', () => {
  const h = heuristicFromUrl('https://secure-login.account-verification.test/verify?session=8472');
  const result = fuseEvidence(h, ML_NOT_APPLICABLE, tiNotFound(), null);
  const recJoined = result.recommendations.join(' ').toLowerCase();
  assert.ok(!recJoined.includes('do not click'),
    `Should not say "do not click". Got: ${result.recommendations.join('; ')}`);
  assert.ok(recJoined.includes('verify') || recJoined.includes('official'),
    `Should include verify or official. Got: ${result.recommendations.join('; ')}`);
});

it('A4 - credential URL + TI not_found -> summary does not say "mostly legitimate"', () => {
  const h = heuristicFromUrl('https://secure-login.account-verification.test/verify?session=8472');
  const result = fuseEvidence(h, ML_NOT_APPLICABLE, tiNotFound(), null);
  assert.ok(!result.summary.toLowerCase().includes('mostly legitimate'),
    `Summary should not imply AI conclusion. Got: "${result.summary}"`);
});

// B — credential URL + TI unavailable
console.log('--- B: credential URL + TI unavailable ---');

it('B1 - credential URL + TI unavailable -> classification is needs_review', () => {
  const h = heuristicFromUrl('https://secure-login.account-verification.test/verify');
  const result = fuseEvidence(h, ML_NOT_APPLICABLE, TI_UNAVAILABLE, null);
  assert.strictEqual(result.classification, 'needs_review',
    `Expected needs_review, got "${result.classification}"`);
});

it('B2 - credential URL + TI unavailable -> no "do not click"', () => {
  const h = heuristicFromUrl('https://secure-login.account-verification.test/verify');
  const result = fuseEvidence(h, ML_NOT_APPLICABLE, TI_UNAVAILABLE, null);
  const recJoined = result.recommendations.join(' ').toLowerCase();
  assert.ok(!recJoined.includes('do not click'),
    `Should not say "do not click". Got: ${result.recommendations.join('; ')}`);
});

// C — credential URL + TI not_configured
console.log('--- C: credential URL + TI not_configured ---');

it('C1 - credential URL + TI not_configured -> classification is needs_review', () => {
  const h = heuristicFromUrl('https://account-verification.test/signin');
  const result = fuseEvidence(h, ML_NOT_APPLICABLE, TI_NOT_CONFIGURED, null);
  assert.strictEqual(result.classification, 'needs_review',
    `Expected needs_review, got "${result.classification}"`);
});

// D — confirmed malicious
console.log('--- D: confirmed malicious provider ---');

it('D1 - confirmed malicious TI -> classification is phishing', () => {
  const h = heuristicFromUrl('https://secure-login.account-verification.test/verify');
  const result = fuseEvidence(h, ML_NOT_APPLICABLE, tiMalicious(85), null);
  assert.strictEqual(result.classification, 'phishing',
    `Expected phishing, got "${result.classification}"`);
});

it('D2 - confirmed malicious TI -> riskLevel is high or critical', () => {
  const h = heuristicFromUrl('https://secure-login.account-verification.test/verify');
  const result = fuseEvidence(h, ML_NOT_APPLICABLE, tiMalicious(85), null);
  assert.ok(result.riskLevel === 'high' || result.riskLevel === 'critical',
    `Expected high or critical, got ${result.riskLevel}`);
});

it('D3 - confirmed malicious TI -> riskScore >= 80', () => {
  const h = heuristicFromUrl('https://secure-login.account-verification.test/verify');
  const result = fuseEvidence(h, ML_NOT_APPLICABLE, tiMalicious(85), null);
  assert.ok(result.riskScore >= 80, `Expected riskScore >= 80, got ${result.riskScore}`);
});

it('D4 - confirmed malicious TI -> recommendations include strong do-not language', () => {
  const h = heuristicFromUrl('https://secure-login.account-verification.test/verify');
  const result = fuseEvidence(h, ML_NOT_APPLICABLE, tiMalicious(85), null);
  const recJoined = result.recommendations.join(' ').toLowerCase();
  assert.ok(recJoined.includes('do not') || recJoined.includes('do not visit'),
    `Malicious URL should have strong recommendation. Got: ${result.recommendations.join('; ')}`);
});

// E — genuinely benign URL
console.log('--- E: genuinely benign URL ---');

it('E1 - benign URL -> classification is legitimate', () => {
  const h = heuristicFromUrl('https://www.example.com');
  const result = fuseEvidence(h, ML_NOT_APPLICABLE, tiNotFound(), null);
  assert.strictEqual(result.classification, 'legitimate',
    `Expected legitimate, got "${result.classification}"`);
});

it('E2 - benign URL -> riskLevel is safe or low', () => {
  const h = heuristicFromUrl('https://www.example.com');
  const result = fuseEvidence(h, ML_NOT_APPLICABLE, tiNotFound(), null);
  assert.ok(result.riskLevel === 'safe' || result.riskLevel === 'low',
    `Expected safe or low, got ${result.riskLevel}`);
});

it('E3 - benign URL -> no "do not click" recommendation', () => {
  const h = heuristicFromUrl('https://www.example.com');
  const result = fuseEvidence(h, ML_NOT_APPLICABLE, tiNotFound(), null);
  const recJoined = result.recommendations.join(' ').toLowerCase();
  assert.ok(!recJoined.includes('do not click'),
    `Benign URL should not say "do not click". Got: ${result.recommendations.join('; ')}`);
});

// F — AI unavailable summary language
console.log('--- F: AI unavailable language ---');

it('F1 - credential URL Groq unavailable: summary not AI-implied', () => {
  const h = heuristicFromUrl('https://secure-login.account-verification.test/verify');
  const result = fuseEvidence(h, ML_NOT_APPLICABLE, TI_UNAVAILABLE, null);
  assert.ok(!result.summary.toLowerCase().includes('mostly legitimate'),
    `Summary should not imply AI conclusion. Got: "${result.summary}"`);
  assert.ok(!result.summary.toLowerCase().includes('this message looks'),
    `Summary should not use AI-implied language. Got: "${result.summary}"`);
});

it('F2 - benign URL Groq unavailable: summary is non-empty', () => {
  const h = heuristicFromUrl('https://www.example.com');
  const result = fuseEvidence(h, ML_NOT_APPLICABLE, TI_UNAVAILABLE, null);
  assert.ok(result.summary.length > 0, 'Summary should not be empty');
});

// G — REGRESSION: low + zero signals stays legitimate
console.log('--- G: Regression — low + no signals stays legitimate ---');

it('G1 - low riskLevel + zero signals -> legitimate (not needs_review)', () => {
  const h = syntheticHeuristic('low', []);
  const result = fuseEvidence(h, ML_NOT_APPLICABLE, tiNotFound(), null);
  assert.strictEqual(result.classification, 'legitimate',
    `low + 0 signals must stay legitimate; got "${result.classification}"`);
});

it('G2 - safe riskLevel + zero signals -> legitimate', () => {
  const h = syntheticHeuristic('safe', []);
  const result = fuseEvidence(h, ML_NOT_APPLICABLE, tiNotFound(), null);
  assert.strictEqual(result.classification, 'legitimate',
    `safe + 0 signals must be legitimate; got "${result.classification}"`);
});

// H — REGRESSION: medium + credential_path stays suspicious
console.log('--- H: Regression — medium + credential_path stays suspicious ---');

it('H1 - medium riskLevel with signals -> suspicious (not needs_review)', () => {
  const h = syntheticHeuristic('medium', ['credential_path', 'urgency']);
  const result = fuseEvidence(h, ML_NOT_APPLICABLE, tiNotFound(), null);
  assert.strictEqual(result.classification, 'suspicious',
    `medium riskLevel must map to suspicious; got "${result.classification}"`);
});

// I — REGRESSION: high + credential_path stays phishing
console.log('--- I: Regression — high + credential_path stays phishing ---');

it('I1 - high riskLevel with signals -> phishing (not needs_review)', () => {
  const h = syntheticHeuristic('high', ['brand_impersonation', 'credential_path']);
  const result = fuseEvidence(h, ML_NOT_APPLICABLE, tiNotFound(), null);
  assert.strictEqual(result.classification, 'phishing',
    `high riskLevel must map to phishing; got "${result.classification}"`);
});

it('I2 - high riskLevel -> riskScore is elevated', () => {
  const h = syntheticHeuristic('high', ['brand_impersonation', 'credential_path']);
  const result = fuseEvidence(h, ML_NOT_APPLICABLE, tiNotFound(), null);
  assert.ok(result.riskScore >= 60, `Expected riskScore >= 60 for high risk, got ${result.riskScore}`);
});

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------
