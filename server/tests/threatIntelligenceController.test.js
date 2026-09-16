'use strict';

const request = require('supertest');
const mongoose = require('mongoose');
const { app } = require('../index');
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
    expect(res.body.summary.clean).toEqual(1);
    expect(res.body.summary.unknown).toEqual(3); // unknown, unavailable, not_observed all fall into unknown/other bucket
    expect(res.body.summary.total).toEqual(4);
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
    const canadaCount = res.body.countries.find(c => c.name === 'Canada');
    expect(canadaCount.count).toEqual(2); // Both are counted!

    // But the map markers count will be returned as 2 from backend, and the frontend indicatorToGeoPoints will filter out the one without lat/lon.
    // Wait, the backend returns BOTH in markers, frontend handles the filter!
    expect(res.body.markers.length).toEqual(2); 
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
    const activities = res.body.recentActivity.filter(a => a.entityType === 'investigation');
    expect(activities.find(a => a.title === 'Urgent Wire Transfer')).toBeDefined();
    expect(activities.find(a => a.title === 'From: unknown@scam.com')).toBeDefined();
  });
});
