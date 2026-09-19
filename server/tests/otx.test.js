'use strict';

const axios = require('axios');
const env = require('../config/env');
const { checkOtxIndicator } = require('../services/threatIntel/otxService');

env.OTX_API_KEY = 'test-otx-key';
env.OTX_TIMEOUT_MS = '5000';

describe('otxService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(axios, 'get').mockImplementation(() => Promise.resolve({}));
  });

  it('returns skipped if OTX_API_KEY is missing', async () => {
    const originalKey = env.OTX_API_KEY;
    env.OTX_API_KEY = '';
    
    const result = await checkOtxIndicator('ip', '8.8.8.8');
    
    expect(result.status).toBe('skipped');
    expect(result.summary).toBe('OTX API key not configured.');
    expect(axios.get).not.toHaveBeenCalled();
    
    env.OTX_API_KEY = originalKey;
  });

  it('returns unsupported for unsupported indicator type', async () => {
    const result = await checkOtxIndicator('unsupported_type', 'value');
    expect(result.status).toBe('skipped');
    expect(result.summary).toContain('is not supported by OTX');
    expect(axios.get).not.toHaveBeenCalled();
  });

  it('handles IPv4 lookup', async () => {
    const mockData = {
      pulse_info: {
        count: 1,
        pulses: [
          { tags: ['botnet'], malware_families: ['mirai'] }
        ]
      }
    };
    
    axios.get.mockResolvedValueOnce({ status: 200, data: mockData });
    
    const result = await checkOtxIndicator('ip', '1.2.3.4');
    
    expect(axios.get).toHaveBeenCalledWith(
      'https://otx.alienvault.com/api/v1/indicators/IPv4/1.2.3.4/general',
      expect.any(Object)
    );
    
    expect(result.status).toBe('available');
    expect(result.pulseCount).toBe(1);
    expect(result.tags).toEqual(['botnet']);
    expect(result.malwareFamilies).toEqual(['mirai']);
  });

  it('handles IPv6 lookup', async () => {
    const mockData = { pulse_info: { count: 1, pulses: [] } };
    axios.get.mockResolvedValueOnce({ status: 200, data: mockData });
    
    await checkOtxIndicator('ip', '2001:0db8:85a3:0000:0000:8a2e:0370:7334');
    
    expect(axios.get).toHaveBeenCalledWith(
      'https://otx.alienvault.com/api/v1/indicators/IPv6/2001:0db8:85a3:0000:0000:8a2e:0370:7334/general',
      expect.any(Object)
    );
  });

  it('handles domain lookup', async () => {
    const mockData = { pulse_info: { count: 0, pulses: [] } };
    axios.get.mockResolvedValueOnce({ status: 200, data: mockData });
    
    const result = await checkOtxIndicator('domain', 'example.com');
    
    expect(axios.get).toHaveBeenCalledWith(
      'https://otx.alienvault.com/api/v1/indicators/domain/example.com/general',
      expect.any(Object)
    );
    expect(result.status).toBe('not_observed');
  });

  it('handles URL lookup with encoding', async () => {
    const mockData = { pulse_info: { count: 2, pulses: [{}] } };
    axios.get.mockResolvedValueOnce({ status: 200, data: mockData });
    
    await checkOtxIndicator('url', 'http://example.com/a?b=c');
    
    expect(axios.get).toHaveBeenCalledWith(
      'https://otx.alienvault.com/api/v1/indicators/url/http%3A%2F%2Fexample.com%2Fa%3Fb%3Dc/general',
      expect.any(Object)
    );
  });

  it('handles Hash lookup', async () => {
    const mockData = { pulse_info: { count: 1, pulses: [] } };
    axios.get.mockResolvedValueOnce({ status: 200, data: mockData });
    
    await checkOtxIndicator('hash', '1234567890abcdef');
    
    expect(axios.get).toHaveBeenCalledWith(
      'https://otx.alienvault.com/api/v1/indicators/file/1234567890abcdef/general',
      expect.any(Object)
    );
  });

  it('handles 404 (not observed)', async () => {
    axios.get.mockResolvedValueOnce({ status: 404, data: {} });
    
    const result = await checkOtxIndicator('ip', '8.8.8.8');
    
    expect(result.status).toBe('not_observed');
  });

  it('handles rate limits (429)', async () => {
    axios.get.mockResolvedValueOnce({ status: 429, data: {} });
    
    const result = await checkOtxIndicator('ip', '8.8.8.8');
    
    expect(result.status).toBe('rate_limited');
  });

  it('handles unexpected status codes', async () => {
    axios.get.mockResolvedValueOnce({ status: 500, data: {} });
    
    const result = await checkOtxIndicator('ip', '8.8.8.8');
    
    expect(result.status).toBe('error');
  });

  it('handles network timeouts', async () => {
    const error = new Error('timeout of 5000ms exceeded');
    error.code = 'ECONNABORTED';
    axios.get.mockRejectedValueOnce(error);
    
    const result = await checkOtxIndicator('ip', '8.8.8.8');
    
    expect(result.status).toBe('timeout');
  });

});
