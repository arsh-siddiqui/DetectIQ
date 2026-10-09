import { describe, it, expect, vi } from 'vitest';
import { sanitizeInput, mongoSanitize } from '../middleware/mongoSanitize';
import preventHPP from '../middleware/hpp';
import securityHeaders from '../middleware/securityHeaders';

describe('Advanced Security Hardening Suite', () => {
  describe('NoSQL Injection Sanitizer (mongoSanitize)', () => {
    it('strips $ operators from malicious objects', () => {
      const maliciousPayload = {
        email: { $gt: '' },
        password: { $ne: null },
        normalField: 'test@example.com'
      };

      const sanitized = sanitizeInput(maliciousPayload);

      expect(sanitized).toEqual({
        email: {},
        password: {},
        normalField: 'test@example.com'
      });
      expect(sanitized.email.$gt).toBeUndefined();
      expect(sanitized.password.$ne).toBeUndefined();
    });

    it('strips dotted keys that can exploit nested field paths', () => {
      const payload = {
        'admin.role': 'superuser',
        safeField: 'hello'
      };

      const sanitized = sanitizeInput(payload);
      expect(sanitized).toEqual({ safeField: 'hello' });
      expect(sanitized['admin.role']).toBeUndefined();
    });

    it('handles arrays and deeply nested structures recursively', () => {
      const complex = {
        items: [
          { $where: 'sleep(1000)', valid: 1 },
          { nested: { $regex: '.*', keep: 'yes' } }
        ]
      };

      const sanitized = sanitizeInput(complex);
      expect(sanitized.items[0].$where).toBeUndefined();
      expect(sanitized.items[0].valid).toBe(1);
      expect(sanitized.items[1].nested.$regex).toBeUndefined();
      expect(sanitized.items[1].nested.keep).toBe('yes');
    });

    it('sanitizes req.body, req.query, and req.params in Express middleware', () => {
      const req = {
        body: { $gt: 'payload' },
        query: { filter: { $ne: 'all' } },
        params: { id: 'safe-id' }
      };
      const res = {};
      const next = vi.fn();

      mongoSanitize(req, res, next);

      expect(req.body.$gt).toBeUndefined();
      expect(req.query.filter.$ne).toBeUndefined();
      expect(req.params.id).toBe('safe-id');
      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  describe('HTTP Parameter Pollution Prevention (HPP)', () => {
    it('collapses polluted array query parameters to the last scalar value', () => {
      const hpp = preventHPP();
      const req = {
        query: {
          id: ['123', '456'],
          scanType: ['url', 'email']
        }
      };
      const res = {};
      const next = vi.fn();

      hpp(req, res, next);

      expect(req.query.id).toBe('456');
      expect(req.query.scanType).toBe('email');
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('respects whitelist options when arrays are intentionally allowed', () => {
      const hpp = preventHPP({ whitelist: ['tags'] });
      const req = {
        query: {
          tags: ['phishing', 'urgent'],
          single: ['first', 'last']
        }
      };
      const res = {};
      const next = vi.fn();

      hpp(req, res, next);

      expect(Array.isArray(req.query.tags)).toBe(true);
      expect(req.query.tags).toEqual(['phishing', 'urgent']);
      expect(req.query.single).toBe('last');
      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  describe('Advanced Security Headers Middleware', () => {
    it('sets strict defensive headers on responses', () => {
      const req = { path: '/api/scan' };
      const headers = {};
      const res = {
        setHeader: vi.fn((key, value) => {
          headers[key] = value;
        })
      };
      const next = vi.fn();

      securityHeaders(req, res, next);

      expect(headers['X-Content-Type-Options']).toBe('nosniff');
      expect(headers['X-Frame-Options']).toBe('DENY');
      expect(headers['X-Permitted-Cross-Domain-Policies']).toBe('none');
      expect(headers['Permissions-Policy']).toContain('camera=()');
      expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('injects no-cache headers on sensitive authentication routes', () => {
      const req = { path: '/api/auth/me' };
      const headers = {};
      const res = {
        setHeader: vi.fn((key, value) => {
          headers[key] = value;
        })
      };
      const next = vi.fn();

      securityHeaders(req, res, next);

      expect(headers['Cache-Control']).toBe('no-store, no-cache, must-revalidate, proxy-revalidate');
      expect(headers['Pragma']).toBe('no-cache');
      expect(headers['Expires']).toBe('0');
      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  describe('Cross-Site Request Forgery (CSRF) Origin Protection', () => {
    const csrfProtection = require('../middleware/csrfProtection');

    it('allows safe read methods without origin checks', () => {
      const req = { method: 'GET', cookies: { detectiq_token: 'valid' } };
      const res = {};
      const next = vi.fn();

      csrfProtection(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('allows requests with explicit Authorization Bearer headers', () => {
      const req = {
        method: 'POST',
        headers: { authorization: 'Bearer some-jwt-token' },
        cookies: { detectiq_token: 'valid' }
      };
      const res = {};
      const next = vi.fn();

      csrfProtection(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('allows cookie-authenticated mutations from trusted frontend origin', () => {
      const req = {
        method: 'POST',
        headers: { origin: 'http://localhost:5173' },
        cookies: { detectiq_token: 'valid' }
      };
      const res = {};
      const next = vi.fn();

      csrfProtection(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('blocks cookie-authenticated mutations from unauthorized third-party origins', () => {
      const req = {
        method: 'POST',
        headers: { origin: 'https://evil-hacker-site.com' },
        cookies: { detectiq_token: 'valid' }
      };
      let statusCalled = null;
      let jsonCalled = null;
      const res = {
        status: (code) => {
          statusCalled = code;
          return {
            json: (payload) => {
              jsonCalled = payload;
            }
          };
        }
      };
      const next = vi.fn();

      csrfProtection(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(statusCalled).toBe(403);
      expect(jsonCalled.message).toContain('CSRF');
    });

    it('allows cookie-authenticated mutations from Chrome extension origin', () => {
      const req = {
        method: 'POST',
        headers: { origin: 'chrome-extension://nkbihfbeogaeaoehlefnkodbefgpgknn' },
        cookies: { detectiq_token: 'valid' }
      };
      const res = {};
      const next = vi.fn();

      csrfProtection(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
    });
  });
});
