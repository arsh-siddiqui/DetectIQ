import test from 'node:test';
import assert from 'node:assert/strict';

await import('../api.js');
const DetectIQApi = globalThis.DetectIQApi;

test('Live Cloud E2E: Render Backend Health Probe', async () => {
  const isHealthy = await DetectIQApi.healthCheck('https://detectiq-api.onrender.com');
  assert.equal(isHealthy, true, 'Live Render backend https://detectiq-api.onrender.com should be reachable');
});

test('Live Cloud E2E: URL Scan with Cloud Engine', async () => {
  const result = await DetectIQApi.scanUrl('https://google.com');

  assert.equal(result.success, true);
  assert.equal(result.isOfflineFallback, false);
  assert.equal(typeof result.score, 'number');
  assert.ok(result.score >= 0 && result.score <= 100);
  assert.ok(['safe', 'low', 'suspicious', 'high', 'critical'].includes(result.level));
  assert.ok(result.verdict, 'Must return verdict');
  assert.ok(result.category, 'Must return category');
  assert.ok(Array.isArray(result.reasons), 'Must return reasons array');
  assert.ok(result.recommendation, 'Must return actionable recommendation');
});

test('Live Cloud E2E: Phishing Text Analysis with Cloud Engine', async () => {
  const phishingPayload = 'SECURITY ALERT: Your banking credentials will expire in 2 hours. Click here to verify your identity: http://secure-bank-login-verify.xyz/auth';
  const result = await DetectIQApi.scanText(phishingPayload);

  assert.equal(result.success, true);
  assert.equal(result.isOfflineFallback, false);
  assert.ok(typeof result.score === 'number');
  // Phishing keywords and lure should trigger elevated risk
  assert.ok(result.score >= 40, 'Phishing lure should trigger elevated threat score');
  assert.ok(result.reasons && result.reasons.length > 0, 'Should return detection reasons');
});
