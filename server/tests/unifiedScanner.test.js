const request = require('supertest');
const app = require('../server');
const mongoose = require('mongoose');

vi.mock('../services/mlService', () => ({
  classifyText: vi.fn().mockResolvedValue({ status: 'unavailable', reason: 'exception' })
}));

vi.mock('../services/threatIntel/threatIntelService', () => ({
  getThreatIntelligence: vi.fn().mockResolvedValue(null)
}));

vi.mock('../services/groqService', () => ({
  analyzeWithGroq: vi.fn().mockResolvedValue(null)
}));

vi.mock('../services/ragClient', () => ({
  retrieveContext: vi.fn().mockResolvedValue({ success: false })
}));

describe('Unified Multi-Channel Detection Scanner Routing', () => {

  afterAll(async () => {
    await mongoose.connection.close();
  });

  const scanEndpoint = '/api/scan';

  it('1. should accept email paste and classify as email', async () => {
    const res = await request(app)
      .post(scanEndpoint)
      .send({ scanType: 'email', content: 'From: a@b.com\nSubject: Test\nBody content' });
    expect(res.statusCode).toBe(200);
    expect(res.body.data.scanType).toBe('email');
    expect(res.body.data.inputType).toBe('email');
  });

  it('2. should accept body-only email', async () => {
    const res = await request(app)
      .post(scanEndpoint)
      .send({ scanType: 'email', content: 'Just some text from an email body.' });
    expect(res.statusCode).toBe(200);
    expect(res.body.data.scanType).toBe('email');
  });

  it('6. should accept direct URL and classify as url', async () => {
    const res = await request(app)
      .post(scanEndpoint)
      .send({ scanType: 'url', content: 'https://evil.com' });
    expect(res.statusCode).toBe(200);
    expect(res.body.data.scanType).toBe('url');
  });

  it('8. should accept direct message and classify as message', async () => {
    const res = await request(app)
      .post(scanEndpoint)
      .send({ scanType: 'message', content: 'Hey, look at this deal' });
    expect(res.statusCode).toBe(200);
    expect(res.body.data.scanType).toBe('message');
  });

  it('10. should map QR URL payload to URL analysisType', async () => {
    const res = await request(app)
      .post(scanEndpoint)
      .send({ scanType: 'qr', content: 'https://evil.com/qr' });
    expect(res.statusCode).toBe(200);
    expect(res.body.data.inputType).toBe('qr');
    expect(res.body.data.scanType).toBe('url');
  });

  it('11. should map SMS QR payload to message analysisType', async () => {
    const res = await request(app)
      .post(scanEndpoint)
      .send({ scanType: 'qr', content: 'sms:+1234567890?body=Hello' });
    expect(res.statusCode).toBe(200);
    expect(res.body.data.inputType).toBe('qr');
    expect(res.body.data.scanType).toBe('message');
  });

  it('12. should map mailto QR payload to email analysisType', async () => {
    const res = await request(app)
      .post(scanEndpoint)
      .send({ scanType: 'qr', content: 'mailto:phish@evil.com?subject=Test' });
    expect(res.statusCode).toBe(200);
    expect(res.body.data.inputType).toBe('qr');
    expect(res.body.data.scanType).toBe('email');
  });

  it('13. should map plain text QR payload to message analysisType', async () => {
    const res = await request(app)
      .post(scanEndpoint)
      .send({ scanType: 'qr', content: 'Just some text in a QR code' });
    expect(res.statusCode).toBe(200);
    expect(res.body.data.inputType).toBe('qr');
    expect(res.body.data.scanType).toBe('message');
  });

  it('15. javascript URI remains inert data and maps to message', async () => {
    const res = await request(app)
      .post(scanEndpoint)
      .send({ scanType: 'qr', content: 'javascript:alert(1)' });
    expect(res.statusCode).toBe(200);
    expect(res.body.data.inputType).toBe('qr');
    expect(res.body.data.scanType).toBe('message');
  });

  it('20. should route screenshot containing email headers to email analysisType', async () => {
    const res = await request(app)
      .post(scanEndpoint)
      .send({ scanType: 'screenshot', content: 'From: x@y.com\nTo: z@y.com\nSubject: Urgent\n\nPlease send money.' });
    expect(res.statusCode).toBe(200);
    expect(res.body.data.inputType).toBe('screenshot');
    expect(res.body.data.scanType).toBe('email');
  });

  it('21. should route screenshot containing plain text to message analysisType', async () => {
    const res = await request(app)
      .post(scanEndpoint)
      .send({ scanType: 'screenshot', content: 'Hey, can we meet?' });
    expect(res.statusCode).toBe(200);
    expect(res.body.data.inputType).toBe('screenshot');
    expect(res.body.data.scanType).toBe('message');
  });

  it('28. should reject oversized payload', async () => {
    const massiveContent = 'A'.repeat(15000);
    const res = await request(app)
      .post(scanEndpoint)
      .send({ scanType: 'message', content: massiveContent });
    expect(res.statusCode).toBe(400); // Handled by standard express error handler logic in our app
  });

  it('28. should reject empty payload', async () => {
    const res = await request(app)
      .post(scanEndpoint)
      .send({ scanType: 'message', content: '   ' });
    expect(res.statusCode).toBe(400);
  });
});
