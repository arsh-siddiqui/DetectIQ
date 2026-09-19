'use strict';

const axios = require('axios');
const env = require('../config/env');
const { checkUrlhausURL } = require('../services/threatIntel/urlhausService');

// Set env variables directly on the required object
env.URLHAUS_API_KEY = 'test-api-key';
env.URLHAUS_TIMEOUT_MS = '4000';

describe('urlhausService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(axios, 'post').mockImplementation(() => Promise.resolve({}));
  });

  it('returns skipped if URLHAUS_API_KEY is missing', async () => {
    const originalKey = env.URLHAUS_API_KEY;
    env.URLHAUS_API_KEY = '';
    
    const result = await checkUrlhausURL('http://example.com/malware.exe');
    
    expect(result.status).toBe('skipped');
    expect(result.summary).toBe('URLhaus API key not configured.');
    expect(axios.post).not.toHaveBeenCalled();
    
    env.URLHAUS_API_KEY = originalKey; // Restore
  });

  it('handles a valid malicious URL', async () => {
    const mockData = {
      query_status: 'ok',
      url_status: 'offline',
      date_added: '2023-01-01T00:00:00+00:00',
      tags: ['elf', 'mirai']
    };
    
    axios.post.mockResolvedValueOnce({ status: 200, data: mockData });
    
    const result = await checkUrlhausURL('http://example.com/malware.exe');
    
    expect(axios.post).toHaveBeenCalledWith(
      'https://urlhaus-api.abuse.ch/v1/url/',
      'url=http%3A%2F%2Fexample.com%2Fmalware.exe',
      expect.objectContaining({
        headers: {
          'Auth-Key': 'test-api-key',
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      })
    );
    
    expect(result.status).toBe('available');
    expect(result.threat).toBe('malicious');
    expect(result.urlStatus).toBe('offline');
    expect(result.tags).toEqual(['elf', 'mirai']);
    expect(result.summary).toContain('Malicious URL (offline)');
  });

  it('handles a URL not observed by URLhaus', async () => {
    const mockData = {
      query_status: 'no_results'
    };
    
    axios.post.mockResolvedValueOnce({ status: 200, data: mockData });
    
    const result = await checkUrlhausURL('http://clean-site.com');
    
    expect(result.status).toBe('not_observed');
    expect(result.threat).toBe('unknown');
    expect(result.summary).toBe('URL not listed by URLhaus.');
  });

  it('handles rate limits correctly (status 429)', async () => {
    axios.post.mockResolvedValueOnce({ status: 429, data: {} });
    
    const result = await checkUrlhausURL('http://example.com');
    
    expect(result.status).toBe('rate_limited');
    expect(result.summary).toBe('URLhaus rate limit reached.');
  });

  it('handles unexpected status codes', async () => {
    axios.post.mockResolvedValueOnce({ status: 500, data: {} });
    
    const result = await checkUrlhausURL('http://example.com');
    
    expect(result.status).toBe('error');
    expect(result.summary).toContain('unexpected status 500');
  });

  it('handles timeouts correctly', async () => {
    const error = new Error('timeout of 4000ms exceeded');
    error.code = 'ECONNABORTED';
    axios.post.mockRejectedValueOnce(error);
    
    const result = await checkUrlhausURL('http://example.com');
    
    expect(result.status).toBe('timeout');
    expect(result.summary).toBe('URLhaus request timed out.');
  });

  it('handles generic network errors', async () => {
    const error = new Error('Network Error');
    axios.post.mockRejectedValueOnce(error);
    
    const result = await checkUrlhausURL('http://example.com');
    
    expect(result.status).toBe('error');
    expect(result.summary).toContain('Network Error');
  });
});
