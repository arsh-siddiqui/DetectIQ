'use strict';

const mongoose = require('mongoose');
const { analyzeContent } = require('../services/scanner');
const ragClient = require('../services/ragClient');
const emailHistoryService = require('../services/emailHistoryService');
const EmailHistory = require('../models/EmailHistory');

vi.mock('../services/ragClient');
vi.mock('../services/mlService', () => ({
  classifyText: vi.fn().mockResolvedValue({ status: 'available', isPhishing: false })
}));
vi.mock('../services/threatIntel/threatIntelService', () => ({
  getThreatIntelligence: vi.fn().mockResolvedValue(null)
}));
vi.mock('../services/groqService', () => ({
  analyzeWithGroq: vi.fn().mockResolvedValue(null)
}));
vi.mock('../services/emailHistoryService', () => {
  const actual = vi.requireActual('../services/emailHistoryService');
  return {
    ...actual,
    rebuildUserRAGIndex: vi.fn().mockResolvedValue({ successCount: 1, failCount: 0, total: 1 })
  };
});

describe('RAG Rebuild tests', () => {
  let userId;

  beforeAll(async () => {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/test_rag');
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
  });

  beforeEach(() => {
    userId = new mongoose.Types.ObjectId();
    vi.clearAllMocks();
  });

  test('Scanner continues and triggers rebuild on index_missing', async () => {
    // Mock ragClient to return index_missing
    ragClient.retrieveContext.mockResolvedValue({ success: false, reason: 'index_missing' });
    const triggerSpy = vi.spyOn(emailHistoryService, 'triggerRebuild').mockImplementation(() => {});

    const result = await analyzeContent('hello', 'email', userId);
    
    // Scan continues
    expect(result).toBeDefined();
    expect(result.rag.status).toBe('unavailable');
    expect(result.rag.reason).toBe('index_rebuilding');

    // Async rebuild was triggered
    expect(triggerSpy).toHaveBeenCalledWith(userId);
    triggerSpy.mockRestore();
  });

  test('Concurrency lock prevents multiple rebuilds', async () => {
    const clearSpy = vi.spyOn(ragClient, 'clearUserIndex').mockImplementation(() => new Promise(r => setTimeout(r, 100)));
    
    emailHistoryService.triggerRebuild(userId);
    emailHistoryService.triggerRebuild(userId);
    emailHistoryService.triggerRebuild(userId);

    await new Promise(resolve => setTimeout(resolve, 200));

    expect(clearSpy).toHaveBeenCalledTimes(1);
    clearSpy.mockRestore();
  });
});
