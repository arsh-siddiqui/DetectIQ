const { askCopilot } = require('../services/ai/copilotService');
const env = require('../config/env');
const axios = require('axios');
const mongoose = require('mongoose');

vi.mock('axios');

describe('copilotService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    env.GROQ_API_KEY = 'test_key';
  });

  it('should reject oversized questions', async () => {
    const bigQuestion = 'A'.repeat(1000); // MAX_QUESTION_LENGTH is 500
    
    await expect(askCopilot(bigQuestion, { _id: new mongoose.Types.ObjectId() }, {}, [], [], {}))
      .rejects.toThrow('Question is too long');
  });

  it('should handle mock groq success', async () => {
    axios.post.mockResolvedValue({
      data: {
        choices: [
          { message: { content: JSON.stringify({ summary: "Valid response", confidence: 90 }) } }
        ]
      }
    });

    const investigation = { _id: new mongoose.Types.ObjectId(), headers: {} };
    const res = await askCopilot('Why is this risky?', investigation, {}, [], [], {});
    expect(res.summary).toBe('Valid response');
    expect(res.confidence).toBe(90);
  });

  it('should handle groq failure', async () => {
    axios.post.mockRejectedValue(new Error('Network Error'));

    await expect(askCopilot('Test?', { _id: new mongoose.Types.ObjectId() }, {}, [], [], {}))
      .rejects.toThrow('Network Error');
  });
});
