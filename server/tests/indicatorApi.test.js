'use strict';

const assert = require('assert');
const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const app = require('../server');
const env = require('../config/env');
const User = require('../models/User');
const EmailInvestigation = require('../models/EmailInvestigation');
const Indicator = require('../models/Indicator');
const { connectDB } = require('../config/db');

describe('Indicator API Tests', () => {

  beforeAll(async () => {
    await connectDB();
    await new Promise(resolve => setTimeout(resolve, 500));
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  let userA, userB, authA, authB, indA1, indA2, indB1;

  beforeEach(async () => {
    await User.deleteMany({ email: { $in: ['indA@test.com', 'indB@test.com'] } });
    userA = await User.create({ name: 'User A', email: 'indA@test.com', password: 'password123' });
    userB = await User.create({ name: 'User B', email: 'indB@test.com', password: 'password123' });

    const tokenA = jwt.sign({ id: userA._id }, env.JWT_SECRET, { expiresIn: '1h' });
    authA = `Bearer ${tokenA}`;
    
    const tokenB = jwt.sign({ id: userB._id }, env.JWT_SECRET, { expiresIn: '1h' });
    authB = `Bearer ${tokenB}`;

    await EmailInvestigation.deleteMany({ user: { $in: [userA._id, userB._id] } });
    await Indicator.deleteMany({ user: { $in: [userA._id, userB._id] } });

    indA1 = await Indicator.create({
      user: userA._id,
      type: 'domain',
      value: 'evil.com',
      normalizedValue: 'evil.com',
      threatStatus: 'malicious'
    });
    
    indA2 = await Indicator.create({
      user: userA._id,
      type: 'ip',
      value: '1.2.3.4',
      normalizedValue: '1.2.3.4',
      threatStatus: 'clean',
      geolocation: { status: 'success', country: 'US' }
    });

    await EmailInvestigation.create({
      user: userA._id,
      sourceType: 'pasted_email',
      analysisDepth: 'forensic',
      headers: { subject: 'Test A' },
      indicators: [indA1._id, indA2._id]
    });
    
    await EmailInvestigation.create({
      user: userA._id,
      sourceType: 'pasted_email',
      analysisDepth: 'forensic',
      headers: { subject: 'Test A2' },
      indicators: [indA1._id]
    });

    indB1 = await Indicator.create({
      user: userB._id,
      type: 'domain',
      value: 'good.com',
      normalizedValue: 'good.com',
      threatStatus: 'clean'
    });

    await EmailInvestigation.create({
      user: userB._id,
      sourceType: 'pasted_email',
      analysisDepth: 'forensic',
      headers: { subject: 'Test B' },
      indicators: [indB1._id]
    });
  });

  it('1. Authenticated List (Pagination & Filters)', async () => {
    // List all
    const res = await request(app).get('/api/security/indicators').set('Authorization', authA);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    
    // Type Filter
    const resType = await request(app).get('/api/security/indicators?type=ip').set('Authorization', authA);
    expect(resType.body.total).toBe(1);
    expect(resType.body.indicators[0].normalizedValue).toBe('1.2.3.4');
    
    // Threat Filter
    const resThreat = await request(app).get('/api/security/indicators?threat=malicious').set('Authorization', authA);
    expect(resThreat.body.total).toBe(1);
    expect(resThreat.body.indicators[0].normalizedValue).toBe('evil.com');
  });

  it('2. Search Filter', async () => {
    const resSearch = await request(app).get('/api/security/indicators?search=evil').set('Authorization', authA);
    expect(resSearch.status).toBe(200);
    expect(resSearch.body.total).toBe(1);
    expect(resSearch.body.indicators[0].normalizedValue).toBe('evil.com');
  });

  it('3. List - User Isolation', async () => {
    const res = await request(app).get('/api/security/indicators').set('Authorization', authB);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.indicators[0].normalizedValue).toBe('good.com');
  });

  it('4. Detail - Related Investigations & User Isolation', async () => {
    const res = await request(app).get(`/api/security/indicators/${indA1._id}`).set('Authorization', authA);
    expect(res.status).toBe(200);
    expect(res.body.normalizedValue).toBe('evil.com');
    expect(res.body.relatedInvestigations.length).toBe(2); // Was placed in 2 investigations
  });

  it('5. Detail - User Isolation (User B requests User A indicator)', async () => {
    const res = await request(app).get(`/api/security/indicators/${indA1._id}`).set('Authorization', authB);
    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Indicator not found.');
  });

});
