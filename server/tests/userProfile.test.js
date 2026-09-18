const mongoose = require('mongoose');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../server');
const User = require('../models/User');
const env = require('../config/env');
const { connectDB } = require('../config/db');

beforeAll(async () => {
  await connectDB();
  await new Promise(resolve => setTimeout(resolve, 500));
});

afterAll(async () => {
  await mongoose.connection.close();
});

describe('User Profile & Authentication API', () => {
  let userA, userB, tokenA, tokenB;

  beforeEach(async () => {
    await User.deleteMany({ email: { $in: ['usera@test.com', 'userb@test.com', 'updated@test.com'] } });

    userA = await User.create({
      name: 'User A',
      email: 'usera@test.com',
      password: 'password123',
      preferences: {
        theme: 'system',
        notifications: true,
        emailAlerts: true,
        weeklySummary: false
      }
    });

    userB = await User.create({
      name: 'User B',
      email: 'userb@test.com',
      password: 'password123',
      preferences: {
        theme: 'dark',
        notifications: false,
        emailAlerts: false,
        weeklySummary: true
      }
    });

    tokenA = jwt.sign({ id: userA._id }, env.JWT_SECRET, { expiresIn: '1h' });
    tokenB = jwt.sign({ id: userB._id }, env.JWT_SECRET, { expiresIn: '1h' });
  });

  describe('GET /api/users/profile', () => {
    it('1. should retrieve the authenticated user profile', async () => {
      const res = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.data.user.email).toBe(userA.email);
      expect(res.body.data.user.name).toBe(userA.name);
      
      // 12. No password leakage in API response
      expect(res.body.data.user.password).toBeUndefined();
    });

    it('11. should isolate users (User A cannot get User B profile)', async () => {
      const res = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.body.data.user.email).not.toBe(userB.email);
    });
  });

  describe('PUT /api/users/profile', () => {
    it('2. should update profile name (email is not updatable via this endpoint)', async () => {
      const res = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ name: 'User A Updated', email: 'updated@test.com' });

      expect(res.status).toBe(200);
      expect(res.body.data.user.name).toBe('User A Updated');
      // Email is not in allowedFields - should remain unchanged
      expect(res.body.data.user.email).toBe('usera@test.com');
    });

    it('3. should validate empty name', async () => {
      const res = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ name: '' });

      expect(res.status).toBe(422); // Validation error
    });

    it('4. email field is silently ignored (not a validated field)', async () => {
      const res = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ email: '' });

      // Profile endpoint ignores unknown/disallowed fields, returns 200
      expect(res.status).toBe(200);
    });

    it('10. should persist notification preferences', async () => {
      const res = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          preferences: {
            emailAlerts: false,
            weeklySummary: true
          }
        });

      expect(res.status).toBe(200);
      expect(res.body.data.user.preferences.emailAlerts).toBe(false);
      expect(res.body.data.user.preferences.weeklySummary).toBe(true);

      // Verify in DB
      const dbUser = await User.findById(userA._id);
      expect(dbUser.preferences.emailAlerts).toBe(false);
      expect(dbUser.preferences.weeklySummary).toBe(true);
    });
  });

  describe('PUT /api/users/password', () => {
    it('5, 9. should change password successfully and update lastPasswordChange', async () => {
      const res = await request(app)
        .put('/api/users/password')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          currentPassword: 'password123',
          newPassword: 'newpassword123'
        });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Password updated successfully.');

      // Verify lastPasswordChange is updated
      const dbUser = await User.findById(userA._id);
      expect(dbUser.lastPasswordChange).toBeDefined();
      
      // Verify login works with new password
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: userA.email, password: 'newpassword123' });
      expect(loginRes.status).toBe(200);
    });

    it('6. should fail with incorrect current password', async () => {
      const res = await request(app)
        .put('/api/users/password')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          currentPassword: 'wrongpassword',
          newPassword: 'newpassword123'
        });

      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Incorrect current password.');
    });

    it('7. should fail with invalid new password (too short)', async () => {
      const res = await request(app)
        .put('/api/users/password')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          currentPassword: 'password123',
          newPassword: 'short'
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('New password must be at least 8 characters.');
    });
  });
});
