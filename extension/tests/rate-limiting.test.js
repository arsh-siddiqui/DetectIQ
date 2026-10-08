import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { apiLimiter, authLimiter, scanLimiter } = require('../../server/middleware/rateLimiter.js');

test('Rate Limiter: Middleware Definitions & Exits', () => {
  assert.equal(typeof apiLimiter, 'function', 'apiLimiter must be an Express middleware function');
  assert.equal(typeof authLimiter, 'function', 'authLimiter must be an Express middleware function');
  assert.equal(typeof scanLimiter, 'function', 'scanLimiter must be an Express middleware function');
});

test('Rate Limiter: Allows Normal Incoming Traffic within Window', async () => {
  let nextCalled = false;
  const mockReq = {
    ip: '192.168.1.50',
    headers: {},
    path: '/api/scan',
    app: { get: () => 1 }
  };
  const mockRes = {
    setHeader: () => {},
    getHeader: () => {},
    status: () => mockRes,
    json: () => mockRes,
    send: () => mockRes
  };
  const mockNext = () => { nextCalled = true; };

  // First request should pass through cleanly
  await apiLimiter(mockReq, mockRes, mockNext);
  assert.equal(nextCalled, true, 'apiLimiter must call next() for requests within quota');
});

test('Rate Limiter: Auth Rate Limiter Enforcement Under Rapid Fire', async () => {
  const testIp = '10.0.0.99';
  let rejected = false;
  let responseData = null;

  for (let i = 0; i < 20; i++) {
    const mockReq = {
      ip: testIp,
      headers: {},
      path: '/api/auth/login',
      app: { get: () => 1 }
    };
    const mockRes = {
      setHeader: () => {},
      getHeader: () => {},
      status: (statusCode) => {
        if (statusCode === 429) rejected = true;
        return mockRes;
      },
      json: (data) => {
        responseData = data;
        return mockRes;
      },
      send: (data) => {
        responseData = data;
        return mockRes;
      }
    };
    let nextCalled = false;
    await authLimiter(mockReq, mockRes, () => { nextCalled = true; });

    if (i >= 15 && rejected) {
      break;
    }
  }

  assert.equal(rejected, true, 'Auth limiter must reject requests exceeding quota with HTTP 429');
  assert.ok(responseData && JSON.stringify(responseData).includes('Too many authentication attempts'), 'Should return clear error message');
});
