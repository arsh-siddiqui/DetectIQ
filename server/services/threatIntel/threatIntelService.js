'use strict';

/**
 * threatIntelService.js — Orchestrates threat intelligence lookups.
 *
 * For a submitted URL this service runs:
 *   1. Exact-URL intelligence  → VirusTotal (URL), URLhaus, OTX (URL)
 *   2. Domain-level context    → VirusTotal (domain), OTX (domain), RDAP
 *
 * All lookups are concurrent.  Provider failures (timeout / error / unavailable)
 * do NOT contribute threat evidence — only affirmative data does.
 *
 * Output shape:
 *   {
 *     checked       : boolean,
 *     checkedUrl    : string,
 *     fromCache     : boolean,
 *     virusTotal    : VTResult,          // URL-level
 *     virusTotalDomain: VTResult,        // domain-level (contextual)
 *     urlhaus       : URLhausResult,
 *     otx           : OTXResult,
 *     rdap          : RDAPResult,
 *   }
 *
 * Cache TTL: THREAT_INTEL_CACHE_TTL env var (hours), default 6h.
 */

const crypto = require('crypto');
const { checkVirusTotalURL, checkVirusTotalDomain } = require('./virusTotalService');
const { checkUrlhausURL } = require('./urlhausService');
const { checkOtxIndicator } = require('./otxService');
const { checkRdapDomain } = require('./rdapService');
const env = require('../../config/env');

const DEFAULT_CACHE_TTL_HOURS = 6;

// ---------------------------------------------------------------------------
// Cache helpers
// ---------------------------------------------------------------------------

let ThreatIntelCache;
function getCacheModel() {
  if (!ThreatIntelCache) {
    try { ThreatIntelCache = require('../../models/ThreatIntelCache'); } catch { /* DB unavailable */ }
  }
  return ThreatIntelCache;
}

function urlCacheKey(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

async function getCachedResult(hash) {
  const Model = getCacheModel();
  if (!Model) return null;
  try { return await Model.findOne({ urlHash: hash }) || null; } catch { return null; }
}

async function setCachedResult(hash, normalizedUrl, providers) {
  const Model = getCacheModel();
  if (!Model) return;
  const ttlHours = parseFloat(env.THREAT_INTEL_CACHE_TTL) || DEFAULT_CACHE_TTL_HOURS;
  const expiresAt = new Date(Date.now() + ttlHours * 3_600_000);
  try {
    await Model.findOneAndUpdate(
      { urlHash: hash },
      { urlHash: hash, normalizedUrl, providers, checkedAt: new Date(), expiresAt },
      { upsert: true, new: true }
    );
  } catch { /* non-fatal */ }
}

// ---------------------------------------------------------------------------
// URL extraction helpers
// ---------------------------------------------------------------------------

/**
 * Extract candidate URLs from arbitrary text.
 * Returns de-duplicated array.
 */
function extractUrls(text) {
  const urlRegex = /https?:\/\/[^\s"'<>]+/gi;
  const matches = text.match(urlRegex);
  return matches ? [...new Set(matches)] : [];
}

/**
 * Canonicalize a URL string:
 *   - prepend https:// when protocol is missing
 *   - lowercase hostname
 *   - reject dangerous schemes
 * Returns { ok: true, url } or { ok: false, reason }.
 */
function canonicalizeUrl(raw) {
  if (!raw || typeof raw !== 'string') return { ok: false, reason: 'empty' };
  let s = raw.trim();

  // Reject blocked schemes
  if (/^(javascript|data|file|vbscript):/i.test(s)) {
    return { ok: false, reason: 'blocked_scheme' };
  }

  // Prepend https:// if no scheme
  if (!/^https?:\/\//i.test(s)) {
    s = 'https://' + s;
  }

  try {
    const u = new URL(s);
    // Lowercase hostname
    u.hostname = u.hostname.toLowerCase();
    return { ok: true, url: u.href };
  } catch {
    return { ok: false, reason: 'malformed' };
  }
}

/**
 * Extract registrable domain (eTLD+1) using simple heuristic.
 * For now strips leading www. from the hostname as a reasonable approximation;
 * we avoid pulling in heavy tldts/psl libraries.
 */
function extractRegistrableDomain(hostname) {
  if (!hostname) return null;
  // Remove trailing dot
  let h = hostname.replace(/\.$/, '').toLowerCase();
  // Strip leading www.
  if (h.startsWith('www.')) h = h.slice(4);
  return h;
}

// ---------------------------------------------------------------------------
// Core URL intelligence lookup
// ---------------------------------------------------------------------------

async function runProviders(canonicalUrl) {
  let hostname, registrableDomain;
  try {
    const u = new URL(canonicalUrl);
    hostname = u.hostname.toLowerCase();
    registrableDomain = extractRegistrableDomain(hostname);
  } catch {
    hostname = null;
    registrableDomain = null;
  }

  // Run all lookups concurrently — any failure returns the provider's own error shape
  const [vtUrl, urlhaus, otxUrl, vtDomain, otxDomain, rdap] = await Promise.allSettled([
    checkVirusTotalURL(canonicalUrl),
    checkUrlhausURL(canonicalUrl),
    checkOtxIndicator('url', canonicalUrl),
    hostname ? checkVirusTotalDomain(registrableDomain || hostname) : Promise.resolve(null),
    hostname ? checkOtxIndicator('domain', registrableDomain || hostname) : Promise.resolve(null),
    hostname ? checkRdapDomain(registrableDomain || hostname) : Promise.resolve(null),
  ]);

  const settled = (result) => result.status === 'fulfilled' ? result.value : null;

  return {
    virusTotal: settled(vtUrl),
    urlhaus: settled(urlhaus),
    otx: settled(otxUrl),
    virusTotalDomain: settled(vtDomain),
    otxDomain: settled(otxDomain),
    rdap: settled(rdap),
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Main entry point called by scanner/index.js.
 *
 * @param {string} content  Raw submitted content
 * @param {string} scanType 'url' | 'qr' | 'email' | 'message' | etc.
 * @returns {Promise<Object>} Composite threat intelligence object
 */
async function getThreatIntelligence(content, scanType) {
  // Determine which URL(s) to analyze
  let urlsToCheck = [];

  if (scanType === 'url' || scanType === 'qr') {
    // Try canonicalizing the whole content first
    const attempt = canonicalizeUrl(content.trim());
    if (attempt.ok) {
      urlsToCheck = [attempt.url];
    } else {
      // Fall back to extracting embedded https:// URLs
      urlsToCheck = extractUrls(content);
    }
  } else {
    // Email / SMS / WhatsApp / message — extract embedded URLs
    urlsToCheck = extractUrls(content);
  }

  if (urlsToCheck.length === 0) {
    return {
      checked: false,
      reason: 'no_urls_found',
      virusTotal: null,
      urlhaus: null,
      otx: null,
      virusTotalDomain: null,
      otxDomain: null,
      rdap: null,
    };
  }

  const primaryUrl = urlsToCheck[0];
  const cacheHash = urlCacheKey(primaryUrl);

  // Check cache
  const cached = await getCachedResult(cacheHash);
  if (cached?.providers) {
    return {
      checked: true,
      checkedUrl: primaryUrl,
      fromCache: true,
      ...cached.providers,
    };
  }

  // Run live lookups
  let providers;
  try {
    providers = await runProviders(primaryUrl);
  } catch (err) {
    return {
      checked: false,
      reason: 'lookup_failed',
      error: err.message,
      virusTotal: null,
      urlhaus: null,
      otx: null,
      virusTotalDomain: null,
      otxDomain: null,
      rdap: null,
    };
  }

  // Cache results
  await setCachedResult(cacheHash, primaryUrl, providers);

  return {
    checked: true,
    checkedUrl: primaryUrl,
    fromCache: false,
    ...providers,
  };
}

module.exports = {
  getThreatIntelligence,
  canonicalizeUrl,
  extractRegistrableDomain,
  extractUrls,
  urlCacheKey,
};
