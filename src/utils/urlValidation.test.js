import { describe, it, expect } from 'vitest';
import { normalizeUrl } from './urlValidation.js';

describe('urlValidation utils', () => {
  it('normalizeUrl handles standard protocols', () => {
    expect(normalizeUrl('http://google.com')).toBe('http://google.com/');
    expect(normalizeUrl('https://google.com')).toBe('https://google.com/');
    expect(normalizeUrl('https://www.google.com')).toBe('https://www.google.com/');
  });

  it('normalizeUrl prepends https:// to domains', () => {
    expect(normalizeUrl('google.com')).toBe('https://google.com/');
    expect(normalizeUrl('www.google.com')).toBe('https://www.google.com/');
  });

  it('normalizeUrl rejects empty input', () => {
    expect(() => normalizeUrl('')).toThrow(/Please enter a URL/);
    expect(() => normalizeUrl('   ')).toThrow(/Please enter a URL/);
    expect(() => normalizeUrl(null)).toThrow(/Please enter a URL/);
  });

  it('normalizeUrl rejects javascript: protocol', () => {
    expect(() => normalizeUrl('javascript:alert(1)')).toThrow(/Unsupported protocol/);
    expect(() => normalizeUrl('JaVaScRipT:alert(1)')).toThrow(/Unsupported protocol/);
  });

  it('normalizeUrl rejects spaces', () => {
    expect(() => normalizeUrl('google.com / path')).toThrow(/Invalid URL format/);
  });

  it('normalizeUrl rejects malformed domains', () => {
    expect(() => normalizeUrl('google')).toThrow(/Invalid domain format/);
    expect(() => normalizeUrl('https://invalid_domain')).toThrow(/Invalid domain format/);
  });
});
