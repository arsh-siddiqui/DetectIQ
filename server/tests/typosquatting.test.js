'use strict';

import { describe, it, expect } from 'vitest';
import {
  generatePermutations,
  generateAndAnalyzeTyposquatting,
} from '../services/security/typosquattingService';

describe('Domain Typosquatting & Lookalike Generator Tests', () => {
  it('1. Generates expected IDN homoglyphs and punycode representations for a brand', () => {
    const permutations = generatePermutations('paypal', 'com');
    expect(Array.isArray(permutations)).toBe(true);
    expect(permutations.length).toBeGreaterThan(15);

    // Should include at least one IDN homoglyph with punycode xn-- prefix
    const homoglyphs = permutations.filter((p) => p.fuzzer === 'homoglyph');
    expect(homoglyphs.length).toBeGreaterThan(0);
    expect(homoglyphs.some((h) => h.isPunycode && h.punycode.startsWith('xn--'))).toBe(true);
  });

  it('2. Generates character omission, doubling, and transpositions', () => {
    const permutations = generatePermutations('google', 'com');

    const omissions = permutations.filter((p) => p.fuzzer === 'omission');
    expect(omissions.length).toBeGreaterThan(0);

    const transpositions = permutations.filter((p) => p.fuzzer === 'transposition');
    expect(transpositions.length).toBeGreaterThan(0);

    const insertions = permutations.filter((p) => p.fuzzer === 'insertion');
    expect(insertions.length).toBeGreaterThan(0);
  });

  it('3. Generates high-risk phishing affixes (login-, secure-, -verify)', () => {
    const permutations = generatePermutations('chase', 'com');
    const affixes = permutations.filter((p) => p.fuzzer === 'affix');
    expect(affixes.length).toBeGreaterThan(0);
    expect(affixes.some((a) => a.domain.includes('login') || a.domain.includes('verify'))).toBe(true);
  });

  it('4. Generates alternative TLD permutations', () => {
    const permutations = generatePermutations('netflix', 'com');
    const tldSquats = permutations.filter((p) => p.fuzzer === 'tld');
    expect(tldSquats.length).toBeGreaterThan(0);
    expect(tldSquats.some((t) => t.domain.endsWith('.co') || t.domain.endsWith('.net') || t.domain.endsWith('.io'))).toBe(true);
  });

  it('5. Strips URL schemes, ports, and trailing paths from input', async () => {
    const result = await generateAndAnalyzeTyposquatting('https://detectiq.com/login?param=1', {
      limit: 10,
      checkDns: false,
    });

    expect(result.brand).toBe('detectiq');
    expect(result.tld).toBe('com');
    expect(result.target).toBe('detectiq.com');
    expect(result.lookalikes.length).toBe(10);
  });

  it('6. Rejects empty or invalid brand inputs', async () => {
    await expect(generateAndAnalyzeTyposquatting('', { checkDns: false })).rejects.toThrow();
    await expect(generateAndAnalyzeTyposquatting('a', { checkDns: false })).rejects.toThrow();
  });

  it('7. Returns structured summary metrics with risk classifications', async () => {
    const result = await generateAndAnalyzeTyposquatting('apple.com', {
      limit: 20,
      checkDns: false,
    });

    expect(result.summary).toBeDefined();
    expect(typeof result.summary.totalGenerated).toBe('number');
    expect(typeof result.summary.punycodeCount).toBe('number');
    expect(Array.isArray(result.lookalikes)).toBe(true);

    const first = result.lookalikes[0];
    expect(first).toHaveProperty('domain');
    expect(first).toHaveProperty('punycode');
    expect(first).toHaveProperty('risk');
    expect(first).toHaveProperty('verdict');
  });
});
