'use strict';

/**
 * Deeply sanitizes an object or array by removing keys that start with '$'
 * or contain '.' to prevent MongoDB / NoSQL query injection attacks.
 * 
 * Example attacks mitigated:
 * - req.body = { email: { $gt: "" }, password: { $gt: "" } }
 * - req.query = { role: { $ne: "user" } }
 * - req.body = { $where: "sleep(5000)" }
 */
function sanitizeInput(data) {
  if (data === null || data === undefined) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeInput(item));
  }

  if (typeof data === 'object') {
    const cleanObj = {};
    for (const key of Object.keys(data)) {
      // Reject or sanitize keys starting with '$' or containing '.'
      if (key.startsWith('$') || key.includes('.')) {
        // Strip out the dangerous key to prevent NoSQL operator injection
        continue;
      }
      cleanObj[key] = sanitizeInput(data[key]);
    }
    return cleanObj;
  }

  return data;
}

/**
 * Express middleware that sanitizes req.body, req.query, and req.params
 */
function mongoSanitize(req, res, next) {
  if (req.body) {
    req.body = sanitizeInput(req.body);
  }
  if (req.query) {
    req.query = sanitizeInput(req.query);
  }
  if (req.params) {
    req.params = sanitizeInput(req.params);
  }
  next();
}

module.exports = { mongoSanitize, sanitizeInput };
