import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

await import('../api.js');
const DetectIQApi = globalThis.DetectIQApi;

test('IDN Homograph: Punycode Detection (xn-- prefix)', () => {
  // Classic Apple homograph attack
  const applePunycode = 'https://xn--pple-43d.com/login';
  const res1 = DetectIQApi.checkIdnHomograph(applePunycode);
  assert.equal(res1.isHomograph, true);
  assert.equal(res1.punycode, true);
  assert.equal(res1.domain, 'xn--pple-43d.com');
  assert.match(res1.reason, /punycode/i);

  // Subdomain with punycode
  const subPunycode = 'http://secure.login.xn--80akhbyknj4f.com';
  const res2 = DetectIQApi.checkIdnHomograph(subPunycode);
  assert.equal(res2.isHomograph, true);
  assert.equal(res2.punycode, true);

  // Raw domain without protocol
  const rawPunycode = 'xn--e1afmkfd.xn--p1ai';
  const res3 = DetectIQApi.checkIdnHomograph(rawPunycode);
  assert.equal(res3.isHomograph, true);
  assert.equal(res3.punycode, true);
});

test('IDN Homograph: Mixed-Script Cyrillic Homoglyphs', () => {
  // "google.com" with Cyrillic small letter 'о' (\u043E)
  const fakeGoogle = 'https://g\u043E\u043Egle.com/account';
  const res1 = DetectIQApi.checkIdnHomograph(fakeGoogle);
  assert.equal(res1.isHomograph, true);
  assert.equal(res1.mixedScript, true);
  assert.match(res1.reason, /cyrillic/i);

  // "paypal.com" with Cyrillic small letter 'р' (\u0440) and 'а' (\u0430)
  const fakePaypal = 'http://\u0440\u0430ypal.com';
  const res2 = DetectIQApi.checkIdnHomograph(fakePaypal);
  assert.equal(res2.isHomograph, true);
  assert.equal(res2.mixedScript, true);

  // "microsoft.com" with Greek small letter 'ο' (\u03BF)
  const fakeMicrosoft = 'https://micr\u03BFs\u03BFft.com';
  const res3 = DetectIQApi.checkIdnHomograph(fakeMicrosoft);
  assert.equal(res3.isHomograph, true);
  assert.equal(res3.mixedScript, true);
  assert.match(res3.reason, /greek/i);
});

test('IDN Homograph: Legitimate Standard Domains (Clean Pass)', () => {
  const cleanUrls = [
    'https://google.com',
    'https://github.com/arsh-siddiqui/DetectIQ',
    'http://localhost:3000/dashboard',
    'https://detectiq-api.onrender.com/api/health',
    'https://en.wikipedia.org/wiki/Phishing',
    'https://microsoft.com',
    'https://apple.com'
  ];

  for (const url of cleanUrls) {
    const res = DetectIQApi.checkIdnHomograph(url);
    assert.equal(res.isHomograph, false, `Expected ${url} to be clean`);
    assert.equal(res.punycode, false);
    assert.equal(res.mixedScript, false);
  }
});

test('IDN Homograph: Malformed / Empty Inputs Handled Safely', () => {
  assert.equal(DetectIQApi.checkIdnHomograph('').isHomograph, false);
  assert.equal(DetectIQApi.checkIdnHomograph(null).isHomograph, false);
  assert.equal(DetectIQApi.checkIdnHomograph(undefined).isHomograph, false);
  assert.equal(DetectIQApi.checkIdnHomograph(12345).isHomograph, false);
});

test('IDN Homograph: Integration in performScan Heuristic Engine', async () => {
  // Test Punycode in performScan
  const punycodeUrl = 'https://xn--pple-43d.com/verify';
  const resultPuny = await DetectIQApi.performScan('url', punycodeUrl);
  
  assert.ok(resultPuny.score >= 80, `Score should be >= 80, got ${resultPuny.score}`);
  assert.ok(resultPuny.level === 'high' || resultPuny.level === 'critical', `Level should be high/critical, got ${resultPuny.level}`);
  const hasHomographWarning = (reasons) => reasons.some(r => {
    const text = typeof r === 'string' ? r : `${r.title || ''} ${r.detail || ''}`;
    return text.toLowerCase().includes('homograph') || text.toLowerCase().includes('punycode');
  });

  assert.ok(hasHomographWarning(resultPuny.reasons), 'Reasons must include homograph warning');

  // Test Cyrillic Mixed-Script in performScan
  const cyrillicUrl = 'https://g\u043E\u043Egle.com/login';
  const resultCyr = await DetectIQApi.performScan('url', cyrillicUrl);

  assert.ok(resultCyr.score >= 80, `Score should be >= 80, got ${resultCyr.score}`);
  assert.ok(resultCyr.level === 'high' || resultCyr.level === 'critical', `Level should be high/critical, got ${resultCyr.level}`);
  assert.ok(hasHomographWarning(resultCyr.reasons), 'Reasons must include homograph warning');
});

test('QR Code Scanner: Library Loading and Execution Interface', async () => {
  await import('../lib/jsQR.js');
  const jsQR = globalThis.jsQR;

  assert.equal(typeof jsQR, 'function', 'jsQR should export a callable decoding function');

  // Verify graceful handling of blank/empty image buffer
  const width = 100;
  const height = 100;
  const emptyData = new Uint8ClampedArray(width * height * 4); // all zeros
  const decoded = jsQR(emptyData, width, height);
  assert.equal(decoded, null, 'Blank buffer should return null without errors');

  // Verify graceful handling of uniform white buffer
  emptyData.fill(255);
  const decodedWhite = jsQR(emptyData, width, height);
  assert.equal(decodedWhite, null, 'White buffer should return null without errors');
});
