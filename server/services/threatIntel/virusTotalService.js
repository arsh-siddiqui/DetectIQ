'use strict';

/**
 * virusTotalService.js — VirusTotal Threat Intelligence lookups.
 *
 * Supports:
 *   - Domain lookup (preserves original behavior used by scanner pipeline)
 *   - IP address lookup
 *   - URL lookup (base64-encoded identifier)
 *   - File hash lookup (SHA-256, SHA-1, MD5)
 *
 * IMPORTANT:
 *   - The API key (VIRUSTOTAL_API_KEY) remains server-side only.
 *   - No raw provider response is exposed to the frontend.
 *   - Hash lookup only — files are NEVER uploaded automatically.
 *   - Rate limit awareness: VirusTotal public API = 4 requests/minute.
 *     Callers (enrichmentService.js) must implement concurrency control and caching.
 *
 * Normalized output format (same for all indicator types):
 *   {
 *     provider: 'virustotal',
 *     indicatorType: 'ip'|'domain'|'url'|'hash',
 *     status: 'available'|'not_found'|'rate_limited'|'error'|'skipped',
 *     threat: 'malicious'|'suspicious'|'clean'|'unknown',
 *     severity: 'critical'|'high'|'medium'|'low'|'none'|'unknown',
 *     confidence: number (0-100, derived from engine votes — documented below),
 *     maliciousVotes: number,
 *     suspiciousVotes: number,
 *     totalEngines: number,
 *     summary: string,
 *     checkedAt: ISO string,
 *   }
 *
 * Confidence derivation:
 *   confidence = Math.round((maliciousVotes / totalEngines) * 100)
 *   This is a defensible metric: it represents the fraction of engines
 *   that flagged the indicator as malicious. Not manufactured.
 *   If totalEngines === 0, confidence = 0.
 */

const axios = require('axios');
const env = require('../../config/env');

const VT_BASE = 'https://www.virustotal.com/api/v3';

/**
 * Get the configured VirusTotal API key.
 * Returns null if not configured.
 */
function getApiKey() {
  return env.VIRUSTOTAL_API_KEY || null;
}

/**
 * Get the configured timeout in ms.
 */
function getTimeout() {
  return parseInt(env.VIRUSTOTAL_TIMEOUT_MS, 10) || 5000;
}

/**
 * Build a "not configured" normalized response.
 */
function skippedResponse(indicatorType) {
  return {
    provider: 'virustotal',
    indicatorType,
    status: 'skipped',
    threat: 'unknown',
    severity: 'unknown',
    confidence: 0,
    maliciousVotes: 0,
    suspiciousVotes: 0,
    totalEngines: 0,
    summary: 'VirusTotal API key not configured.',
    checkedAt: new Date().toISOString(),
  };
}

/**
 * Normalize a VirusTotal analysis_stats block into the standard format.
 * @param {string} indicatorType
 * @param {Object} stats - last_analysis_stats from VT
 * @returns {Object}
 */
function normalizeStats(indicatorType, stats) {
  const malicious = stats.malicious || 0;
  const suspicious = stats.suspicious || 0;
  const total = (stats.harmless || 0) + (stats.undetected || 0) + malicious + suspicious + (stats.timeout || 0);
  const confidence = total > 0 ? Math.round((malicious / total) * 100) : 0;

  let threat = total > 0 ? 'clean' : 'unknown';
  let severity = 'none';
  if (malicious >= 5) { threat = 'malicious'; severity = 'critical'; }
  else if (malicious >= 3) { threat = 'malicious'; severity = 'high'; }
  else if (malicious >= 1) { threat = 'malicious'; severity = 'medium'; }
  else if (suspicious >= 3) { threat = 'suspicious'; severity = 'high'; }
  else if (suspicious >= 1) { threat = 'suspicious'; severity = 'medium'; }

  const summary = threat === 'unknown' 
    ? 'No security engines evaluated this indicator.'
    : threat === 'clean'
      ? `Checked by ${total} security engines — no threats detected.`
      : `Flagged by ${malicious} engines as malicious, ${suspicious} as suspicious (${total} total engines).`;

  return {
    provider: 'virustotal',
    indicatorType,
    status: 'available',
    threat,
    severity,
    confidence,
    maliciousVotes: malicious,
    suspiciousVotes: suspicious,
    harmlessVotes: stats.harmless || 0,
    undetectedVotes: stats.undetected || 0,
    totalEngines: total,
    summary,
    checkedAt: new Date().toISOString(),
  };
}

/**
 * Perform a GET request to VT API and return the normalized result.
 * @param {string} endpoint - e.g., '/domains/example.com'
 * @param {string} indicatorType
 * @returns {Promise<Object>} Normalized result
 */
async function vtGet(endpoint, indicatorType) {
  const apiKey = getApiKey();
  if (!apiKey) return skippedResponse(indicatorType);

  try {
    const response = await axios.get(`${VT_BASE}${endpoint}`, {
      headers: { 'x-apikey': apiKey },
      timeout: getTimeout(),
      validateStatus: () => true,
    });

    if (response.status === 404) {
      return {
        provider: 'virustotal',
        indicatorType,
        status: 'not_found',
        threat: 'unknown',
        severity: 'unknown',
        confidence: 0,
        maliciousVotes: 0,
        suspiciousVotes: 0,
        totalEngines: 0,
        summary: 'Indicator not found in VirusTotal database.',
        checkedAt: new Date().toISOString(),
      };
    }

    if (response.status === 429) {
      return {
        provider: 'virustotal',
        indicatorType,
        status: 'rate_limited',
        threat: 'unknown',
        severity: 'unknown',
        confidence: 0,
        maliciousVotes: 0,
        suspiciousVotes: 0,
        totalEngines: 0,
        summary: 'VirusTotal rate limit reached.',
        checkedAt: new Date().toISOString(),
      };
    }

    if (response.status !== 200 || !response.data?.data?.attributes) {
      return {
        provider: 'virustotal',
        indicatorType,
        status: 'error',
        threat: 'unknown',
        severity: 'unknown',
        confidence: 0,
        maliciousVotes: 0,
        suspiciousVotes: 0,
        totalEngines: 0,
        summary: `VirusTotal returned unexpected status ${response.status}.`,
        checkedAt: new Date().toISOString(),
      };
    }

    const attrs = response.data.data.attributes;
    const stats = attrs.last_analysis_stats || {};
    return normalizeStats(indicatorType, stats);

  } catch (err) {
    const isTimeout = err.code === 'ECONNABORTED' || (err.message || '').includes('timeout');
    return {
      provider: 'virustotal',
      indicatorType,
      status: isTimeout ? 'timeout' : 'error',
      threat: 'unknown',
      severity: 'unknown',
      confidence: 0,
      maliciousVotes: 0,
      suspiciousVotes: 0,
      totalEngines: 0,
      summary: isTimeout ? 'VirusTotal request timed out.' : `VirusTotal error: ${err.message}`,
      checkedAt: new Date().toISOString(),
    };
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
/**
 * Check a domain against VirusTotal. (Phase 2 normalized format)
 * @param {string} domain - Already normalized domain (lowercase, no www)
 */
async function checkVirusTotalDomain(domain) {
  return vtGet(`/domains/${encodeURIComponent(domain)}`, 'domain');
}

/**
 * Check a public IP address against VirusTotal.
 * @param {string} ip - Public IP address
 */
async function checkVirusTotalIP(ip) {
  return vtGet(`/ip_addresses/${encodeURIComponent(ip)}`, 'ip');
}

/**
 * Check a URL against VirusTotal using base64-encoded identifier.
 * @param {string} url - Full URL
 */
async function checkVirusTotalURL(url) {
  // VT URL IDs are base64url-encoded URL (no padding)
  const id = Buffer.from(url).toString('base64url');
  return vtGet(`/urls/${id}`, 'url');
}

/**
 * Check a file hash (SHA-256, SHA-1, or MD5) against VirusTotal.
 * No file upload is performed — hash lookup only.
 * @param {string} hash - Hex hash string
 */
async function checkVirusTotalHash(hash) {
  if (!hash || typeof hash !== 'string') {
    return {
      provider: 'virustotal',
      indicatorType: 'hash',
      status: 'error',
      threat: 'unknown',
      severity: 'unknown',
      confidence: 0,
      maliciousVotes: 0,
      suspiciousVotes: 0,
      totalEngines: 0,
      summary: 'Invalid hash provided.',
      checkedAt: new Date().toISOString(),
    };
  }
  return vtGet(`/files/${hash.toLowerCase()}`, 'hash');
}

module.exports = {
  checkVirusTotalDomain,
  checkVirusTotalURL,
  checkVirusTotalIP,
  checkVirusTotalHash,
  normalizeStats,          // Exported for unit testing
};
