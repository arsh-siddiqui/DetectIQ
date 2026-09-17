import { normalizeUrl } from './urlValidation.js';
import test from 'node:test';
import assert from 'node:assert';

test('normalizeUrl handles standard protocols', () => {
  assert.strictEqual(normalizeUrl('http://google.com'), 'http://google.com/');
  assert.strictEqual(normalizeUrl('https://google.com'), 'https://google.com/');
  assert.strictEqual(normalizeUrl('https://www.google.com'), 'https://www.google.com/');
});

test('normalizeUrl prepends https:// to domains', () => {
  assert.strictEqual(normalizeUrl('google.com'), 'https://google.com/');
  assert.strictEqual(normalizeUrl('www.google.com'), 'https://www.google.com/');
});

test('normalizeUrl rejects empty input', () => {
  assert.throws(() => normalizeUrl(''), /Please enter a URL/);
  assert.throws(() => normalizeUrl('   '), /Please enter a URL/);
  assert.throws(() => normalizeUrl(null), /Please enter a URL/);
});

test('normalizeUrl rejects javascript: protocol', () => {
  assert.throws(() => normalizeUrl('javascript:alert(1)'), /Unsupported protocol/);
  assert.throws(() => normalizeUrl('JaVaScRipT:alert(1)'), /Unsupported protocol/);
});

test('normalizeUrl rejects spaces', () => {
  assert.throws(() => normalizeUrl('google.com / path'), /Invalid URL format/);
});

test('normalizeUrl rejects malformed domains', () => {
  assert.throws(() => normalizeUrl('google'), /Invalid domain format/);
  assert.throws(() => normalizeUrl('https://invalid_domain'), /Invalid domain format/);
});
