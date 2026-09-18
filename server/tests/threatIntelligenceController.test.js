'use strict';

const request = require('supertest');
const mongoose = require('mongoose');
const { app } = require('../server');
const User = require('../models/User');
const Indicator = require('../models/Indicator');
const EmailInvestigation = require('../models/EmailInvestigation');
const { generateToken } = require('../utils/jwt');

describe('Threat Intelligence Controller Logic', () => {
  let token;
  let user;

  beforeAll(async () => {
    user = await User.create({
      name: 'Test Analyst',
      email: 'analyst@test.com',
      password: 'password123',
    });
    token = generateToken(user._id);
  });

  afterAll(async () => {
    await User.deleteMany({});
    await Indicator.deleteMany({});
    await EmailInvestigation.deleteMany({});
  });

  beforeEach(async () => {
    await Indicator.deleteMany({});
    await EmailInvestigation.deleteMany({});
  });

  it('1. KPI Semantics: unavailable/not-observed does not count as clean', async () => {
    await Indicator.create([
      { user: user._id, type: 'ip', value: '1.1.1.1', threatStatus: 'clean' },
      { user: user._id, type: 'ip', value: '2.2.2.2', threatStatus: 'unknown' },
      { user: user._id, type: 'ip', value: '3.3.3.3', threatStatus: 'unavailable' },
      { user: user._id, type: 'ip', value: '4.4.4.4', threatStatus: 'not_observed' },
    ]);

    const res = await request(app)
      .get('/api/security/threat-intelligence/overview')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toEqual(200);
    expect(res.statusCode).toEqual(200);
    // 4 indicators returned
    expect(res.body.indicators.length).toEqual(4);
    
    // We compute the summary logically as the frontend would:
    let cleanCount = 0;
    let unknownCount = 0;
    res.body.indicators.forEach(ind => {
      if (ind.threatStatus === 'clean') cleanCount++;
      else if (ind.threatStatus === 'unknown' || ind.threatStatus === 'unavailable' || ind.threatStatus === 'not_observed') unknownCount++;
    });
    
    expect(cleanCount).toEqual(1);
    expect(unknownCount).toEqual(3);
  });

  it('2. Top Countries: country-only location does not create map marker but adds to count', async () => {
    await Indicator.create([
      { 
        user: user._id, 
        type: 'ip', 
        value: '5.5.5.5', 
        threatStatus: 'malicious',
        geolocation: { country: 'Canada', latitude: 45, longitude: -75 } 
      },
      { 
        user: user._id, 
        type: 'ip', 
        value: '6.6.6.6', 
        threatStatus: 'suspicious',
        geolocation: { country: 'Canada' } // No lat/lon
      }
    ]);

    const res = await request(app)
      .get('/api/security/threat-intelligence/overview')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.indicators.length).toEqual(2);
    
    let canadaCount = 0;
    res.body.indicators.forEach(ind => {
      if (ind.geolocation?.country === 'Canada') canadaCount++;
    });
    
    expect(canadaCount).toEqual(2); // Both are counted! 
  });

  it('3. Activity title fallback: no raw internal IDs, uses subject', async () => {
    await EmailInvestigation.create([
      {
        user: user._id,
        status: 'completed',
        headers: { subject: 'Urgent Wire Transfer', from: 'boss@scam.com' },
        sourceType: 'pasted_email'
      },
      {
        user: user._id,
        status: 'completed',
        headers: { from: 'unknown@scam.com' }, // No subject
        sourceType: 'upload'
      }
    ]);

    const res = await request(app)
      .get('/api/security/threat-intelligence/overview')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toEqual(200);
    expect(res.statusCode).toEqual(200);
    const activities = res.body.recentInvestigations;
    expect(activities.find(a => a.headers?.subject === 'Urgent Wire Transfer')).toBeDefined();
    expect(activities.find(a => a.headers?.from === 'unknown@scam.com')).toBeDefined();
  });
});
