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
      classifyText: vi.fn()
    };
    mockThreatIntelService = {
      getThreatIntelligence: vi.fn()
    };
    mockRagClient = {
      retrieveContext: vi.fn(),
      buildRagContext: vi.fn()
    };
    
    // Inject mocks into the require cache or override
    // Note: since scanner/index.js requires them lazily inside the function body, 
    // we can mock them globally for vi.
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('1. Email scan continues when ML is unavailable (simulated timeout)', async () => {
    vi.mock('../services/mlService', () => ({
      classifyText: vi.fn().mockRejectedValue(Object.assign(new Error('timeout'), { code: 'ECONNABORTED' }))
    }));
    vi.mock('../services/threatIntel/threatIntelService', () => ({
      getThreatIntelligence: vi.fn().mockResolvedValue(null)
    }));
    vi.mock('../services/ragClient', () => ({
      retrieveContext: vi.fn().mockResolvedValue({ success: false, reason: 'timeout' })
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
    vi.mock('../services/mlService', () => ({
      classifyText: vi.fn().mockResolvedValue({ status: 'available', label: 'phishing', probability: 0.9 })
    }));
    vi.mock('../services/threatIntel/threatIntelService', () => ({
      getThreatIntelligence: vi.fn().mockRejectedValue(new Error('Provider timeout'))
    }));
    
    delete require.cache[require.resolve('../services/scanner/index')];
    const scanner = require('../services/scanner/index');

    const result = await scanner.analyzeContent('Please check this https://evil.com', 'email', 'user123');
    
    assert.ok(result);
    assert.ok(typeof result.riskScore === 'number'); 
  });
});
