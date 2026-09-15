'use strict';

const axios = require('axios');
const env = require('../../config/env');

const ABUSEIPDB_BASE = 'https://api.abuseipdb.com/api/v2';

function getApiKey() {
  return env.ABUSEIPDB_API_KEY || null;
}

function getTimeout() {
  return parseInt(env.ABUSEIPDB_TIMEOUT_MS, 10) || 5000;
}

function skippedResponse() {
  return {
    provider: 'abuseipdb',
    indicatorType: 'ip',
    status: 'skipped',
    abuseConfidenceScore: 0,
    totalReports: 0,
    countryCode: null,
    isp: null,
    domain: null,
    lastReportedAt: null,
    summary: 'AbuseIPDB API key not configured.',
    checkedAt: new Date().toISOString(),
  };
}

async function checkAbuseIpDbIP(ip) {
  const apiKey = getApiKey();
  if (!apiKey) return skippedResponse();

  try {
    const response = await axios.get(`${ABUSEIPDB_BASE}/check`, {
      headers: {
        'Key': apiKey,
        'Accept': 'application/json'
      },
      params: {
        ipAddress: ip,
        maxAgeInDays: 90
      },
      timeout: getTimeout(),
      validateStatus: () => true,
    });

    if (response.status === 429) {
      return {
        provider: 'abuseipdb',
        indicatorType: 'ip',
        status: 'rate_limited',
        abuseConfidenceScore: 0,
        totalReports: 0,
        countryCode: null,
        isp: null,
        domain: null,
        lastReportedAt: null,
        summary: 'AbuseIPDB rate limit reached.',
        checkedAt: new Date().toISOString(),
      };
    }

    if (response.status !== 200 || !response.data?.data) {
      return {
        provider: 'abuseipdb',
        indicatorType: 'ip',
        status: 'error',
        abuseConfidenceScore: 0,
        totalReports: 0,
        countryCode: null,
        isp: null,
        domain: null,
        lastReportedAt: null,
        summary: `AbuseIPDB returned unexpected status ${response.status}.`,
        checkedAt: new Date().toISOString(),
      };
    }

    const data = response.data.data;
    const totalReports = data.totalReports || 0;
    
    return {
      provider: 'abuseipdb',
      indicatorType: 'ip',
      status: 'available',
      abuseConfidenceScore: data.abuseConfidenceScore || 0,
      totalReports,
      countryCode: data.countryCode || null,
      isp: data.isp || null,
      domain: data.domain || null,
      lastReportedAt: data.lastReportedAt || null,
      summary: totalReports > 0 
        ? `Reported ${totalReports} times. Confidence of abuse: ${data.abuseConfidenceScore || 0}%` 
        : 'No abuse reports found in AbuseIPDB.',
      checkedAt: new Date().toISOString(),
    };

  } catch (err) {
    const isTimeout = err.code === 'ECONNABORTED' || (err.message || '').includes('timeout');
    return {
      provider: 'abuseipdb',
      indicatorType: 'ip',
      status: isTimeout ? 'timeout' : 'error',
      abuseConfidenceScore: 0,
      totalReports: 0,
      countryCode: null,
      isp: null,
      domain: null,
      lastReportedAt: null,
      summary: isTimeout ? 'AbuseIPDB request timed out.' : `AbuseIPDB error: ${err.message}`,
      checkedAt: new Date().toISOString(),
    };
  }
}

module.exports = {
  checkAbuseIpDbIP,
};
