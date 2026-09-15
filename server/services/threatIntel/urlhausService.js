'use strict';

const axios = require('axios');
const env = require('../../config/env');

const URLHAUS_BASE = 'https://urlhaus-api.abuse.ch/v1';

function getApiKey() {
  return env.URLHAUS_API_KEY || null;
}

function getTimeout() {
  return parseInt(env.URLHAUS_TIMEOUT_MS, 10) || 5000;
}

function skippedResponse() {
  return {
    provider: 'urlhaus',
    indicatorType: 'url',
    status: 'skipped',
    threat: 'unknown',
    urlStatus: null,
    firstSeen: null,
    lastSeen: null,
    tags: [],
    summary: 'URLhaus API key not configured.',
    checkedAt: new Date().toISOString(),
  };
}

async function checkUrlhausURL(url) {
  const apiKey = getApiKey();
  if (!apiKey) return skippedResponse();

  try {
    const data = new URLSearchParams();
    data.append('url', url);

    const response = await axios.post(`${URLHAUS_BASE}/url/`, data.toString(), {
      headers: {
        'Auth-Key': apiKey,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: getTimeout(),
      validateStatus: () => true,
    });

    if (response.status === 429) {
      return {
        provider: 'urlhaus',
        indicatorType: 'url',
        status: 'rate_limited',
        threat: 'unknown',
        urlStatus: null,
        firstSeen: null,
        lastSeen: null,
        tags: [],
        summary: 'URLhaus rate limit reached.',
        checkedAt: new Date().toISOString(),
      };
    }

    if (response.status !== 200 || !response.data) {
      return {
        provider: 'urlhaus',
        indicatorType: 'url',
        status: 'error',
        threat: 'unknown',
        urlStatus: null,
        firstSeen: null,
        lastSeen: null,
        tags: [],
        summary: `URLhaus returned unexpected status ${response.status}.`,
        checkedAt: new Date().toISOString(),
      };
    }

    const resultData = response.data;

    if (resultData.query_status === 'no_results') {
      return {
        provider: 'urlhaus',
        indicatorType: 'url',
        status: 'not_observed',
        threat: 'unknown',
        urlStatus: null,
        firstSeen: null,
        lastSeen: null,
        tags: [],
        summary: 'URL not listed by URLhaus.',
        checkedAt: new Date().toISOString(),
      };
    }

    if (resultData.query_status === 'ok') {
      const urlStatus = resultData.url_status || 'unknown';
      const firstSeen = resultData.date_added || null;
      const tags = Array.isArray(resultData.tags) ? resultData.tags : [];
      
      return {
        provider: 'urlhaus',
        indicatorType: 'url',
        status: 'available',
        threat: 'malicious',
        urlStatus: urlStatus,
        firstSeen: firstSeen,
        lastSeen: null,
        tags: tags,
        summary: `Malicious URL (${urlStatus}).`,
        checkedAt: new Date().toISOString(),
      };
    }

    // Fallback for other query_status (e.g. invalid_url)
    return {
      provider: 'urlhaus',
      indicatorType: 'url',
      status: 'error',
      threat: 'unknown',
      urlStatus: null,
      firstSeen: null,
      lastSeen: null,
      tags: [],
      summary: `URLhaus error: ${resultData.query_status}`,
      checkedAt: new Date().toISOString(),
    };

  } catch (err) {
    const isTimeout = err.code === 'ECONNABORTED' || (err.message || '').includes('timeout');
    return {
      provider: 'urlhaus',
      indicatorType: 'url',
      status: isTimeout ? 'timeout' : 'error',
      threat: 'unknown',
      urlStatus: null,
      firstSeen: null,
      lastSeen: null,
      tags: [],
      summary: isTimeout ? 'URLhaus request timed out.' : `URLhaus error: ${err.message}`,
      checkedAt: new Date().toISOString(),
    };
  }
}

module.exports = {
  checkUrlhausURL,
};
