'use strict';

/**
 * threatIntelService.js — Orchestrates threat intelligence lookups.
 *
 * Flow:
 *   1. Extract URLs from content (or use the content directly if it's a URL type)
 *   2. Normalise each URL for caching
 *   3. Check MongoDB cache (avoid redundant external calls)
 *   4. Run PhishDestroy lookup
 *   5. Normalize + combine results
 *   6. Store in cache
 *   7. Return structured evidence
 *
 * Failure handling:
 *   - If PhishDestroy fails: return empty evidence (scanner continues with heuristics)
 *   - MongoDB cache errors: log and proceed without cache
 *
 * Cache TTL: THREAT_INTEL_CACHE_TTL env var (hours), default 6 hours
 */

const crypto = require('crypto');
const { checkPhishDestroy, normalizeDomain } = require('./phishDestroyService');
const { checkVirusTotal } = require('./virusTotalService');
const env = require('../../config/env');

const DEFAULT_CACHE_TTL_HOURS = 6;

// Import model lazily to avoid crashing if MongoDB is unavailable
let ThreatIntelCache;
function getCacheModel() {
  if (!ThreatIntelCache) {
    try {
      ThreatIntelCache = require('../../models/ThreatIntelCache');
    } catch {
      // MongoDB not available — cache disabled
    }
  }
  return ThreatIntelCache;
}

/**
 * Extract URLs from text content.
 * @param {string} text
 * @returns {string[]}
 */
function extractUrls(text) {
  const urlRegex = /https?:\/\/[^\s"'<>]+/gi;
  const matches = text.match(urlRegex);
  return matches ? [...new Set(matches)] : [];
}

/**
 * Generate a SHA-256 cache key for a domain.
 * @param {string} normalizedDomain
 * @returns {string}
 */
function urlCacheKey(normalizedDomain) {
  return crypto.createHash('sha256').update(normalizedDomain).digest('hex');
}

/**
 * Get cached threat intelligence result for a domain, or null if not cached / expired.
 */
async function getCachedResult(urlHash) {
  const Model = getCacheModel();
  if (!Model) return null;
  try {
    const cached = await Model.findOne({ urlHash });
    return cached || null;
  } catch {
    return null;
  }
}

/**
 * Store threat intelligence result in cache.
 */
async function setCachedResult(urlHash, normalizedDomain, providers) {
  const Model = getCacheModel();
  if (!Model) return;
  const ttlHours = parseFloat(env.THREAT_INTEL_CACHE_TTL) || DEFAULT_CACHE_TTL_HOURS;
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);
  try {
    await Model.findOneAndUpdate(
      { urlHash },
      {
        urlHash,
        normalizedUrl: normalizedDomain,
        providers,
        checkedAt: new Date(),
        expiresAt,
      },
      { upsert: true, new: true }
    );
  } catch {
    // Cache write failure is non-fatal
  }
}

/**
 * Check a single URL against threat intelligence providers.
 * @param {string} url
 * @returns {Promise<{phishdestroy: Object}>}
 */
async function checkUrl(url) {
  const normalized = normalizeDomain(url);
  if (!normalized) {
    return {
      threatintel: { provider: 'Unknown', status: 'error', malicious: false },
      fromCache: false
    };
  }
  const hash = urlCacheKey(normalized);

  // Check cache first
  const cached = await getCachedResult(hash);
  if (cached && cached.providers && cached.providers.threatintel) {
    return {
      threatintel: cached.providers.threatintel,
      fromCache: true,
    };
  }

  // Run provider (VirusTotal if key exists, else PhishDestroy)
  let threatintel;
  if (env.VIRUSTOTAL_API_KEY) {
    const result = await checkVirusTotal(url);
    threatintel = {
      provider: 'VirusTotal',
      status: result.status === 'available' ? 'found' : result.status,
      threat: result.severity === 'medium' || result.severity === 'high' || result.severity === 'critical' 
        ? (result.malicious ? 'malicious' : 'suspicious') 
        : 'clean',
      malicious: result.malicious,
      riskScore: result.riskScore || 0,
      severity: result.severity || 'none',
      detail: result.detail || 'Checked by VirusTotal.',
      checkedAt: result.checkedAt
    };
  } else {
    const pdResult = await checkPhishDestroy(url);
    threatintel = {
      provider: 'PhishDestroy',
      status: pdResult.status,
      threat: pdResult.malicious ? 'malicious' : (pdResult.status === 'found' ? 'suspicious' : 'clean'),
      malicious: pdResult.malicious,
      riskScore: pdResult.riskScore,
      severity: pdResult.severity,
      detail: pdResult.status === 'found' ? 'Flagged by PhishDestroy.' : 'Not flagged.',
      checkedAt: pdResult.checkedAt
    };
  }

  // Cache the results
  await setCachedResult(hash, normalized, { threatintel });

  return { threatintel, fromCache: false };
}

/**
 * Main threat intelligence function called by the scanner.
 *
 * @param {string} content - The raw scan content
 * @param {string} scanType - 'url', 'qr', 'email', 'sms', 'whatsapp'
 * @returns {Promise<Object>} Threat intelligence evidence
 */
async function getThreatIntelligence(content, scanType) {
  // Extract URLs to check
  let urlsToCheck = [];

  if (scanType === 'url' || scanType === 'qr') {
    // The content itself IS the URL (or contains it)
    urlsToCheck = extractUrls(content);
    if (urlsToCheck.length === 0) {
      // Try the whole content as a URL
      const trimmed = content.trim();
      if (trimmed.length > 0 && trimmed.length <= 2048) {
        urlsToCheck = [trimmed];
      }
    }
  } else {
    // Email / SMS / WhatsApp — extract embedded URLs
    urlsToCheck = extractUrls(content);
  }

  if (urlsToCheck.length === 0) {
    return {
      checked: false,
      reason: 'no_urls_found',
      threatintel: { provider: 'None', status: 'skipped', malicious: false }
    };
  }

  // Check the first (primary) URL
  // In future, multiple URLs could be checked; for now we focus on the first
  const primaryUrl = urlsToCheck[0];

  try {
    const result = await checkUrl(primaryUrl);
    return {
      checked: true,
      checkedUrl: primaryUrl,
      fromCache: result.fromCache,
      threatintel: result.threatintel,
    };
  } catch (err) {
    return {
      checked: false,
      reason: 'lookup_failed',
      error: err.message,
      threatintel: { provider: 'Unknown', status: 'error', malicious: false }
    };
  }
}

module.exports = { getThreatIntelligence, normalizeDomain, urlCacheKey, extractUrls };

