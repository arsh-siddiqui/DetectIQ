'use strict';

/**
 * Injects advanced HTTP security and defense-in-depth headers.
 */
function securityHeaders(req, res, next) {
  // Prevent MIME-sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Prevent clickjacking via iframes
  res.setHeader('X-Frame-Options', 'DENY');

  // Strict cross-domain policy
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');

  // Restrict browser permissions for hardware/APIs
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(), usb=(), vr=(), interest-cohort=()'
  );

  // Cross-Origin Resource Policy
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

  // Strict Referrer Policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Prevent browsers/proxies from caching sensitive API endpoints
  if (req.path.startsWith('/api/auth') || req.path.startsWith('/api/user') || req.path.startsWith('/api/admin')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }

  next();
}

module.exports = securityHeaders;
