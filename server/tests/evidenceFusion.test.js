'use strict';

/**
 * evidenceFusion.test.js — Tests for the evidence fusion engine.
 *
 * Tests all 5 scenarios specified in Part O, plus additional edge cases.
 *
 * Run with: node server/tests/evidenceFusion.test.js
 */

const assert = require('assert');
const { fuseEvidence } = require('../services/scanner/evidenceFusion');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------



// Minimal heuristic result factory
function heuristic(riskLevel, riskScore = null, signals = []) {
  const defaultScores = { safe: 0, low: 20, medium: 50, high: 80, critical: 95 };
  return {
    riskLevel,
    riskScore: riskScore ?? defaultScores[riskLevel] ?? 0,
    confidence: 75,
    scanType: 'email',
    scannedAt: new Date().toISOString(),
    category: 'Test Category',
    summary: 'Test summary',
    reasons: [],
    recommendations: ['Test recommendation'],
    detectedSignals: signals,
  };
}

function mlResult(label, probability) {
  return { status: 'available', label, probability, modelName: 'Test Model', modelVersion: '1.0.0' };
}

function tiResult(threatFound = false) {
  if (threatFound) {
    return {
      urlhaus: { status: 'available', threat: 'malicious', urlStatus: 'active', tags: ['phishing'] },
      virusTotal: { status: 'available', maliciousVotes: 5, suspiciousVotes: 0, totalEngines: 90, threat: 'malicious' },
    };
  }
  return {
    urlhaus: { status: 'not_observed' },
    virusTotal: { status: 'available', maliciousVotes: 0, suspiciousVotes: 0, totalEngines: 90 },
  };
}

// ---------------------------------------------------------------------------
// Part O — 5 Specified Scenarios
// ---------------------------------------------------------------------------

console.log('\n=== EVIDENCE FUSION TESTS ===\n');

console.log('--- Part O Scenarios ---');

it('CASE 1 — Low heuristic + ML benign + TI not_found → Safe or Low', () => {
  const result = fuseEvidence(
    heuristic('low', 20),
    mlResult('safe', 0.05),
    tiResult(false),
    null
  );
  assert.ok(
    result.riskLevel === 'safe' || result.riskLevel === 'low',
    `Expected safe or low, got ${result.riskLevel}`
  );
});

it('CASE 2 — Low heuristic + ML phishing 0.90 + TI not_found → Medium or High', () => {
  const result = fuseEvidence(
    heuristic('low', 20),
    mlResult('phishing', 0.90),
    tiResult(false),
    null
  );
  assert.ok(
    result.riskLevel === 'medium' || result.riskLevel === 'high' || result.riskLevel === 'critical',
    `Expected medium, high or critical, got ${result.riskLevel}`
  );
});

it('CASE 3 — Medium heuristic + Threat Intel match → High', () => {
  const result = fuseEvidence(
    heuristic('medium', 50),
    null,
    tiResult(true),
    null
  );
  assert.ok(result.riskLevel === 'high' || result.riskLevel === 'critical', `Expected high or critical, got ${result.riskLevel}`);
  assert.ok(result.riskScore >= 65, `Expected riskScore >= 65, got ${result.riskScore}`);
});

it('CASE 4 — Threat Intel error → Scanner continues using available evidence', () => {
  const h = heuristic('medium', 50);
  const threatIntel = {
    virusTotal: { status: 'error' },
    urlhaus: { status: 'error' }
  };
  const result = fuseEvidence(
    h,
    mlResult('phishing', 0.88),
    threatIntel,
    null
  );
  assert.ok(result.riskLevel === 'high' || result.riskLevel === 'critical', `Expected high or critical (due to ML), got ${result.riskLevel}`);
  assert.ok(!result.analysisSources.includes('virustotal_url'), 'virustotal should not be in analysisSources when error');
});

it('CASE 5 — All external services unavailable → heuristic result preserved', () => {
  const h = heuristic('medium', 55);
  const result = fuseEvidence(
    h,
    { status: 'unavailable', reason: 'service_offline' },
    null,
    null
  );
  assert.strictEqual(result.riskLevel, h.riskLevel, 'Heuristic risk level should be preserved');
  assert.strictEqual(result.riskScore, h.riskScore, 'Heuristic risk score should be preserved');
  assert.ok(result.analysisSources.includes('heuristics'), 'heuristics must be in analysisSources');
  assert.ok(!result.analysisSources.includes('machine_learning'), 'ML should not be in sources when unavailable');
});

// ---------------------------------------------------------------------------
// Additional edge cases
// ---------------------------------------------------------------------------

console.log('\n--- Additional Edge Cases ---');

it('EF1 — Result always has required frontend fields', () => {
  const result = fuseEvidence(heuristic('safe'), null, null, null);
  assert.ok(typeof result.riskScore === 'number', 'Missing riskScore');
  assert.ok(typeof result.confidence === 'number', 'Missing confidence');
  assert.ok(typeof result.riskLevel === 'string', 'Missing riskLevel');
  assert.ok(typeof result.category === 'string', 'Missing category');
  assert.ok(typeof result.summary === 'string', 'Missing summary');
  assert.ok(Array.isArray(result.reasons), 'Missing reasons');
  assert.ok(Array.isArray(result.recommendations), 'Missing recommendations');
  assert.ok(Array.isArray(result.analysisSources), 'Missing analysisSources');
});

it('EF2 — riskScore is always 0–100', () => {
  const cases = [
    [heuristic('safe', 0), null, null, null],
    [heuristic('high', 100), mlResult('phishing', 0.99), tiResult(true), null],
    [heuristic('low', 15), mlResult('safe', 0.05), tiResult(false), null],
  ];
  for (const args of cases) {
    const result = fuseEvidence(...args);
    assert.ok(result.riskScore >= 0 && result.riskScore <= 100,
      `riskScore out of range: ${result.riskScore}`);
    assert.ok(result.confidence >= 0 && result.confidence <= 99,
      `confidence out of range: ${result.confidence}`);
  }
});

it('EF3 — riskLevel is always one of valid levels', () => {
  const VALID = new Set(['safe', 'low', 'medium', 'high', 'critical']);
  const levels = ['safe', 'low', 'medium', 'high', 'critical'];
  for (const level of levels) {
    const result = fuseEvidence(heuristic(level), null, null, null);
    assert.ok(VALID.has(result.riskLevel), `Invalid riskLevel: ${result.riskLevel}`);
  }
});

it('EF4 — Threat Intel match → category updates to Malicious', () => {
  const result = fuseEvidence(
    heuristic('low'),
    null,
    tiResult(true),
    null
  );
  assert.ok(result.category.toLowerCase().includes('malicious'),
    `Category should mention Malicious, got: ${result.category}`);
  assert.ok(result.analysisSources.includes('virustotal_url'),
    'virustotal_url must be in analysisSources');
});

it('EF5 — ML safe + low heuristic → stays Safe when TI is clean', () => {
  const result = fuseEvidence(
    heuristic('low', 12),
    mlResult('safe', 0.05),
    tiResult(false),
    null
  );
  assert.ok(
    result.riskLevel === 'safe' || result.riskLevel === 'low',
    `Expected safe or low, got ${result.riskLevel}`
  );
});

it('EF6 — Groq result refines summary when TI is clean', () => {
  const groq = {
    riskLevel: 'medium',
    category: 'Groq Category',
    summary: 'Groq summary text',
    confidence: 70,
    reasons: ['Groq reason 1'],
    recommendations: ['Groq recommendation'],
    model: 'llama-3.1-8b-instant',
  };
  const result = fuseEvidence(
    heuristic('medium', 50),
    null,
    tiResult(false),
    null,
    groq
  );
  assert.ok(result.analysisSources.includes('groq'), 'groq must be in analysisSources');
  assert.strictEqual(result.summary, 'Groq summary text');
  assert.strictEqual(result.category, 'Groq Category');
});

it('EF7 — Threat Intel threat overrides Groq category', () => {
  const groq = {
    riskLevel: 'low',
    category: 'Normal Email',
    summary: 'This seems safe.',
    confidence: 40,
    reasons: [],
    recommendations: [],
  };
  const result = fuseEvidence(
    heuristic('low'),
    null,
    tiResult(true),
    null,
    groq
  );
  assert.ok(result.category.toLowerCase().includes('malicious'),
    `TI should override Groq category; got: ${result.category}`);
  assert.ok(result.riskLevel === 'high' || result.riskLevel === 'critical');
});

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------



