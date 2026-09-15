'use strict';

const assert = require('assert');
const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const app = require('../server');
const env = require('../config/env');
const User = require('../models/User');
const EmailInvestigation = require('../models/EmailInvestigation');
const Scan = require('../models/Scan');
const Indicator = require('../models/Indicator');
const { connectDB } = require('../config/db');

describe('Investigation API Tests', () => {

  beforeAll(async () => {
    await connectDB();
    await new Promise(resolve => setTimeout(resolve, 500));
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  let userA, userB, authA, authB, invA, invB, scanA, indA;

  beforeEach(async () => {
    await User.deleteMany({ email: { $in: ['invA@test.com', 'invB@test.com'] } });
    userA = await User.create({ name: 'User A', email: 'invA@test.com', password: 'password123' });
    userB = await User.create({ name: 'User B', email: 'invB@test.com', password: 'password123' });

    const tokenA = jwt.sign({ id: userA._id }, env.JWT_SECRET, { expiresIn: '1h' });
    authA = `Bearer ${tokenA}`;
    
    const tokenB = jwt.sign({ id: userB._id }, env.JWT_SECRET, { expiresIn: '1h' });
    authB = `Bearer ${tokenB}`;

    await Scan.deleteMany({ user: { $in: [userA._id, userB._id] } });
    await EmailInvestigation.deleteMany({ user: { $in: [userA._id, userB._id] } });
    await Indicator.deleteMany({ user: { $in: [userA._id, userB._id] } });

    scanA = await Scan.create({
      user: userA._id,
      scanType: 'email',
      inputType: 'email',
      confidence: 95,
      riskLevel: 'high',
      riskScore: 90,
      classification: 'phishing',
      evidence: []
    });

    indA = await Indicator.create({
      user: userA._id,
      type: 'ip',
      value: '1.2.3.4',
      normalizedValue: '1.2.3.4',
      threatStatus: 'malicious'
    });

    invA = await EmailInvestigation.create({
      user: userA._id,
      scanId: scanA._id,
      sourceType: 'pasted_email',
      analysisDepth: 'forensic',
      enrichmentStatus: 'completed',
      headers: { subject: 'Test A' },
      indicators: [indA._id]
    });

    invB = await EmailInvestigation.create({
      user: userB._id,
      sourceType: 'pasted_email',
      analysisDepth: 'forensic',
      headers: { subject: 'Test B' }
    });
  });

  it('1. Authenticated List (Pagination, no body payloads)', async () => {
    const res = await request(app).get('/api/security/investigations').set('Authorization', authA);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.investigations[0].subject).toBe('Test A');
    expect(res.body.investigations[0].classification).toBe('phishing');
    expect(res.body.investigations[0].indicatorCount).toBe(1);
    expect(res.body.investigations[0].body).toBeUndefined();
  });

  it('2. List - User Isolation', async () => {
    const res = await request(app).get('/api/security/investigations').set('Authorization', authB);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.investigations[0].subject).toBe('Test B');
  });

  it('3. Detail - Full Graph and Timeline generated', async () => {
    const res = await request(app).get(`/api/security/investigations/${invA._id}`).set('Authorization', authA);
    expect(res.status).toBe(200);
    expect(res.body.subject).toBeUndefined(); // It is inside headers
    expect(res.body.headers.subject).toBe('Test A');
    expect(res.body.graph).toBeDefined();
    expect(res.body.timeline).toBeDefined();
    expect(res.body.indicators.length).toBe(1);
    expect(res.body.indicators[0].normalizedValue).toBe('1.2.3.4'); // populated properly
    
    const resString = JSON.stringify(res.body);
    expect(resString.includes(env.JWT_SECRET)).toBe(false);
  });

  it('4. Detail - Missing / User Isolation (User B requests User A)', async () => {
    const res = await request(app).get(`/api/security/investigations/${invA._id}`).set('Authorization', authB);
    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Investigation not found.');
  });

  it('5. List - Classification and Risk filtering', async () => {
    const res = await request(app).get('/api/security/investigations?riskLevel=high').set('Authorization', authA);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);

    const resEmpty = await request(app).get('/api/security/investigations?riskLevel=low').set('Authorization', authA);
    expect(resEmpty.status).toBe(200);
    expect(resEmpty.body.total).toBe(0);
  });

});
