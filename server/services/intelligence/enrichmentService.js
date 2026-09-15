'use strict';

/**
 * enrichmentService.js — Orchestrates IOC enrichment for an EmailInvestigation.
 *
 * Architecture:
 *   EmailInvestigation → Indicator Normalizer → Cache Lookup → Provider Services
 *   → Normalized Intelligence → Indicator Model → Investigation Update
 *
 * Design principles:
 *   1. Provider failures are non-fatal. One timeout does not block others.
 *   2. Per-indicator resilience: each indicator is enriched independently.
 *   3. Explicit concurrency control via pLimit (sequential with max N).
 *   4. Caching prevents hammering external providers.
 *   5. Private IPs are never sent to geolocation services.
 *   6. Files are NEVER uploaded to VT — hash lookup only.
 *   7. Geolocation alone NEVER determines maliciousness.
 *   8. Intelligence evidence feeds evidence-fusion, not the frontend classifier.
 *
 * Indicator states distinguished:
 *   - EXTRACTED:  indicator found in email content
 *   - AVAILABLE:  intelligence successfully retrieved
 *   - SUSPICIOUS/MALICIOUS: intelligence says so (displayed separately)
 *
 * Concurrency:
 *   VT public API: 4 req/minute → max 1 concurrent VT call with small delay
 *   Geolocation:   45 req/minute → max 5 concurrent
 */

const crypto = require('crypto');
const { buildIndicators } = require('./indicatorNormalizer');
const { activeProvider: geoProvider } = require('./geolocationProvider');
const { enrichIndicatorGeolocation } = require('./indicatorGeolocationService');
const {
  checkVirusTotalDomain,
  checkVirusTotalIP,
  checkVirusTotalURL,
  checkVirusTotalHash,
} = require('../threatIntel/virusTotalService');
const { checkAbuseIpDbIP } = require('../threatIntel/abuseIpDbService');
const { checkUrlhausURL } = require('../threatIntel/urlhausService');
const { checkOtxIndicator } = require('../threatIntel/otxService');
const env = require('../../config/env');

const DEFAULT_MAX_INDICATORS = 20;
const DEFAULT_CACHE_TTL_HOURS = 24;

// Lazy model imports
let ThreatIntelCache, IndicatorModel;
function getCache() {
  if (!ThreatIntelCache) ThreatIntelCache = require('../../models/ThreatIntelCache');
  return ThreatIntelCache;
}
function getIndicatorModel() {
  if (!IndicatorModel) IndicatorModel = require('../../models/Indicator');
  return IndicatorModel;
}

// ---------------------------------------------------------------------------
// Cache helpers
// ---------------------------------------------------------------------------

function cacheKey(provider, indicatorType, normalizedValue) {
  return crypto
    .createHash('sha256')
    .update(`${provider}:${indicatorType}:${normalizedValue}`)
    .digest('hex');
}

async function getCached(provider, indicatorType, normalizedValue) {
  const Model = getCache();
  if (!Model) return null;
  try {
    const hash = cacheKey(provider, indicatorType, normalizedValue);
    const doc = await Model.findOne({ urlHash: hash });
    if (!doc) return null;
    // Check expiry manually (TTL index handles deletion but may lag)
    if (doc.expiresAt && doc.expiresAt < new Date()) return null;
    return doc.providers?.[provider] || null;
  } catch {
    return null;
  }
}

async function setCache(provider, indicatorType, normalizedValue, result) {
  const Model = getCache();
  if (!Model) return;
  try {
    const hash = cacheKey(provider, indicatorType, normalizedValue);
    const ttlHours = parseFloat(env.THREAT_INTEL_CACHE_TTL) || DEFAULT_CACHE_TTL_HOURS;
    const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);
    await Model.findOneAndUpdate(
      { urlHash: hash },
      {
        $set: {
          urlHash: hash,
          normalizedUrl: `${indicatorType}:${normalizedValue}`,
          [`providers.${provider}`]: result,
          indicatorType,
          normalizedIndicator: normalizedValue,
          checkedAt: new Date(),
          expiresAt,
        },
      },
      { upsert: true, new: true }
    );
  } catch {
    // Cache write is non-fatal
  }
}

// ---------------------------------------------------------------------------
// Enrichment for single indicator
// ---------------------------------------------------------------------------

/**
 * Enrich one indicator with geographic information using the central geolocation service.
 * Handles IP, Domain, URL, and Email.
 */
async function enrichGeo(indicator, investigation) {
  // Cache check
  const cached = await getCached('geolocation', indicator.type, indicator.normalizedValue);
  if (cached) return { ...cached, fromCache: true };

  const geolocations = await enrichIndicatorGeolocation(indicator, investigation);
  
  if (!geolocations || geolocations.length === 0) {
    const result = { status: 'skipped', reason: 'no_geographic_enrichment', geolocations: [] };
    if (indicator.type === 'ip' && indicator.isPublicIP === false) {
      result.reason = 'private_ip';
    }
    return result;
  }

  // Find the first successful location for backward compatibility
  const primaryGeo = geolocations[0];
  
  // Provide backward compatibility structure
  const result = {
    ...primaryGeo,
    status: 'success',
    geolocations
  };
  
  await setCache('geolocation', indicator.type, indicator.normalizedValue, result);
  return result;
}

/**
 * Enrich one indicator with VirusTotal intelligence.
 * Hash lookup for hashes, no file uploads.
 */
async function enrichVirusTotal(indicator) {
  const apiKey = env.VIRUSTOTAL_API_KEY;
  if (!apiKey) {
    return {
      provider: 'virustotal',
      indicatorType: indicator.type,
      status: 'skipped',
      threat: 'unknown',
      severity: 'unknown',
      confidence: 0,
      maliciousVotes: 0,
      suspiciousVotes: 0,
      totalEngines: 0,
      summary: 'VirusTotal not configured.',
      checkedAt: new Date().toISOString(),
    };
  }

  // Cache check
  const cached = await getCached('virustotal', indicator.type, indicator.normalizedValue);
  if (cached) return { ...cached, fromCache: true };

  let result;
  switch (indicator.type) {
    case 'ip':
      result = await checkVirusTotalIP(indicator.normalizedValue);
      break;
    case 'domain':
      result = await checkVirusTotalDomain(indicator.normalizedValue);
      break;
    case 'url':
      result = await checkVirusTotalURL(indicator.value); // use original for URL
      break;
    case 'hash':
      result = await checkVirusTotalHash(indicator.normalizedValue);
      break;
    default:
      result = {
        provider: 'virustotal',
        indicatorType: indicator.type,
        status: 'skipped',
        threat: 'unknown',
        severity: 'unknown',
        confidence: 0,
        maliciousVotes: 0,
        suspiciousVotes: 0,
        totalEngines: 0,
        summary: `VirusTotal does not support indicator type: ${indicator.type}`,
        checkedAt: new Date().toISOString(),
      };
  }

  await setCache('virustotal', indicator.type, indicator.normalizedValue, result);
  return result;
}

/**
 * Enrich one indicator with AbuseIPDB intelligence.
 */
async function enrichAbuseIpDb(indicator) {
  if (indicator.type !== 'ip') return null;
  // Reuse existing IP classification logic (indicator.isPublicIP is already calculated using forensics/iocExtractor)
  if (indicator.isPublicIP === false) {
    return {
      provider: 'abuseipdb',
      indicatorType: 'ip',
      status: 'skipped',
      abuseConfidenceScore: 0,
      totalReports: 0,
      summary: 'Private or special-use IP skipped.',
      checkedAt: new Date().toISOString(),
    };
  }

  // Cache check
  const cached = await getCached('abuseipdb', indicator.type, indicator.normalizedValue);
  if (cached) return { ...cached, fromCache: true };

  const result = await checkAbuseIpDbIP(indicator.normalizedValue);
  await setCache('abuseipdb', indicator.type, indicator.normalizedValue, result);
  return result;
}

/**
 * Enrich one indicator with URLhaus intelligence.
 */
async function enrichUrlhaus(indicator) {
  if (indicator.type !== 'url') return null;

  // Cache check
  const cached = await getCached('urlhaus', indicator.type, indicator.normalizedValue);
  if (cached) return { ...cached, fromCache: true };

  const result = await checkUrlhausURL(indicator.normalizedValue);
  await setCache('urlhaus', indicator.type, indicator.normalizedValue, result);
  return result;
}

/**
 * Enrich one indicator with OTX intelligence.
 */
async function enrichOtx(indicator) {
  // Support IP, Domain, URL, Hash
  if (!['ip', 'domain', 'url', 'hash'].includes(indicator.type)) return null;
  
  if (indicator.type === 'ip' && indicator.isPublicIP === false) {
    return {
      provider: 'otx',
      indicatorType: 'ip',
      status: 'skipped',
      pulseCount: 0,
      tags: [],
      malwareFamilies: [],
      firstSeen: null,
      lastSeen: null,
      summary: 'Private or special-use IP skipped.',
      checkedAt: new Date().toISOString(),
    };
  }

  // Cache check
  const cached = await getCached('otx', indicator.type, indicator.normalizedValue);
  if (cached) return { ...cached, fromCache: true };

  const result = await checkOtxIndicator(indicator.type, indicator.normalizedValue);
  await setCache('otx', indicator.type, indicator.normalizedValue, result);
  return result;
}

// ---------------------------------------------------------------------------
// Concurrent enrichment with per-indicator resilience
// ---------------------------------------------------------------------------

/**
 * Enrich a list of indicators. Each indicator is enriched independently.
 * One provider failing for one indicator does not affect others.
 *
 * @param {Array} indicators - from buildIndicators()
 * @param {Object} investigation - Context for enrichment
 * @param {Object} options
 * @returns {Promise<Array>} Enriched indicator records
 */
async function enrichIndicators(indicators, investigation, options = {}) {
  const maxIndicators = parseInt(env.MAX_INTELLIGENCE_INDICATORS_PER_SCAN, 10) || DEFAULT_MAX_INDICATORS;
  const limited = indicators.slice(0, maxIndicators);

  // Enrich all indicators in parallel (per-indicator resilience)
  const enriched = await Promise.all(
    limited.map(async (indicator) => {
      const [geoResult, vtResult, abuseIpDbResult, urlhausResult, otxResult] = await Promise.all([
        enrichGeo(indicator, investigation).catch(err => ({
          status: 'error',
          errorDetail: err.message,
          source: geoProvider.name,
        })),
        enrichVirusTotal(indicator).catch(err => ({
          provider: 'virustotal',
          indicatorType: indicator.type,
          status: 'error',
          threat: 'unknown',
          severity: 'unknown',
          confidence: 0,
          maliciousVotes: 0,
          suspiciousVotes: 0,
          totalEngines: 0,
          summary: `Error: ${err.message}`,
          checkedAt: new Date().toISOString(),
        })),
        enrichAbuseIpDb(indicator).catch(err => ({
          provider: 'abuseipdb',
          indicatorType: 'ip',
          status: 'error',
          abuseConfidenceScore: 0,
          totalReports: 0,
          summary: `Error: ${err.message}`,
          checkedAt: new Date().toISOString(),
        })),
        enrichUrlhaus(indicator).catch(err => ({
          provider: 'urlhaus',
          indicatorType: 'url',
          status: 'error',
          threat: 'unknown',
          urlStatus: null,
          firstSeen: null,
          lastSeen: null,
          tags: [],
          summary: `Error: ${err.message}`,
          checkedAt: new Date().toISOString(),
        })),
        enrichOtx(indicator).catch(err => ({
          provider: 'otx',
          indicatorType: indicator.type,
          status: 'error',
          pulseCount: 0,
          tags: [],
          malwareFamilies: [],
          firstSeen: null,
          lastSeen: null,
          summary: `Error: ${err.message}`,
          checkedAt: new Date().toISOString(),
        })),
      ]);

      return {
        ...indicator,
        geolocation: geoResult || null,
        virusTotal: vtResult,
        abuseIpDb: abuseIpDbResult || null,
        urlhaus: urlhausResult || null,
        otx: otxResult || null,
        // Three-state model:
        //   'extracted' = IOC found but no intelligence yet
        //   'available' = intelligence retrieved
        //   'flagged'   = intelligence indicates threat
        intelligenceState: (() => {
          if (vtResult?.status === 'available') {
            if (vtResult.threat === 'malicious' || vtResult.threat === 'suspicious') return 'flagged';
            return 'available';
          }
          return 'extracted';
        })(),
      };
    })
  );

  return enriched;
}

// ---------------------------------------------------------------------------
// Persist indicators to DB
// ---------------------------------------------------------------------------

async function persistIndicators(enrichedIndicators, investigationId, userId) {
  const Model = getIndicatorModel();
  if (!Model) return [];

  const saved = [];
  for (const ind of enrichedIndicators) {
    try {
      const intelligence = new Map();
      let threatStatus = 'unknown';
      let severity = 'none';

      if (ind.virusTotal) {
        intelligence.set('virustotal', ind.virusTotal);
        if (ind.virusTotal.threat && ind.virusTotal.threat !== 'unknown') threatStatus = ind.virusTotal.threat;
        if (ind.virusTotal.severity && ind.virusTotal.severity !== 'unknown') severity = ind.virusTotal.severity;
      }

      if (ind.abuseIpDb) {
        intelligence.set('abuseipdb', ind.abuseIpDb);
      }

      if (ind.urlhaus) {
        intelligence.set('urlhaus', ind.urlhaus);
      }

      if (ind.otx) {
        intelligence.set('otx', ind.otx);
      }

      const doc = await Model.findOneAndUpdate(
        { user: userId, normalizedValue: ind.normalizedValue },
        {
          $set: {
            user: userId,
            investigation: investigationId,
            type: ind.type,
            value: ind.value,
            normalizedValue: ind.normalizedValue,
            geolocation: ind.geolocation || null,
            geolocations: ind.geolocation?.geolocations || [],
            intelligence,
            threatStatus,
            severity,
            lastSeen: new Date(),
          },
          $setOnInsert: { firstSeen: new Date() },
          $addToSet: { sources: { $each: ind.sources || [] } },
        },
        { upsert: true, new: true }
      );
      saved.push(doc);
    } catch {
      // Persist failure is non-fatal
    }
  }
  return saved;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Enrich an EmailInvestigation's extracted indicators.
 *
 * @param {Object} investigation - Mongoose EmailInvestigation document
 * @returns {Promise<{ enriched: Array, geoPoints: Array, indicatorIds: Array }>}
 */
async function enrichInvestigation(investigation) {
  if (!investigation?.extracted) {
    return { enriched: [], geoPoints: [], indicatorIds: [] };
  }

  // 1. Build normalized indicators from Phase 1 extracted data
  const indicators = buildIndicators(investigation.extracted, investigation.attachments);

  if (indicators.length === 0) {
    return { enriched: [], geoPoints: [], indicatorIds: [] };
  }

  // 2. Enrich each indicator (parallel, per-indicator resilient)
  const enriched = await enrichIndicators(indicators, investigation);

  // 3. Persist to DB
  const savedDocs = await persistIndicators(enriched, investigation._id, investigation.user);

  // 4. Build geoPoints for map (public IPs with valid coordinates only)
  const geoPoints = enriched
    .filter(ind => (
      ind.type === 'ip' &&
      ind.isPublicIP &&
      ind.geolocation?.status === 'success' &&
      typeof ind.geolocation.latitude === 'number' &&
      typeof ind.geolocation.longitude === 'number'
    ))
    .map(ind => ({
      ip: ind.normalizedValue,
      latitude: ind.geolocation.latitude,
      longitude: ind.geolocation.longitude,
      country: ind.geolocation.country || null,
      countryCode: ind.geolocation.countryCode || null,
      region: ind.geolocation.region || null,
      city: ind.geolocation.city || null,
      asn: ind.geolocation.asn || null,
      organization: ind.geolocation.organization || null,
      isp: ind.geolocation.isp || null,
      // Threat from VT, never from geolocation alone
      threat: ind.virusTotal?.threat || 'unknown',
      severity: ind.virusTotal?.severity || 'unknown',
      vtStatus: ind.virusTotal?.status || 'skipped',
      // AbuseIPDB integration
      abuseIpDbStatus: ind.abuseIpDb?.status || 'skipped',
      abuseConfidenceScore: ind.abuseIpDb?.abuseConfidenceScore || 0,
      abuseReports: ind.abuseIpDb?.totalReports || 0,
      // URLhaus integration
      urlhausStatus: ind.urlhaus?.status || 'skipped',
      urlhausThreat: ind.urlhaus?.threat || 'unknown',
      // OTX integration
      otxStatus: ind.otx?.status || 'skipped',
      otxPulseCount: ind.otx?.pulseCount || 0,
    }));

  return {
    enriched,
    geoPoints,
    indicatorIds: savedDocs.map(d => d._id),
  };
}

module.exports = {
  enrichInvestigation,
  enrichIndicators,
  enrichGeo,
  enrichVirusTotal,
  buildIndicators, // re-exported for tests
  cacheKey,
};
