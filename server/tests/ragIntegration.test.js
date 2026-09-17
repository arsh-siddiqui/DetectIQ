'use strict';

const mongoose = require('mongoose');
const { scanContent } = require('../controllers/scanController');
const EmailHistory = require('../models/EmailHistory');
const User = require('../models/User');
const ragClient = require('../services/ragClient');
const mlService = require('../services/mlService');

// Mock req and res for the controller
const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('RAG Data Flow Integration Tests', () => {
  let userA, userB;

  beforeAll(async () => {
    await mongoose.connect('mongodb://localhost:27017/detectiq_test_rag', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
  });

  afterAll(async () => {
    await mongoose.connection.db.dropDatabase();
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await EmailHistory.deleteMany({});
    jest.clearAllMocks();

    userA = await User.create({ email: 'usera@example.com', password: 'password123', name: 'User A' });
    userB = await User.create({ email: 'userb@example.com', password: 'password123', name: 'User B' });

    // Mock ML text classifier to always return legitimate so it doesn't interfere
    jest.spyOn(mlService, 'classifyText').mockResolvedValue({
      status: 'available',
      label: 'safe',
      probability: 0.1,
      modelName: 'Test',
      modelVersion: '1.0'
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('Case 1: User has zero historical emails -> no_history', async () => {
    const req = {
      user: userA,
      body: { content: 'Test email content', scanType: 'email' }
    };
    const res = mockRes();

    await scanContent(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const result = res.json.mock.calls[0][0].data.result;
    
    expect(result.emailPatternComparison.status).toBe('no_history');
    expect(result.emailPatternComparison.historyCount).toBe(0);
  });

  it('Case 2: User has 4 historical emails but RAG offline -> unavailable', async () => {
    // Add 4 emails
    for (let i = 0; i < 4; i++) {
      await EmailHistory.create({
        user: userA._id,
        sender: 'test@example.com',
        recipient: 'me',
        subject: 'Test',
        body: 'Test body',
        isLegitimateContext: true,
        fingerprint: 'fp_' + Math.random(),
        normalizedText: 'test body'
      });
    }

    // Mock RAG to fail (e.g. Render OOM)
    jest.spyOn(ragClient, 'retrieveContext').mockRejectedValue(new Error('connect ECONNREFUSED'));

    const req = {
      user: userA,
      body: { content: 'New scan email', scanType: 'email' }
    };
    const res = mockRes();

    await scanContent(req, res);

    const result = res.json.mock.calls[0][0].data.result;
    
    expect(result.emailPatternComparison.status).toBe('unavailable');
    expect(result.emailPatternComparison.historyCount).toBe(4);
  });

  it('Case 3: RAG online but no meaningful match -> no_match', async () => {
    // Add 4 emails
    for (let i = 0; i < 4; i++) {
      await EmailHistory.create({
        user: userA._id,
        sender: 'test@example.com',
        recipient: 'me',
        subject: 'Test',
        body: 'Test body',
        isLegitimateContext: true,
        fingerprint: 'fp_' + Math.random(),
        normalizedText: 'test body'
      });
    }

    // Mock RAG to return no results
    jest.spyOn(ragClient, 'retrieveContext').mockResolvedValue({
      success: true,
      results: []
    });

    const req = {
      user: userA,
      body: { content: 'Completely different email', scanType: 'email' }
    };
    const res = mockRes();

    await scanContent(req, res);

    const result = res.json.mock.calls[0][0].data.result;
    
    expect(result.emailPatternComparison.status).toBe('no_match');
    expect(result.emailPatternComparison.historyCount).toBe(4);
  });

  it('Case 4: RAG online and match found -> available', async () => {
    const historicalDoc = await EmailHistory.create({
      user: userA._id,
      sender: 'academics@somaiya.edu',
      recipient: 'me',
      subject: 'Exam Schedule',
      body: 'Exams are coming up.',
      isLegitimateContext: true,
      fingerprint: 'fp123',
      normalizedText: 'exams are coming up'
    });

    jest.spyOn(ragClient, 'retrieveContext').mockResolvedValue({
      success: true,
      results: [{ emailId: historicalDoc._id.toString(), similarity: 0.95 }]
    });

    jest.spyOn(ragClient, 'buildRagContext').mockResolvedValue({
      success: true,
      context: 'Context built successfully.'
    });

    const req = {
      user: userA,
      body: { content: 'From: security@somaiya-account-alert.test\nExams are coming up.', scanType: 'email' }
    };
    const res = mockRes();

    await scanContent(req, res);

    const result = res.json.mock.calls[0][0].data.result;
    
    expect(result.emailPatternComparison.status).toBe('available');
    expect(result.emailPatternComparison.historyCount).toBe(1);
    expect(result.emailPatternComparison.senderComparison).toBeDefined();
    expect(result.emailPatternComparison.senderComparison.match).toBe(false); // academics@somaiya.edu != security@somaiya-account-alert.test
  });

  it('Case 5: Cross-user isolation', async () => {
    // User B has 4 emails
    for (let i = 0; i < 4; i++) {
      await EmailHistory.create({
        user: userB._id,
        sender: 'test@example.com',
        recipient: 'me',
        subject: 'Test',
        body: 'Test body',
        isLegitimateContext: true,
        fingerprint: 'fp_' + Math.random(),
        normalizedText: 'test body'
      });
    }

    // User A has 0 emails
    const req = {
      user: userA, // Scanning as User A
      body: { content: 'Test', scanType: 'email' }
    };
    const res = mockRes();

    await scanContent(req, res);

    const result = res.json.mock.calls[0][0].data.result;
    
    // User A should see no history, even though User B has 4.
    expect(result.emailPatternComparison.status).toBe('no_history');
    expect(result.emailPatternComparison.historyCount).toBe(0);
  });
});
