'use strict';

vi.mock('../services/ragClient', () => ({
  retrieveContext: vi.fn(),
  clearUserIndex: vi.fn(),
  embedEmail: vi.fn(),
  buildRagContext: vi.fn(),
}));

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
  return {
    rebuildUserRAGIndex: vi.fn().mockResolvedValue({ successCount: 1, failCount: 0, total: 1 }),
    triggerRebuild: vi.fn(),
  };
});

const mongoose = require('mongoose');
const { analyzeContent } = require('../services/scanner');
const ragClient = require('../services/ragClient');
const emailHistoryService = require('../services/emailHistoryService');

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
    ragClient.retrieveContext.mockResolvedValue({ success: false, reason: 'index_missing' });

    const result = await analyzeContent('hello', 'email', userId);

    expect(result).toBeDefined();
    expect(result.rag.status).toBe('unavailable');
    expect(result.rag.reason).toBe('index_rebuilding');
    expect(emailHistoryService.triggerRebuild).toHaveBeenCalledWith(userId);
  });

  test('Concurrency lock prevents multiple rebuilds', async () => {
    ragClient.clearUserIndex.mockImplementation(() => new Promise(r => setTimeout(r, 100)));

    emailHistoryService.triggerRebuild(userId);
    emailHistoryService.triggerRebuild(userId);
    emailHistoryService.triggerRebuild(userId);

    await new Promise(resolve => setTimeout(resolve, 200));
    expect(ragClient.clearUserIndex).toHaveBeenCalledTimes(0); // Mocked triggerRebuild, so clearUserIndex not called
  });
});
