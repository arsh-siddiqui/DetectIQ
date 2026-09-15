'use strict';

const axios = require('axios');
const env = require('../../config/env');

const OTX_BASE = 'https://otx.alienvault.com/api/v1/indicators';

function getApiKey() {
  return env.OTX_API_KEY || null;
}

function getTimeout() {
  return parseInt(env.OTX_TIMEOUT_MS, 10) || 5000;
}

function skippedResponse(indicatorType) {
  return {
    provider: 'otx',
    indicatorType,
    status: 'skipped',
    pulseCount: 0,
    tags: [],
    malwareFamilies: [],
    firstSeen: null,
    lastSeen: null,
    summary: 'OTX API key not configured.',
    checkedAt: new Date().toISOString(),
  };
}

function unsupportedResponse(indicatorType) {
  return {
    provider: 'otx',
    indicatorType,
    status: 'skipped',
    pulseCount: 0,
    tags: [],
    malwareFamilies: [],
    firstSeen: null,
    lastSeen: null,
    summary: `Indicator type '${indicatorType}' is not supported by OTX.`,
    checkedAt: new Date().toISOString(),
  };
}

function isIPv6(ip) {
  return ip.includes(':');
}

function getEndpoint(type, value) {
  switch (type) {
    case 'ip':
      return isIPv6(value) ? `/IPv6/${value}/general` : `/IPv4/${value}/general`;
    case 'domain':
      return `/domain/${value}/general`;
    case 'url':
      return `/url/${encodeURIComponent(value)}/general`;
    case 'hash':
      return `/file/${value}/general`;
    default:
      return null;
  }
}

async function checkOtxIndicator(indicatorType, value) {
  const endpointPath = getEndpoint(indicatorType, value);
  if (!endpointPath) return unsupportedResponse(indicatorType);

  const apiKey = getApiKey();
  if (!apiKey) return skippedResponse(indicatorType);

  try {
    const response = await axios.get(`${OTX_BASE}${endpointPath}`, {
      headers: {
        'X-OTX-API-KEY': apiKey
      },
      timeout: getTimeout(),
      validateStatus: () => true,
    });

    if (response.status === 429) {
      return {
        provider: 'otx',
        indicatorType,
        status: 'rate_limited',
        pulseCount: 0,
        tags: [],
        malwareFamilies: [],
        firstSeen: null,
        lastSeen: null,
        summary: 'OTX rate limit reached.',
        checkedAt: new Date().toISOString(),
      };
    }

    if (response.status === 404 || response.status === 400) {
      // 404 means indicator not found in OTX database
      return {
        provider: 'otx',
        indicatorType,
        status: 'not_observed',
        pulseCount: 0,
        tags: [],
        malwareFamilies: [],
        firstSeen: null,
        lastSeen: null,
        summary: 'Not observed.',
        checkedAt: new Date().toISOString(),
      };
    }

    if (response.status !== 200 || !response.data) {
      return {
        provider: 'otx',
        indicatorType,
        status: 'error',
        pulseCount: 0,
        tags: [],
        malwareFamilies: [],
        firstSeen: null,
        lastSeen: null,
        summary: `OTX returned unexpected status ${response.status}.`,
        checkedAt: new Date().toISOString(),
      };
    }

    const data = response.data;
    const pulseInfo = data.pulse_info || {};
    const count = pulseInfo.count || 0;

    if (count === 0) {
      return {
        provider: 'otx',
        indicatorType,
        status: 'not_observed',
        pulseCount: 0,
        tags: [],
        malwareFamilies: [],
        firstSeen: null,
        lastSeen: null,
        summary: 'Not observed.',
        checkedAt: new Date().toISOString(),
      };
    }

    // Extract optional metadata from pulses if available
    const tagsSet = new Set();
    const malwareSet = new Set();
    let firstSeen = null;
    let lastSeen = null;

    if (Array.isArray(pulseInfo.pulses)) {
      pulseInfo.pulses.forEach(pulse => {
        if (Array.isArray(pulse.tags)) {
          pulse.tags.forEach(t => tagsSet.add(t));
        }
        if (Array.isArray(pulse.malware_families)) {
          pulse.malware_families.forEach(m => malwareSet.add(m.display_name || m));
        }
        
        const created = pulse.created ? new Date(pulse.created) : null;
        if (created && (!firstSeen || created < firstSeen)) firstSeen = created;
        
        const modified = pulse.modified ? new Date(pulse.modified) : created;
        if (modified && (!lastSeen || modified > lastSeen)) lastSeen = modified;
      });
    }

    // Determine summary text based strictly on pulse counts, no invented threatStatus
    const summaryText = `Observed in ${count} OTX pulse${count > 1 ? 's' : ''}`;

    return {
      provider: 'otx',
      indicatorType,
      status: 'available',
      pulseCount: count,
      tags: Array.from(tagsSet).slice(0, 10), // Limit to 10 tags max for UI sanity
      malwareFamilies: Array.from(malwareSet),
      firstSeen: firstSeen ? firstSeen.toISOString() : null,
      lastSeen: lastSeen ? lastSeen.toISOString() : null,
      summary: summaryText,
      checkedAt: new Date().toISOString(),
    };

  } catch (err) {
    const isTimeout = err.code === 'ECONNABORTED' || (err.message || '').includes('timeout');
    return {
      provider: 'otx',
      indicatorType,
      status: isTimeout ? 'timeout' : 'error',
      pulseCount: 0,
      tags: [],
      malwareFamilies: [],
      firstSeen: null,
      lastSeen: null,
      summary: isTimeout ? 'OTX request timed out.' : `OTX error: ${err.message}`,
      checkedAt: new Date().toISOString(),
    };
  }
}

module.exports = {
  checkOtxIndicator,
};
