'use strict';

const ragClient = require('../services/ragClient');
const mlService = require('../services/mlService');
const threatIntelService = require('../services/threatIntel/threatIntelService');
const groqService = require('../services/groqService');
const emailHistoryService = require('../services/emailHistoryService');

vi.spyOn(ragClient, 'retrieveContext').mockImplementation(() => Promise.resolve());
vi.spyOn(ragClient, 'clearUserIndex').mockImplementation(() => Promise.resolve());
vi.spyOn(ragClient, 'embedEmail').mockImplementation(() => Promise.resolve());
vi.spyOn(ragClient, 'buildRagContext').mockImplementation(() => Promise.resolve());

vi.spyOn(mlService, 'classifyText').mockResolvedValue({ status: 'available', isPhishing: false });
vi.spyOn(threatIntelService, 'getThreatIntelligence').mockResolvedValue(null);
vi.spyOn(groqService, 'analyzeWithGroq').mockResolvedValue(null);
vi.spyOn(emailHistoryService, 'rebuildUserRAGIndex').mockResolvedValue({ successCount: 1, failCount: 0, total: 1 });
vi.spyOn(emailHistoryService, 'triggerRebuild').mockImplementation(() => {});

const EmailHistory = require('../models/EmailHistory');
const mongoose = require('mongoose');
const { analyzeContent } = require('../services/scanner');

vi.spyOn(EmailHistory, 'countDocuments').mockResolvedValue(1);

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
