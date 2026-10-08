import test from 'node:test';
import assert from 'node:assert/strict';

await import('../api.js');
const DetectIQApi = globalThis.DetectIQApi;

test('Cloud Threat Matrix: Clean Enterprise Domain (GitHub)', async () => {
  const result = await DetectIQApi.scanUrl('https://github.com');
  assert.equal(result.success, true);
  assert.equal(result.isOfflineFallback, false);
  // GitHub should be classified as low/safe risk
  assert.ok(result.score <= 45, `Expected low score for clean domain, got: ${result.score}`);
  assert.ok(['safe', 'low'].includes(result.level));
});

test('Cloud Threat Matrix: Clean Developer Resource (MDN Web Docs)', async () => {
  const result = await DetectIQApi.scanUrl('https://developer.mozilla.org');
  assert.equal(result.success, true);
  assert.equal(result.isOfflineFallback, false);
  assert.ok(result.score <= 45, `Expected low score for clean domain, got: ${result.score}`);
});

test('Cloud Threat Matrix: Credential Harvesting Phishing Lure', async () => {
  const lure = 'CRITICAL ALERT: Your Microsoft 365 organization account has been locked. Verify immediately: http://rnicrosoft-office365-login.net/auth';
  const result = await DetectIQApi.scanText(lure);

  assert.equal(result.success, true);
  assert.equal(result.isOfflineFallback, false);
  assert.ok(result.score >= 50, `Expected elevated risk for credential phishing, got: ${result.score}`);
  assert.ok(['suspicious', 'high', 'critical'].includes(result.level));
  assert.ok(result.reasons && result.reasons.length > 0, 'Must provide threat indicators');
  assert.ok(result.recommendation, 'Must provide threat recommendation');
});

test('Cloud Threat Matrix: Banking Smishing SMS Message', async () => {
  const smishingSms = 'URGENT SECURITY ALERT: Your bank account is suspended due to unauthorized access. Verify your identity immediately at http://paypa1-verify-account.com/login to restore access.';
  const result = await DetectIQApi.scanText(smishingSms);

  assert.equal(result.success, true);
  assert.equal(result.isOfflineFallback, false);
  assert.ok(result.score >= 50, `Expected elevated risk score for smishing, got: ${result.score}`);
  assert.ok(
    ['medium', 'suspicious', 'high', 'critical'].includes(result.level) ||
    result.verdict === 'SUSPICIOUS' ||
    result.verdict === 'PHISHING'
  );
});

test('Cloud Threat Matrix: Phishing Email Invoice Scam', async () => {
  const invoiceEmail = 'From: billing@quickbooks-invoicing-alert.com\nSubject: Final Notice: Invoice #9482 Overdue\nDear Customer, your service will be terminated within 24 hours unless payment is verified. Click here: http://secure-paypa1-bill.com';
  const result = await DetectIQApi.scanEmail(invoiceEmail);

  assert.equal(result.success, true);
  assert.equal(result.isOfflineFallback, false);
  assert.ok(typeof result.score === 'number');
  assert.ok(result.score >= 40, `Expected elevated score for urgent invoice scam, got: ${result.score}`);
  assert.ok(result.verdict, 'Must provide classification verdict');
});
