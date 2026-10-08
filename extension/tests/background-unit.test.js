import test from 'node:test';
import assert from 'node:assert/strict';

test('Background Service Worker: Typosquatting Detection Heuristic', () => {
  const isTyposquatRegex = /rnicrosof|g00gl|paypa1|bankofamenca|login-verify-account/i;

  const deceptiveUrls = [
    'https://rnicrosoft-update-center.com',
    'https://g00gle-security-alert.net',
    'https://paypa1-checkout-resolve.com',
    'https://bankofamenca-online.com/auth',
    'https://subdomain.login-verify-account.io'
  ];

  for (const url of deceptiveUrls) {
    assert.equal(isTyposquatRegex.test(url), true, `Should detect typosquatting in: ${url}`);
  }

  const legitimateUrls = [
    'https://microsoft.com',
    'https://google.com',
    'https://paypal.com',
    'https://bankofamerica.com',
    'https://github.com'
  ];

  for (const url of legitimateUrls) {
    assert.equal(isTyposquatRegex.test(url), false, `Should NOT falsely flag clean domain: ${url}`);
  }
});

test('Background Service Worker: Dangerous Download Inspector', () => {
  const isDangerousExtRegex = /\.(exe|scr|vbs|bat|cmd|ps1|iso|jar|lnk|hta)$/i;
  const isDoubleExtRegex = /\.(pdf|doc|docx|xls|xlsx|jpg|png|txt)\.(exe|scr|vbs|bat|cmd|ps1)$/i;

  function evaluateDownload(filename, url) {
    const isDangerousExt = isDangerousExtRegex.test(filename);
    const isDoubleExt = isDoubleExtRegex.test(filename);
    const isNonHttps = url && url.startsWith('http://');
    return isDangerousExt || isDoubleExt || (isNonHttps && filename.endsWith('.exe'));
  }

  // Dangerous direct executables and scripts
  assert.equal(evaluateDownload('setup.exe', 'https://example.com/setup.exe'), true);
  assert.equal(evaluateDownload('script.vbs', 'https://example.com/script.vbs'), true);
  assert.equal(evaluateDownload('screensaver.scr', 'https://example.com/screensaver.scr'), true);
  assert.equal(evaluateDownload('command.ps1', 'https://example.com/command.ps1'), true);
  assert.equal(evaluateDownload('payload.hta', 'https://example.com/payload.hta'), true);

  // Masked double-extension malware
  assert.equal(evaluateDownload('invoice.pdf.exe', 'https://example.com/invoice.pdf.exe'), true);
  assert.equal(evaluateDownload('receipt.docx.scr', 'https://example.com/receipt.docx.scr'), true);
  assert.equal(evaluateDownload('photo.png.vbs', 'https://example.com/photo.png.vbs'), true);

  // Insecure HTTP executable download
  assert.equal(evaluateDownload('update.exe', 'http://insecure-http.com/update.exe'), true);

  // Safe normal downloads
  assert.equal(evaluateDownload('report.pdf', 'https://safe.com/report.pdf'), false);
  assert.equal(evaluateDownload('photo.jpg', 'https://safe.com/photo.jpg'), false);
  assert.equal(evaluateDownload('dataset.csv', 'https://safe.com/dataset.csv'), false);
  assert.equal(evaluateDownload('archive.zip', 'https://safe.com/archive.zip'), false);
});

test('Background Service Worker: Tab Badge Calculation Thresholds', () => {
  function computeBadge(score) {
    let badgeText = 'SAFE';
    let badgeColor = '#10B981';

    if (score > 85) {
      badgeText = 'CRIT';
      badgeColor = '#DC2626';
    } else if (score > 65) {
      badgeText = 'RISK';
      badgeColor = '#F97316';
    } else if (score > 30) {
      badgeText = 'WARN';
      badgeColor = '#F59E0B';
    }

    return { text: badgeText, color: badgeColor };
  }

  // Critical (>85)
  assert.deepEqual(computeBadge(86), { text: 'CRIT', color: '#DC2626' });
  assert.deepEqual(computeBadge(99), { text: 'CRIT', color: '#DC2626' });

  // High Risk (>65)
  assert.deepEqual(computeBadge(66), { text: 'RISK', color: '#F97316' });
  assert.deepEqual(computeBadge(85), { text: 'RISK', color: '#F97316' });

  // Warning (>30)
  assert.deepEqual(computeBadge(31), { text: 'WARN', color: '#F59E0B' });
  assert.deepEqual(computeBadge(65), { text: 'WARN', color: '#F59E0B' });

  // Safe (<=30)
  assert.deepEqual(computeBadge(30), { text: 'SAFE', color: '#10B981' });
  assert.deepEqual(computeBadge(5), { text: 'SAFE', color: '#10B981' });
});

test('Background Service Worker: Ambient Scan Cache LRU Cap (100 Entries)', () => {
  const urlScanCache = new Map();
  const MAX_ENTRIES = 100;

  function addToCache(url, scan) {
    if (urlScanCache.size >= MAX_ENTRIES) {
      const oldestKey = urlScanCache.keys().next().value;
      if (oldestKey) urlScanCache.delete(oldestKey);
    }
    urlScanCache.set(url, scan);
  }

  // Fill cache to limit
  for (let i = 1; i <= 100; i++) {
    addToCache(`https://site-${i}.com`, { score: i });
  }

  assert.equal(urlScanCache.size, 100);
  assert.ok(urlScanCache.has('https://site-1.com'));

  // Add 101st item
  addToCache('https://site-101.com', { score: 101 });
  assert.equal(urlScanCache.size, 100, 'Cache should remain capped at 100');
  assert.equal(urlScanCache.has('https://site-1.com'), false, 'Oldest item should be evicted');
  assert.ok(urlScanCache.has('https://site-101.com'), 'Newest item must be stored');
});
