import test from 'node:test';
import assert from 'node:assert/strict';

await import('../api.js');
const DetectIQApi = globalThis.DetectIQApi;

test('DetectIQApi: Default Config & Storage Fallback', async () => {
  // When chrome.storage is undefined (Node/SSR/Unit environment)
  const config = await DetectIQApi.getConfig();
  assert.equal(config.apiUrl, 'https://detectiq-api.onrender.com');
  assert.equal(config.autoScan, true);
  assert.equal(config.linkScan, true);
  assert.equal(config.textScan, true);
  assert.equal(config.authToken, '');
});

test('DetectIQApi: Config with Mock chrome.storage.local', async () => {
  // Mock chrome storage
  globalThis.chrome = {
    storage: {
      local: {
        get: (keys, cb) => {
          cb({
            apiUrl: 'http://localhost:5000/',
            authToken: 'test-jwt-token-xyz',
            autoScan: false,
            linkScan: true,
            textScan: false
          });
        }
      }
    }
  };

  const config = await DetectIQApi.getConfig();
  assert.equal(config.apiUrl, 'http://localhost:5000', 'Trailing slash should be stripped');
  assert.equal(config.authToken, 'test-jwt-token-xyz');
  assert.equal(config.autoScan, false);
  assert.equal(config.linkScan, true);
  assert.equal(config.textScan, false);

  // Cleanup mock
  delete globalThis.chrome;
});

test('DetectIQApi: Risk Score to Level Boundaries', () => {
  // Boundary tests: <=20 safe, <=45 low, <=70 suspicious, <=85 high, >85 critical
  assert.equal(DetectIQApi.getRiskLevelFromScore(0), 'safe');
  assert.equal(DetectIQApi.getRiskLevelFromScore(10), 'safe');
  assert.equal(DetectIQApi.getRiskLevelFromScore(20), 'safe');

  assert.equal(DetectIQApi.getRiskLevelFromScore(21), 'low');
  assert.equal(DetectIQApi.getRiskLevelFromScore(35), 'low');
  assert.equal(DetectIQApi.getRiskLevelFromScore(45), 'low');

  assert.equal(DetectIQApi.getRiskLevelFromScore(46), 'suspicious');
  assert.equal(DetectIQApi.getRiskLevelFromScore(60), 'suspicious');
  assert.equal(DetectIQApi.getRiskLevelFromScore(70), 'suspicious');

  assert.equal(DetectIQApi.getRiskLevelFromScore(71), 'high');
  assert.equal(DetectIQApi.getRiskLevelFromScore(80), 'high');
  assert.equal(DetectIQApi.getRiskLevelFromScore(85), 'high');

  assert.equal(DetectIQApi.getRiskLevelFromScore(86), 'critical');
  assert.equal(DetectIQApi.getRiskLevelFromScore(95), 'critical');
  assert.equal(DetectIQApi.getRiskLevelFromScore(100), 'critical');
});

test('DetectIQApi: Recommendation Text Mapping', () => {
  const safeRec = DetectIQApi.getRecommendationText('safe');
  assert.ok(safeRec.toLowerCase().includes('no significant security threats'));

  const lowRec = DetectIQApi.getRecommendationText('low');
  assert.ok(lowRec.toLowerCase().includes('low risk detected'));

  const suspRec = DetectIQApi.getRecommendationText('suspicious');
  assert.ok(suspRec.toLowerCase().includes('suspicious indicators were detected'));

  const highRec = DetectIQApi.getRecommendationText('high');
  assert.ok(highRec.toLowerCase().includes('avoid submitting credentials'));

  const critRec = DetectIQApi.getRecommendationText('critical');
  assert.ok(critRec.toLowerCase().includes('critical phishing threat'));
});

test('DetectIQApi: Input Validation Rejections', async () => {
  await assert.rejects(
    async () => DetectIQApi.performScan('url', ''),
    /Content payload is required/
  );

  await assert.rejects(
    async () => DetectIQApi.performScan('url', '   '),
    /Content payload is required/
  );

  await assert.rejects(
    async () => DetectIQApi.performScan('url', null),
    /Content payload is required/
  );
});

test('DetectIQApi: XSS Sanitization escapeHtml', () => {
  // String with dangerous script tags
  const rawScript = '<script>alert("XSS")</script>';
  const sanitized = DetectIQApi.escapeHtml(rawScript);
  assert.equal(sanitized, '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;');

  // String with ampersands and quotes
  const quotes = 'Rock & Roll "quote" and \'single\'';
  assert.equal(DetectIQApi.escapeHtml(quotes), 'Rock &amp; Roll &quot;quote&quot; and &#039;single&#039;');

  // Object with detail property
  const obj = { detail: 'Malicious payload <img src=x onerror=alert(1)>' };
  assert.equal(DetectIQApi.escapeHtml(obj), 'Malicious payload &lt;img src=x onerror=alert(1)&gt;');

  // Null & undefined handling
  assert.equal(DetectIQApi.escapeHtml(null), '');
  assert.equal(DetectIQApi.escapeHtml(undefined), '');
});

test('DetectIQApi: Offline Heuristic Engine Fallback', async () => {
  // Save original fetch
  const originalFetch = globalThis.fetch;

  // Simulate network failure / connection refused
  globalThis.fetch = async () => {
    throw new Error('TypeError: Failed to fetch (Connection Refused)');
  };

  try {
    // 1. Benign content during outage
    const benignResult = await DetectIQApi.performScan('url', 'https://example.com/about');
    assert.equal(benignResult.success, false);
    assert.equal(benignResult.isOfflineFallback, true);
    assert.equal(benignResult.score, 12);
    assert.equal(benignResult.level, 'safe');
    assert.equal(benignResult.category, 'Safe Domain');

    // 2. Phishing keyword content during outage
    const suspiciousResult = await DetectIQApi.performScan('url', 'http://chase-bank-verify-account-security-login.com');
    assert.equal(suspiciousResult.success, false);
    assert.equal(suspiciousResult.isOfflineFallback, true);
    assert.equal(suspiciousResult.score, 75);
    assert.equal(suspiciousResult.level, 'high');
    assert.equal(suspiciousResult.category, 'Suspicious Link/Text');
    assert.ok(suspiciousResult.reasons.some(r => r.includes('phishing keywords detected')));
  } finally {
    // Restore fetch
    globalThis.fetch = originalFetch;
  }
});
