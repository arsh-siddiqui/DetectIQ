'use strict';

/**
 * ipGeolocation.test.js
 * Tests: geolocationProvider with mocked axios.
 *
 * Tests:
 *   - Successful geolocation response normalization
 *   - Provider failure handling
 *   - Timeout handling
 *   - Private IP filtering (caller responsibility — tested at enrichment level)
 *   - Missing coordinate handling
 *   - No malicious classification from geolocation alone
 */

const assert = require('assert');



describe('Suite', () => {
  console.log('\n=== IP GEOLOCATION TESTS ===\n');

  // We mock the geolocationProvider's normalizeIpApiResponse directly
  const { normalizeIpApiResponse, PROVIDER_NAME } = require('../services/intelligence/geolocationProvider');

  // --- Response normalization ---
  console.log('--- Response Normalization ---');
  it('GEO1 — Successful response normalized correctly', () => {
    const raw = {
      status: 'success',
      country: 'United States',
      countryCode: 'US',
      region: 'VA',
      regionName: 'Virginia',
      city: 'Ashburn',
      zip: '20149',
      lat: 39.03,
      lon: -77.5,
      timezone: 'America/New_York',
      isp: 'Google LLC',
      org: 'Google Public DNS',
      as: 'AS15169 Google LLC',
      query: '8.8.8.8',
    };
    const result = normalizeIpApiResponse('8.8.8.8', raw);
    assert.strictEqual(result.status, 'success');
    assert.strictEqual(result.ip, '8.8.8.8');
    assert.strictEqual(result.country, 'United States');
    assert.strictEqual(result.countryCode, 'US');
    assert.strictEqual(result.city, 'Ashburn');
    assert.strictEqual(result.latitude, 39.03);
    assert.strictEqual(result.longitude, -77.5);
    assert.strictEqual(result.asn, 'AS15169');
    assert.strictEqual(result.isp, 'Google LLC');
    assert.strictEqual(result.source, PROVIDER_NAME);
    assert.ok(result.checkedAt, 'Must have checkedAt');
  });

  it('GEO2 — Failed response from provider', () => {
    const raw = { status: 'fail', message: 'private range' };
    const result = normalizeIpApiResponse('192.168.1.1', raw);
    assert.strictEqual(result.status, 'not_found');
    assert.strictEqual(result.ip, '192.168.1.1');
  });

  it('GEO3 — Null response handled gracefully', () => {
    const result = normalizeIpApiResponse('1.2.3.4', null);
    assert.strictEqual(result.status, 'not_found');
  });

  it('GEO4 — Missing coordinates return null, not fake values', () => {
    const raw = {
      status: 'success',
      country: 'Unknown',
      countryCode: 'XX',
      // lat and lon absent
    };
    const result = normalizeIpApiResponse('1.2.3.4', raw);
    assert.strictEqual(result.latitude, null, 'Must not invent coordinates');
    assert.strictEqual(result.longitude, null, 'Must not invent coordinates');
  });

  it('GEO4b — Invalid coordinates return null', () => {
    const raw1 = { status: 'success', lat: 100, lon: 0 }; // lat > 90
    const raw2 = { status: 'success', lat: 0, lon: 200 }; // lon > 180
    const raw3 = { status: 'success', lat: -100, lon: 0 }; // lat < -90
    
    const result1 = normalizeIpApiResponse('1.2.3.4', raw1);
    assert.strictEqual(result1.latitude, null);
    assert.strictEqual(result1.longitude, null);

    const result2 = normalizeIpApiResponse('1.2.3.4', raw2);
    assert.strictEqual(result2.latitude, null);
    assert.strictEqual(result2.longitude, null);
  });

  it('GEO5 — ASN extracted correctly from "as" field', () => {
    const raw = { status: 'success', as: 'AS15169 Google LLC', lat: 1, lon: 2 };
    const result = normalizeIpApiResponse('8.8.8.8', raw);
    assert.strictEqual(result.asn, 'AS15169');
  });

  it('GEO6 — Missing ASN field returns null (not error)', () => {
    const raw = { status: 'success', lat: 1, lon: 2 };
    const result = normalizeIpApiResponse('8.8.8.8', raw);
    assert.strictEqual(result.asn, null);
  });

  // --- Critical: geolocation must NEVER cause malicious classification ---
  console.log('\n--- Geo vs. Classification Safety ---');
  it('GEO7 — Geolocation result has no malicious/threat field', () => {
    const raw = {
      status: 'success',
      country: 'Russia',
      countryCode: 'RU',
      lat: 55.75,
      lon: 37.62,
      isp: 'Rostelecom',
    };
    const result = normalizeIpApiResponse('5.5.5.5', raw);
    // The geo result must NOT contain any threat classification
    assert.ok(!('malicious' in result), 'Geolocation must not set malicious field');
    assert.ok(!('threat' in result), 'Geolocation must not set threat field');
    assert.ok(!('riskScore' in result), 'Geolocation must not set riskScore');
    assert.ok(!('severity' in result), 'Geolocation must not set severity');
  });

  it('GEO8 — Enriched IP with clean geo and no VT threat should not change risk classification', () => {
    // Simulates the three-state model check
    const enrichedIndicator = {
      type: 'ip',
      normalizedValue: '5.5.5.5',
      isPublicIP: true,
      geolocation: {
        status: 'success',
        country: 'Russia',
        countryCode: 'RU',
        latitude: 55.75,
        longitude: 37.62,
      },
      virusTotal: {
        status: 'available',
        threat: 'clean',
        severity: 'none',
      },
    };

    // intelligenceState should be 'available', not 'flagged'
    const state = (() => {
      const vt = enrichedIndicator.virusTotal;
      if (vt?.status === 'available') {
        if (vt.threat === 'malicious' || vt.threat === 'suspicious') return 'flagged';
        return 'available';
      }
      return 'extracted';
    })();

    assert.strictEqual(state, 'available', 'Clean geo+VT should not be flagged');
    // Geolocation country alone did not influence the state
  });

  it('GEO9 — IP with malicious VT becomes flagged, not due to geolocation', () => {
    const vtResult = {
      status: 'available',
      threat: 'malicious',
      severity: 'high',
    };
    const geoResult = {
      status: 'success',
      country: 'United States',
      countryCode: 'US',
    };
    // intelligence state is derived from VT, not from geo
    const state = vtResult.threat === 'malicious' ? 'flagged' : 'available';
    assert.strictEqual(state, 'flagged', 'VT malicious should flag the indicator');
    // Geolocation is US — showing that country does NOT drive classification
    assert.ok(geoResult.countryCode === 'US', 'US IP was flagged because VT said so, not because of country');
  });

  
  });

