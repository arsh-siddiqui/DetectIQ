'use strict';

const dns = require('dns').promises;
const url = require('url');

/**
 * Common Cyrillic & Greek homoglyphs that visually mimic Latin lowercase characters
 */
const HOMOGLYPH_MAP = {
  a: '\u0430', // Cyrillic Small Letter A
  c: '\u0441', // Cyrillic Small Letter Es
  e: '\u0435', // Cyrillic Small Letter Ie
  i: '\u0456', // Cyrillic Small Letter Byelorussian-Ukrainian I
  j: '\u0458', // Cyrillic Small Letter Je
  o: '\u043E', // Cyrillic Small Letter O
  p: '\u0440', // Cyrillic Small Letter Er
  s: '\u0455', // Cyrillic Small Letter Dze
  x: '\u0445', // Cyrillic Small Letter Ha
  y: '\u0443', // Cyrillic Small Letter U
};

/**
 * Common keyboard adjacent and visual character substitutions
 */
const SUBSTITUTION_MAP = {
  o: ['0', 'u'],
  l: ['1', 'i'],
  i: ['1', 'l'],
  e: ['3', 'a'],
  a: ['4', 'e'],
  s: ['5', 'z'],
  t: ['7'],
  b: ['8'],
  g: ['q', '9'],
  v: ['w'],
  w: ['vv'],
};

/**
 * High-risk phishing prefix and suffix tags
 */
const PHISHING_AFFIXES = [
  'login',
  'verify',
  'security',
  'secure',
  'account',
  'support',
  'portal',
  'auth',
];

/**
 * Common alternative Top-Level Domains (TLDs)
 */
const ALTERNATIVE_TLDS = [
  'co',
  'net',
  'org',
  'io',
  'app',
  'info',
  'xyz',
  'online',
  'security',
];

/**
 * Timeout wrapper for DNS queries
 */
function withTimeout(promise, ms = 1100) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('DNS query timeout')), ms)),
  ]);
}

/**
 * Resolve DNS A (IPv4) and MX records for a domain
 */
async function resolveDomainTelemetry(targetDomain) {
  let isLive = false;
  let ips = [];
  let hasMx = false;
  let mxHosts = [];

  try {
    // Resolve IPv4
    const resolvedIps = await withTimeout(dns.resolve4(targetDomain));
    if (resolvedIps && resolvedIps.length > 0) {
      isLive = true;
      ips = resolvedIps;
    }
  } catch {
    // Domain does not resolve to an A record
  }

  if (isLive) {
    try {
      // Resolve MX records
      const mxRecords = await withTimeout(dns.resolveMx(targetDomain));
      if (mxRecords && mxRecords.length > 0) {
        hasMx = true;
        mxHosts = mxRecords.map((m) => m.exchange);
      }
    } catch {
      hasMx = false;
    }
  }

  return { isLive, ips, hasMx, mxHosts };
}

/**
 * Generate comprehensive typosquatting, lookalike, and punycode permutations
 */
function generatePermutations(brandName, defaultTld = 'com') {
  const cleanBrand = brandName.toLowerCase().replace(/[^a-z0-9-]/g, '');
  const permutations = new Map(); // key = punycode/domain to ensure uniqueness

  function addPermutation(domainStr, variantType, fuzzer, similarity = 90) {
    if (!domainStr || domainStr === `${cleanBrand}.${defaultTld}`) return;
    
    let punycodeAscii = domainStr;
    let isPunycode = false;

    try {
      punycodeAscii = url.domainToASCII(domainStr);
      isPunycode = punycodeAscii.startsWith('xn--');
    } catch {
      punycodeAscii = domainStr;
    }

    if (!permutations.has(punycodeAscii)) {
      permutations.set(punycodeAscii, {
        domain: domainStr,
        punycode: punycodeAscii,
        isPunycode,
        variantType,
        fuzzer,
        similarity,
      });
    }
  }

  // 1. Homoglyphs & Punycode (IDN) Attack Variations
  for (let i = 0; i < cleanBrand.length; i++) {
    const char = cleanBrand[i];
    if (HOMOGLYPH_MAP[char]) {
      const glyph = HOMOGLYPH_MAP[char];
      const homoglyphName = cleanBrand.slice(0, i) + glyph + cleanBrand.slice(i + 1);
      addPermutation(`${homoglyphName}.${defaultTld}`, 'IDN Homoglyph (Punycode)', 'homoglyph', 98);
    }
  }

  // 2. Character Omission (Missing letter)
  if (cleanBrand.length > 3) {
    for (let i = 0; i < cleanBrand.length; i++) {
      const omitted = cleanBrand.slice(0, i) + cleanBrand.slice(i + 1);
      addPermutation(`${omitted}.${defaultTld}`, 'Character Omission', 'omission', 92);
    }
  }

  // 3. Transposition (Swapped adjacent letters)
  for (let i = 0; i < cleanBrand.length - 1; i++) {
    const transposed =
      cleanBrand.slice(0, i) + cleanBrand[i + 1] + cleanBrand[i] + cleanBrand.slice(i + 2);
    addPermutation(`${transposed}.${defaultTld}`, 'Transposition', 'transposition', 94);
  }

  // 4. Character Insertion & Doubling
  for (let i = 0; i < cleanBrand.length; i++) {
    const doubled = cleanBrand.slice(0, i) + cleanBrand[i] + cleanBrand.slice(i);
    addPermutation(`${doubled}.${defaultTld}`, 'Character Doubling', 'insertion', 93);
  }

  // 5. Visual & Keyboard Substitutions
  for (let i = 0; i < cleanBrand.length; i++) {
    const char = cleanBrand[i];
    if (SUBSTITUTION_MAP[char]) {
      for (const sub of SUBSTITUTION_MAP[char]) {
        const replaced = cleanBrand.slice(0, i) + sub + cleanBrand.slice(i + 1);
        addPermutation(`${replaced}.${defaultTld}`, 'Visual / Key Replacement', 'substitution', 91);
      }
    }
  }

  // 6. Phishing Affixes & Hyphenation
  for (const affix of PHISHING_AFFIXES) {
    addPermutation(`${cleanBrand}-${affix}.${defaultTld}`, 'Phishing Pattern (Hyphenated)', 'affix', 88);
    addPermutation(`${affix}-${cleanBrand}.${defaultTld}`, 'Phishing Pattern (Prefix)', 'affix', 88);
  }

  // 7. TLD Variations
  for (const altTld of ALTERNATIVE_TLDS) {
    if (altTld !== defaultTld) {
      addPermutation(`${cleanBrand}.${altTld}`, 'TLD Squatting', 'tld', 90);
    }
  }

  return Array.from(permutations.values());
}

/**
 * Main analysis function: generates permutations and resolves live DNS telemetry
 */
async function generateAndAnalyzeTyposquatting(brandOrDomain, options = {}) {
  const { limit = 45, checkDns = true } = options;

  let raw = (brandOrDomain || '').trim().toLowerCase();
  raw = raw.replace(/^https?:\/\//i, '').split('/')[0].split(':')[0];

  let brand = raw;
  let tld = 'com';

  if (raw.includes('.')) {
    const parts = raw.split('.');
    brand = parts[0];
    tld = parts.slice(1).join('.');
  }

  if (!brand || brand.length < 2) {
    throw new Error('Please provide a valid brand name or domain (minimum 2 characters).');
  }

  const allPermutations = generatePermutations(brand, tld);
  const selectedCandidates = allPermutations.slice(0, limit);

  let lookalikes = [];

  if (checkDns) {
    // Process DNS checks in parallel batches of 12 for speed and reliability
    const BATCH_SIZE = 12;
    for (let i = 0; i < selectedCandidates.length; i += BATCH_SIZE) {
      const chunk = selectedCandidates.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        chunk.map(async (candidate) => {
          const telemetry = await resolveDomainTelemetry(candidate.punycode);
          
          let risk = 'DEFENSIVE';
          let status = 'available';
          let verdict = 'Available for Defensive Brand Registration';

          if (telemetry.isLive) {
            if (telemetry.hasMx) {
              risk = 'CRITICAL';
              status = 'active_with_mx';
              verdict = 'Active Threat with MX Records (Armed for Email Phishing)';
            } else {
              risk = 'HIGH';
              status = 'active_web';
              verdict = 'Active Web Host (Live IP Address Detected)';
            }
          } else if (candidate.isPunycode) {
            risk = 'MEDIUM';
            verdict = 'Unregistered Homoglyph / Punycode Deceptive Variant';
          }

          return {
            domain: candidate.domain,
            punycode: candidate.punycode,
            isPunycode: candidate.isPunycode,
            variantType: candidate.variantType,
            fuzzer: candidate.fuzzer,
            similarity: candidate.similarity,
            status,
            risk,
            verdict,
            isLive: telemetry.isLive,
            ips: telemetry.ips,
            hasMx: telemetry.hasMx,
            mxHosts: telemetry.mxHosts,
          };
        })
      );

      results.forEach((res, index) => {
        if (res.status === 'fulfilled') {
          lookalikes.push(res.value);
        } else {
          const candidate = chunk[index];
          lookalikes.push({
            domain: candidate.domain,
            punycode: candidate.punycode,
            isPunycode: candidate.isPunycode,
            variantType: candidate.variantType,
            fuzzer: candidate.fuzzer,
            similarity: candidate.similarity,
            status: 'unresolved',
            risk: candidate.isPunycode ? 'MEDIUM' : 'LOW',
            verdict: 'DNS Query Failed or Unresolved',
            isLive: false,
            ips: [],
            hasMx: false,
            mxHosts: [],
          });
        }
      });
    }
  } else {
    lookalikes = selectedCandidates.map((c) => ({
      domain: c.domain,
      punycode: c.punycode,
      isPunycode: c.isPunycode,
      variantType: c.variantType,
      fuzzer: c.fuzzer,
      similarity: c.similarity,
      status: 'unverified',
      risk: c.isPunycode ? 'MEDIUM' : 'LOW',
      verdict: 'Synthesized Permutation',
      isLive: false,
      ips: [],
      hasMx: false,
      mxHosts: [],
    }));
  }

  // Sort by priority: CRITICAL (active with MX) -> HIGH (active web) -> Punycode -> others
  const riskWeights = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, DEFENSIVE: 1, LOW: 0 };
  lookalikes.sort((a, b) => {
    const weightDiff = (riskWeights[b.risk] || 0) - (riskWeights[a.risk] || 0);
    if (weightDiff !== 0) return weightDiff;
    return b.similarity - a.similarity;
  });

  const activeCount = lookalikes.filter((l) => l.isLive).length;
  const criticalMxCount = lookalikes.filter((l) => l.hasMx).length;
  const punycodeCount = lookalikes.filter((l) => l.isPunycode).length;
  const availableCount = lookalikes.filter((l) => l.status === 'available').length;

  return {
    target: `${brand}.${tld}`,
    brand,
    tld,
    scannedAt: new Date().toISOString(),
    summary: {
      totalGenerated: lookalikes.length,
      activeCount,
      criticalMxCount,
      punycodeCount,
      availableCount,
    },
    lookalikes,
  };
}

module.exports = {
  generateAndAnalyzeTyposquatting,
  generatePermutations,
  resolveDomainTelemetry,
};
