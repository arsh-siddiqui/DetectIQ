'use strict';

/**
 * geolocationProvider.js — Provider interface for IP geolocation.
 *
 * This module implements the geolocation provider interface.
 * The active provider is ip-api.com (free, no API key, 45 req/min).
 *
 * Verified API behavior (2026-09-07):
 *   GET http://ip-api.com/json/8.8.8.8
 *   Response: {"status":"success","country":"United States","countryCode":"US",
 *     "region":"VA","regionName":"Virginia","city":"Ashburn","zip":"20149",
 *     "lat":39.03,"lon":-77.5,"timezone":"America/New_York","isp":"Google LLC",
 *     "org":"Google Public DNS","as":"AS15169 Google LLC","query":"8.8.8.8"}
 *
 * Normalized output format (provider-agnostic):
 *   { ip, country, countryCode, region, city, latitude, longitude,
 *     timezone, asn, organization, isp, source, status, checkedAt }
 *
 * To switch providers later:
 *   - Implement a new provider function matching the same signature
 *   - Change the `activeProvider` export
 *   - enrichmentService.js is unchanged
 *
 * IMPORTANT: NEVER send private, loopback, or link-local IPs to this service.
 * That check must happen in the caller (enrichmentService.js).
 */

const axios = require('axios');
const env = require('../../config/env');

const PROVIDER_NAME = 'ip-api.com';
const BASE_URL = 'http://ip-api.com/json';

/**
 * Normalize a raw ip-api.com response into the standard geolocation format.
 */
function normalizeIpApiResponse(ip, data) {
  if (!data || data.status !== 'success') {
    return {
      ip,
      status: 'not_found',
      source: PROVIDER_NAME,
      checkedAt: new Date().toISOString(),
    };
  }

  // Extract ASN number from the "as" field (e.g., "AS15169 Google LLC" -> "AS15169")
  const asnMatch = data.as ? data.as.match(/^(AS\d+)/) : null;
  const asn = asnMatch ? asnMatch[1] : null;

  // Validate coordinates
  let lat = typeof data.lat === 'number' ? data.lat : null;
  let lon = typeof data.lon === 'number' ? data.lon : null;

  if (lat !== null && lon !== null) {
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      lat = null;
      lon = null;
    }
  } else {
    // If one is missing, invalidate both to prevent partial rendering
    lat = null;
    lon = null;
  }

  return {
    ip,
    country: data.country || null,
    countryCode: data.countryCode || null,
    region: data.regionName || data.region || null,
    regionCode: data.region || null,
    city: data.city || null,
    zip: data.zip || null,
    latitude: lat,
    longitude: lon,
    timezone: data.timezone || null,
    asn,
    organization: data.org || null,
    isp: data.isp || null,
    source: PROVIDER_NAME,
    status: 'success',
    checkedAt: new Date().toISOString(),
  };
}

/**
 * Geolocate a public IP address using ip-api.com.
 *
 * @param {string} ip - A public IP address (IPv4 only supported by ip-api.com free tier)
 * @returns {Promise<Object>} Normalized geolocation result
 */
async function geolocateIP(ip) {
  const timeoutMs = parseInt(env.GEOLOCATION_TIMEOUT_MS, 10) || 4000;

  try {
    const response = await axios.get(`${BASE_URL}/${encodeURIComponent(ip)}`, {
      timeout: timeoutMs,
      validateStatus: () => true,
    });

    if (response.status !== 200 || !response.data) {
      return {
        ip,
        status: 'error',
        source: PROVIDER_NAME,
        errorDetail: `HTTP ${response.status}`,
        checkedAt: new Date().toISOString(),
      };
    }

    return normalizeIpApiResponse(ip, response.data);

  } catch (err) {
    const isTimeout = err.code === 'ECONNABORTED' || err.message?.includes('timeout');
    return {
      ip,
      status: isTimeout ? 'timeout' : 'error',
      source: PROVIDER_NAME,
      errorDetail: err.message,
      checkedAt: new Date().toISOString(),
    };
  }
}

/**
 * The active geolocation provider.
 * enrichmentService.js calls this interface — do not call ip-api.com directly elsewhere.
 */
const activeProvider = {
  name: PROVIDER_NAME,
  geolocateIP,
};

module.exports = {
  activeProvider,
  geolocateIP, // Exported for testing
  normalizeIpApiResponse, // Exported for unit testing
  PROVIDER_NAME,
};
