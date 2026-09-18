'use strict';

const axios = require('axios');
const env = require('../config/env');
const { checkAbuseIpDbIP } = require('../services/threatIntel/abuseIpDbService');

vi.mock('axios');
vi.mock('../config/env', () => ({
  ABUSEIPDB_API_KEY: 'test-api-key',
  ABUSEIPDB_TIMEOUT_MS: '4000',
}));

describe('abuseIpDbService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns skipped if ABUSEIPDB_API_KEY is missing', async () => {
    const originalKey = env.ABUSEIPDB_API_KEY;
    env.ABUSEIPDB_API_KEY = '';
    
    const result = await checkAbuseIpDbIP('8.8.8.8');
    
    expect(result.status).toBe('skipped');
    expect(result.summary).toBe('AbuseIPDB API key not configured.');
    expect(axios.get).not.toHaveBeenCalled();
    
    env.ABUSEIPDB_API_KEY = originalKey; // Restore
  });

  it('handles a valid IP with abuse reports', async () => {
    const mockData = {
      data: {
        ipAddress: '192.0.2.1',
        isPublic: true,
        abuseConfidenceScore: 100,
        countryCode: 'US',
        usageType: 'Data Center/Web Hosting/Transit',
        isp: 'Test ISP',
        domain: 'test.com',
        totalReports: 15,
        lastReportedAt: '2023-01-01T00:00:00+00:00'
      }
    };
    
    axios.get.mockResolvedValueOnce({ status: 200, data: mockData });
    
    const result = await checkAbuseIpDbIP('192.0.2.1');
    
    expect(axios.get).toHaveBeenCalledWith(
      'https://api.abuseipdb.com/api/v2/check',
      expect.objectContaining({
        params: { ipAddress: '192.0.2.1', maxAgeInDays: 90 },
        headers: { Key: 'test-api-key', Accept: 'application/json' }
      })
    );
    
    expect(result.status).toBe('available');
    expect(result.abuseConfidenceScore).toBe(100);
    expect(result.totalReports).toBe(15);
    expect(result.countryCode).toBe('US');
    expect(result.summary).toContain('Reported 15 times');
  });

  it('handles a valid IP with no abuse reports', async () => {
    const mockData = {
      data: {
        ipAddress: '8.8.8.8',
        isPublic: true,
        abuseConfidenceScore: 0,
        countryCode: 'US',
        isp: 'Google LLC',
        domain: 'google.com',
        totalReports: 0,
        lastReportedAt: null
      }
    };
    
    axios.get.mockResolvedValueOnce({ status: 200, data: mockData });
    
    const result = await checkAbuseIpDbIP('8.8.8.8');
    
    expect(result.status).toBe('available');
    expect(result.abuseConfidenceScore).toBe(0);
    expect(result.totalReports).toBe(0);
    expect(result.summary).toBe('No abuse reports found in AbuseIPDB.');
  });

  it('handles rate limits correctly (status 429)', async () => {
    axios.get.mockResolvedValueOnce({ status: 429, data: {} });
    
    const result = await checkAbuseIpDbIP('8.8.8.8');
    
    expect(result.status).toBe('rate_limited');
    expect(result.summary).toBe('AbuseIPDB rate limit reached.');
  });

  it('handles unexpected status codes', async () => {
    axios.get.mockResolvedValueOnce({ status: 500, data: {} });
    
    const result = await checkAbuseIpDbIP('8.8.8.8');
    
    expect(result.status).toBe('error');
    expect(result.summary).toContain('unexpected status 500');
  });

  it('handles timeouts correctly', async () => {
    const error = new Error('timeout of 4000ms exceeded');
    error.code = 'ECONNABORTED';
    axios.get.mockRejectedValueOnce(error);
    
    const result = await checkAbuseIpDbIP('8.8.8.8');
    
    expect(result.status).toBe('timeout');
    expect(result.summary).toBe('AbuseIPDB request timed out.');
  });

  it('handles generic network errors', async () => {
    const error = new Error('Network Error');
    axios.get.mockRejectedValueOnce(error);
    
    const result = await checkAbuseIpDbIP('8.8.8.8');
    
    expect(result.status).toBe('error');
    expect(result.summary).toContain('Network Error');
  });
});
