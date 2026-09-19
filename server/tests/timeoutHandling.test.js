'use strict';

const assert = require('assert');

const mlService = require('../services/mlService');
const threatIntelService = require('../services/threatIntel/threatIntelService');
const ragClient = require('../services/ragClient');
const { analyzeContent } = require('../services/scanner/index');

describe('Test Suite: ML and Provider Timeout Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(mlService, 'classifyText').mockImplementation(() => Promise.resolve());
    vi.spyOn(threatIntelService, 'getThreatIntelligence').mockImplementation(() => Promise.resolve());
    vi.spyOn(ragClient, 'retrieveContext').mockImplementation(() => Promise.resolve());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('1. Email scan continues when ML is unavailable (simulated timeout)', async () => {
    mlService.classifyText.mockRejectedValueOnce(Object.assign(new Error('timeout'), { code: 'ECONNABORTED' }));
    threatIntelService.getThreatIntelligence.mockResolvedValueOnce(null);
    ragClient.retrieveContext.mockResolvedValueOnce({ success: false, reason: 'timeout' });

    const result = await analyzeContent('Fake email content with urgent request.', 'email', 'user123');

    assert.ok(result, 'Result should be returned even if ML times out');
    assert.ok(result.riskScore >= 0, 'Heuristic engine should still assign a risk score');
  });

  it('2. Email scan continues when one provider times out', async () => {
    mlService.classifyText.mockResolvedValueOnce({ status: 'available', label: 'phishing', probability: 0.9 });
    threatIntelService.getThreatIntelligence.mockRejectedValueOnce(new Error('Provider timeout'));
    
    const result = await analyzeContent('Please check this https://evil.com', 'email', 'user123');
    
    assert.ok(result);
    assert.ok(typeof result.riskScore === 'number'); 
  });
});
