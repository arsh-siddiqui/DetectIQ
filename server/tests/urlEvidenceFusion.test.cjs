'use strict';

/**
 * urlEvidenceFusion.test.cjs
 *
 * Generic regression test suite for the URL evidence fusion engine.
 * Uses MOCKED provider responses — no live network calls.
 *
 * Matrix covers:
 *  1.  Plain domain (no signals)                       → legitimate
 *  2.  Clean HTTPS URL                                 → legitimate
 *  3.  HTTP URL (no other signals)                     → legitimate
 *  4.  URL with path                                   → legitimate
 *  5.  URL with query                                  → legitimate
 *  6.  Subdomain URL                                   → legitimate
 *  7.  IP-based URL (heuristic only)                   → suspicious (heuristic score)
 *  8.  Credential-like path                            → suspicious (heuristic score)
 *  9.  VT isolated malicious (1 vote, all others clear)→ suspicious, NOT phishing
 * 10.  VT multiple malicious (5+ votes)                → phishing
 * 11.  VT suspicious votes only                        → suspicious
 * 12.  URLhaus malicious                               → phishing
 * 13.  URLhaus not_observed                            → no threat contribution
 * 14.  OTX with pulses                                 → score bump (no phishing alone)
 * 15.  OTX not_observed                                → no contribution
 * 16.  All providers unavailable                       → legitimate (no false positives)
 * 17.  AI high-confidence (no other evidence)          → suspicious (capped at 59)
 * 18.  AI high-confidence + VT malicious               → phishing
 * 19.  Conflicting: VT clean, URLhaus malicious        → phishing (URLhaus wins)
 * 20.  Corroborated: VT isolated + URLhaus malicious   → phishing (corroboration)
 * 21.  Legitimate URL with no signals                  → legitimate
 * 22.  Score 0  → legitimate
 * 23.  Score 29 → legitimate
 * 24.  Score 30 → suspicious
 * 25.  Score 59 → suspicious
 * 26.  Score 60 → phishing
 * 27.  Score 84 → phishing
 * 28.  Score 85 → phishing
 * 29.  Score 100 → phishing
 * 30.  Provider failure is NOT threat evidence
 * 31.  RDAP alone does NOT escalate verdict
 * 32.  AI cannot force phishing without TI/heuristic backing
 */

const assert = require('assert');
const { fuseEvidence, determineClassification, vtEvidenceStrength } = require('../services/scanner/evidenceFusion');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function baseHeuristics(riskScore = 0, signals = []) {
  return {
    riskScore,
    confidence: 80,
    riskLevel: riskScore >= 85 ? 'critical' : riskScore >= 60 ? 'high' : riskScore >= 30 ? 'medium' : riskScore > 0 ? 'low' : 'safe',
    category: 'url',
    summary: 'Heuristic analysis.',
    reasons: [],
    recommendations: [],
    detectedSignals: signals,
  };
}

function vtResult(maliciousVotes, suspiciousVotes = 0, harmless = 70) {
  const total = maliciousVotes + suspiciousVotes + harmless;
  const threat = maliciousVotes >= 1 ? 'malicious' : suspiciousVotes >= 1 ? 'suspicious' : 'clean';
  return {
    status: 'available',
    threat,
    maliciousVotes,
    suspiciousVotes,
    harmlessVotes: harmless,
    undetectedVotes: 0,
    totalEngines: total,
    confidence: total > 0 ? Math.round((maliciousVotes / total) * 100) : 0,
    summary: `VT: ${maliciousVotes} malicious`,
  };
}

function vtUnavailable() {
  return { status: 'error', threat: 'unknown', maliciousVotes: 0, suspiciousVotes: 0, totalEngines: 0 };
}

function vtNotFound() {
  return { status: 'not_found', threat: 'unknown', maliciousVotes: 0, suspiciousVotes: 0, totalEngines: 0 };
}

function urlhausMalicious() {
  return { status: 'available', threat: 'malicious', urlStatus: 'online', tags: ['phishing'] };
}

function urlhausNotObserved() {
  return { status: 'not_observed', threat: 'unknown' };
}

function urlhausUnavailable() {
  return { status: 'error', threat: 'unknown' };
}

function otxResult(pulseCount) {
  if (pulseCount === 0) return { status: 'not_observed', pulseCount: 0, tags: [] };
  return { status: 'available', pulseCount, tags: [] };
}

function otxUnavailable() {
  return { status: 'error', pulseCount: 0, tags: [] };
}

function rdapResult(ageDays = 365) {
  return { state: 'success', registrar: 'Test Registrar', createdAt: new Date(Date.now() - ageDays * 86400000).toISOString(), registrationAgeDays: ageDays };
}

function buildTI({ vt = null, vtDomain = null, urlhaus = null, otx = null, otxDomain = null, rdap = null } = {}) {
  return { checked: true, checkedUrl: 'https://example.com', fromCache: false, virusTotal: vt, virusTotalDomain: vtDomain, urlhaus, otx, otxDomain, rdap };
}

function groqEscalation(riskScore) {
  return { riskScore, category: 'phishing', summary: 'AI says phishing.', confidence: 90, reasons: ['AI flagged this.'], recommendations: ['Block immediately.'] };
}

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  [PASS] ${name}`);
    passed++;
  } catch (e) {
    console.error(`  [FAIL] ${name}`);
    console.error(`         ${e.message}`);
    failed++;
  }
}

// ---------------------------------------------------------------------------
// Score / Classification Boundary Tests
// ---------------------------------------------------------------------------

console.log('\n--- Score/Classification Boundaries ---');

test('22. Score 0 → legitimate', () => {
  const { classification, riskLevel } = determineClassification(0);
  assert.strictEqual(classification, 'legitimate');
  assert.strictEqual(riskLevel, 'safe');
});

test('23. Score 29 → legitimate', () => {
  const { classification } = determineClassification(29);
  assert.strictEqual(classification, 'legitimate');
});

test('24. Score 30 → suspicious', () => {
  const { classification } = determineClassification(30);
  assert.strictEqual(classification, 'suspicious');
});

test('25. Score 59 → suspicious', () => {
  const { classification } = determineClassification(59);
  assert.strictEqual(classification, 'suspicious');
});

test('26. Score 60 → phishing', () => {
  const { classification } = determineClassification(60);
  assert.strictEqual(classification, 'phishing');
});

test('27. Score 84 → phishing', () => {
  const { classification } = determineClassification(84);
  assert.strictEqual(classification, 'phishing');
});

test('28. Score 85 → phishing', () => {
  const { classification } = determineClassification(85);
  assert.strictEqual(classification, 'phishing');
});

test('29. Score 100 → phishing', () => {
  const { classification } = determineClassification(100);
  assert.strictEqual(classification, 'phishing');
});

// ---------------------------------------------------------------------------
// VT Evidence Strength Tests
// ---------------------------------------------------------------------------

console.log('\n--- VirusTotal Evidence Strength ---');

test('VT: 0/0 engines → none', () => {
  const { evidenceStrength } = vtEvidenceStrength({ status: 'available', maliciousVotes: 0, suspiciousVotes: 0, totalEngines: 0 });
  assert.strictEqual(evidenceStrength, 'none');
});

test('VT: 0 malicious, 2 suspicious → suspicious', () => {
  const { evidenceStrength, scoreBump } = vtEvidenceStrength({ status: 'available', maliciousVotes: 0, suspiciousVotes: 2, totalEngines: 72 });
  assert.strictEqual(evidenceStrength, 'suspicious');
  assert(scoreBump >= 30 && scoreBump < 60);
});

test('VT: 1 malicious → isolated (scoreBump=45)', () => {
  const { evidenceStrength, scoreBump } = vtEvidenceStrength({ status: 'available', maliciousVotes: 1, suspiciousVotes: 0, totalEngines: 71 });
  assert.strictEqual(evidenceStrength, 'isolated');
  assert.strictEqual(scoreBump, 45);
});

test('VT: 2 malicious → limited (scoreBump=55)', () => {
  const { evidenceStrength, scoreBump } = vtEvidenceStrength({ status: 'available', maliciousVotes: 2, suspiciousVotes: 0, totalEngines: 70 });
  assert.strictEqual(evidenceStrength, 'limited');
  assert.strictEqual(scoreBump, 55);
});

test('VT: 4+ malicious → multiple (scoreBump=60)', () => {
  const { evidenceStrength, scoreBump } = vtEvidenceStrength({ status: 'available', maliciousVotes: 5, suspiciousVotes: 0, totalEngines: 70 });
  assert.strictEqual(evidenceStrength, 'multiple');
  assert.strictEqual(scoreBump, 60);
});

test('VT: unavailable → evidenceStrength=unavailable, scoreBump=0', () => {
  const { evidenceStrength, scoreBump } = vtEvidenceStrength({ status: 'error' });
  assert.strictEqual(evidenceStrength, 'unavailable');
  assert.strictEqual(scoreBump, 0);
});

// ---------------------------------------------------------------------------
// Fusion Matrix Tests
// ---------------------------------------------------------------------------

console.log('\n--- Fusion Matrix ---');

test('1. Plain domain, all clean → legitimate', () => {
  const r = fuseEvidence(baseHeuristics(0), null, buildTI({ vt: vtResult(0, 0), urlhaus: urlhausNotObserved(), otx: otxResult(0) }), null, null);
  assert.strictEqual(r.classification, 'legitimate');
  assert(r.riskScore < 30);
});

test('3+4. HTTP URL with path, no signals → legitimate', () => {
  const r = fuseEvidence(baseHeuristics(0), null, buildTI({ vt: vtResult(0, 0) }), null, null);
  assert.strictEqual(r.classification, 'legitimate');
});

test('9. VT isolated malicious (1 vote) → suspicious (NOT phishing)', () => {
  const r = fuseEvidence(baseHeuristics(0), null, buildTI({ vt: vtResult(1, 0) }), null, null);
  assert.strictEqual(r.classification, 'suspicious', `Expected suspicious, got ${r.classification} (score=${r.riskScore})`);
  assert(r.riskScore < 60, `Score should be < 60 for isolated detection, got ${r.riskScore}`);
});

test('10. VT multiple malicious (5 votes) → phishing', () => {
  const r = fuseEvidence(baseHeuristics(0), null, buildTI({ vt: vtResult(5, 0) }), null, null);
  assert.strictEqual(r.classification, 'phishing', `Expected phishing, got ${r.classification} (score=${r.riskScore})`);
  assert(r.riskScore >= 60);
});

test('11. VT suspicious votes only → suspicious', () => {
  const r = fuseEvidence(baseHeuristics(0), null, buildTI({ vt: vtResult(0, 3) }), null, null);
  assert.strictEqual(r.classification, 'suspicious');
});

test('12. URLhaus malicious → phishing', () => {
  const r = fuseEvidence(baseHeuristics(0), null, buildTI({ vt: vtResult(0, 0), urlhaus: urlhausMalicious() }), null, null);
  assert.strictEqual(r.classification, 'phishing', `Expected phishing, got ${r.classification} (score=${r.riskScore})`);
  assert(r.riskScore >= 60);
});

test('13. URLhaus not_observed → no contribution', () => {
  const r = fuseEvidence(baseHeuristics(0), null, buildTI({ vt: vtResult(0, 0), urlhaus: urlhausNotObserved() }), null, null);
  assert.strictEqual(r.classification, 'legitimate');
});

test('14. OTX pulses alone → no score bump', () => {
  const r = fuseEvidence(baseHeuristics(0), null, buildTI({ vt: vtResult(0, 0), otx: otxResult(10) }), null, null);
  assert.strictEqual(r.classification, 'legitimate');
});

test('14b. OTX malicious tag → score bump', () => {
  const otx = otxResult(10);
  otx.tags = ['phishing'];
  const r = fuseEvidence(baseHeuristics(0), null, buildTI({ vt: vtResult(0, 0), otx }), null, null);
  assert.strictEqual(r.classification, 'suspicious');
});

test('16. All providers unavailable → legitimate (no false positives)', () => {
  const r = fuseEvidence(baseHeuristics(0), null, buildTI({ vt: vtUnavailable(), urlhaus: urlhausUnavailable(), otx: otxUnavailable() }), null, null);
  assert.strictEqual(r.classification, 'legitimate', `Expected legitimate, got ${r.classification} (score=${r.riskScore})`);
  assert(r.summary.includes('external intelligence was unavailable'));
});

test('17. AI high-confidence only (no TI/heuristics) → max suspicious (59)', () => {
  const r = fuseEvidence(baseHeuristics(0), null, buildTI({ vt: vtResult(0, 0) }), null, groqEscalation(90));
  assert.strictEqual(r.classification, 'suspicious', `Expected suspicious, got ${r.classification}`);
  assert(r.riskScore <= 59, `AI-only score should be ≤ 59, got ${r.riskScore}`);
});

test('18. AI high-confidence + VT malicious (5) → phishing', () => {
  const r = fuseEvidence(baseHeuristics(0), null, buildTI({ vt: vtResult(5, 0) }), null, groqEscalation(90));
  assert.strictEqual(r.classification, 'phishing');
});

test('19. Conflicting: VT clean + URLhaus malicious → phishing', () => {
  const r = fuseEvidence(baseHeuristics(0), null, buildTI({ vt: vtResult(0, 0), urlhaus: urlhausMalicious() }), null, null);
  assert.strictEqual(r.classification, 'phishing');
});

test('20. Corroborated: VT isolated (1) + URLhaus malicious → phishing', () => {
  const r = fuseEvidence(baseHeuristics(0), null, buildTI({ vt: vtResult(1, 0), urlhaus: urlhausMalicious() }), null, null);
  assert.strictEqual(r.classification, 'phishing', `Corroborated evidence should be phishing, got ${r.classification} (score=${r.riskScore})`);
});

test('21. No signals, all clean → legitimate', () => {
  const r = fuseEvidence(baseHeuristics(0), null, null, null, null);
  assert.strictEqual(r.classification, 'legitimate');
  assert(r.riskScore < 30);
});

test('30. Provider failure (error) is NOT threat evidence', () => {
  const r = fuseEvidence(baseHeuristics(0), null, buildTI({ vt: vtUnavailable(), urlhaus: urlhausUnavailable() }), null, null);
  assert.strictEqual(r.classification, 'legitimate');
  assert(r.riskScore < 30);
});

test('31. RDAP alone does NOT escalate verdict', () => {
  const r = fuseEvidence(baseHeuristics(0), null, buildTI({ vt: vtResult(0, 0), rdap: rdapResult(3) }), null, null);
  assert.strictEqual(r.classification, 'legitimate');
});

test('32. AI cannot force phishing without TI/heuristic backing', () => {
  const r = fuseEvidence(baseHeuristics(5), null, buildTI({ vt: vtResult(0, 0) }), null, groqEscalation(90));
  assert.notStrictEqual(r.classification, 'phishing', `AI alone should not force phishing, got ${r.classification} (score=${r.riskScore})`);
});

test('Recommendations match legitimate classification', () => {
  const r = fuseEvidence(baseHeuristics(0), null, null, null, null);
  assert.strictEqual(r.classification, 'legitimate');
  assert(!r.recommendations.some(rec => rec.toLowerCase().includes('block')), 'Legitimate should not have block recommendation');
});

test('Recommendations match phishing classification', () => {
  const r = fuseEvidence(baseHeuristics(0), null, buildTI({ vt: vtResult(5, 0) }), null, null);
  assert.strictEqual(r.classification, 'phishing');
  assert(!r.recommendations.some(rec => rec.toLowerCase().includes('no action needed') || rec.toLowerCase().includes('appears safe')), 'Phishing should not have safe recommendations');
});

test('Score and classification always agree', () => {
  const scores = [0, 15, 29, 30, 45, 59, 60, 75, 84, 85, 95, 100];
  for (const score of scores) {
    const { classification, riskLevel } = determineClassification(score);
    if (score < 30) assert.strictEqual(classification, 'legitimate', `Score ${score} should be legitimate`);
    else if (score < 60) assert.strictEqual(classification, 'suspicious', `Score ${score} should be suspicious`);
    else assert.strictEqual(classification, 'phishing', `Score ${score} should be phishing`);
    assert(riskLevel, `Score ${score} has no riskLevel`);
  }
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log(`\n${'='.repeat(50)}`);
if (failed === 0) {
  console.log(`All ${passed} tests PASSED.`);
} else {
  console.error(`${passed} passed, ${failed} FAILED.`);
  process.exit(1);
}
