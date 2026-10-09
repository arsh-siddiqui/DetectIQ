'use strict';

const env = require('../config/env');

/**
 * Enterprise CSRF & Cross-Site Request Origin Verifier.
 * 
 * Protects state-changing endpoints (POST, PUT, DELETE, PATCH) when authenticated
 * via session cookies against Cross-Site Request Forgery (CSRF).
 * 
 * Rules:
 * 1. Safe read methods (GET, HEAD, OPTIONS) pass through.
 * 2. Requests using Authorization Bearer token headers pass through (browsers
 *    do not attach Bearer headers automatically on forged cross-origin requests).
 * 3. Requests without authentication cookies pass through (not vulnerable to session riding).
 * 4. Requests with auth cookies MUST originate from a trusted Origin or Referer.
 */
function csrfProtection(req, res, next) {
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method)) {
    return next();
  }

  // Explicit Bearer headers are inherently immune to browser CSRF
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    return next();
  }

  // If there's no auth cookie, the request is not authenticated via credentials
  const token = req.cookies?.[env.JWT_COOKIE_NAME];
  if (!token) {
    return next();
  }

  // Check Origin / Referer for authenticated mutations
  const origin = req.headers.origin;
  const referer = req.headers.referer;

  const isAllowedOrigin = (urlStr) => {
    if (!urlStr) return false;
    if (urlStr.startsWith('chrome-extension://') || urlStr.startsWith('moz-extension://')) {
      return true;
    }
    try {
      const parsed = new URL(urlStr);
      const originBase = parsed.origin;

      if (originBase === env.FRONTEND_URL) return true;
      if (/^http:\/\/localhost:517\d$/.test(originBase)) return true;
      if (/^http:\/\/127\.0\.0\.1:517\d$/.test(originBase)) return true;
      if (originBase === 'http://localhost:3000') return true;
      if (originBase === 'http://127.0.0.1:3000') return true;
      return false;
    } catch {
      return false;
    }
  };

  if (origin && isAllowedOrigin(origin)) {
    return next();
  }

  if (referer && isAllowedOrigin(referer)) {
    return next();
  }

  // In test / server-to-server environments where origin/referer may not be set
  if (!origin && !referer && env.NODE_ENV === 'test') {
    return next();
  }

  return res.status(403).json({
    success: false,
    message: 'Cross-Site Request Forgery (CSRF) blocked: Request origin not trusted.'
  });
}

module.exports = csrfProtection;
