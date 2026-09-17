/**
 * phishDestroyService.js — PhishDestroy Threat API lookup.
 * API: https://api.destroy.tools/v1/check?domain=
 */

const axios = require('axios');
const env = require('../../config/env');

/**
 * Normalizes a URL into just the hostname/domain.
 * Example: https://www.example.com/login?x=1 -> example.com
 */
function normalizeDomain(rawUrl) {
  try {
    // URL constructor requires a protocol
    const lower = rawUrl.toLowerCase();
    const urlString = lower.startsWith('http://') || lower.startsWith('https://') ? rawUrl : `http://${rawUrl}`;
    const parsed = new URL(urlString);
    let hostname = parsed.hostname.toLowerCase();
    
    // Remove www.
    if (hostname.startsWith('www.')) {
      hostname = hostname.substring(4);
    }
    
    return hostname;
  } catch (err) {
    return null;
  }
}

/**
 * Checks a URL against the PhishDestroy Threat API.
 * @param {string} rawUrl - The extracted URL to check.
 * @returns {Promise<Object>} Normalized threat intelligence response.
 */
async function checkPhishDestroy(rawUrl) {
  const domain = normalizeDomain(rawUrl);
  if (!domain) {
    return {
      source: 'phishdestroy',
      status: 'error',
    };
  }

  try {
    const url = `${env.PHISHDESTROY_API_URL}/v1/check?domain=${encodeURIComponent(domain)}`;
    
    const response = await axios.get(url, {
      timeout: parseInt(env.PHISHDESTROY_TIMEOUT_MS, 10),
      validateStatus: () => true // Handle non-200 gracefully
    });

    if (response.status !== 200 || !response.data) {
      return {
        source: 'phishdestroy',
        status: 'error'
      };
    }

    const data = response.data;
    const isThreat = data.threat === true;

    return {
      source: 'phishdestroy',
      status: isThreat ? 'found' : 'not_found',
      malicious: isThreat,
      riskScore: data.risk_score || (isThreat ? 80 : 0),
      severity: data.severity || (isThreat ? 'high' : 'none'),
      active: true,
      flags: data.flags || [],
      lists: data.lists || {},
      checkedAt: data.checked_at || new Date().toISOString()
    };

  } catch {
    return {
      source: 'phishdestroy',
      status: 'error'
    };
  }
}

module.exports = {
  checkPhishDestroy,
  normalizeDomain // Exported for testing
};
