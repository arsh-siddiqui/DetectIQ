'use strict';

const assert = require('assert');
const { analyzeContent } = require('../services/scanner/index');

describe('Test Suite: ML and Provider Timeout Handling', () => {
  let mockMlService;
  let mockThreatIntelService;
  let mockRagClient;

  beforeEach(() => {
    // Reset mocks before each test
    mockMlService = {
      classifyText: jest.fn()
    };
    mockThreatIntelService = {
      getThreatIntelligence: jest.fn()
    };
    mockRagClient = {
      retrieveContext: jest.fn(),
      buildRagContext: jest.fn()
    };
    
    // Inject mocks into the require cache or override
    // Note: since scanner/index.js requires them lazily inside the function body, 
    // we can mock them globally for jest.
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('1. Email scan continues when ML is unavailable (simulated timeout)', async () => {
    jest.mock('../services/mlService', () => ({
      classifyText: jest.fn().mockRejectedValue(Object.assign(new Error('timeout'), { code: 'ECONNABORTED' }))
    }));
    jest.mock('../services/threatIntel/threatIntelService', () => ({
      getThreatIntelligence: jest.fn().mockResolvedValue(null)
    }));
    jest.mock('../services/ragClient', () => ({
      retrieveContext: jest.fn().mockResolvedValue({ success: false, reason: 'timeout' })
    }));

    // Clear require cache for the scanner to re-require mocked modules
    delete require.cache[require.resolve('../services/scanner/index')];
    const scanner = require('../services/scanner/index');

    const result = await scanner.analyzeContent('Fake email content with urgent request.', 'email', 'user123');

    assert.ok(result, 'Result should be returned even if ML times out');
    assert.ok(result.riskScore >= 0, 'Heuristic engine should still assign a risk score');
    // It should fallback properly
  });

  it('2. Email scan continues when one provider times out', async () => {
    jest.mock('../services/mlService', () => ({
      classifyText: jest.fn().mockResolvedValue({ status: 'available', label: 'phishing', probability: 0.9 })
    }));
    jest.mock('../services/threatIntel/threatIntelService', () => ({
      getThreatIntelligence: jest.fn().mockRejectedValue(new Error('Provider timeout'))
    }));
    
    delete require.cache[require.resolve('../services/scanner/index')];
    const scanner = require('../services/scanner/index');

    const result = await scanner.analyzeContent('Please check this https://evil.com', 'email', 'user123');
    
    assert.ok(result);
    assert.ok(typeof result.riskScore === 'number'); 
  });
});
