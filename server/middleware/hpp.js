'use strict';

/**
 * Protects against HTTP Parameter Pollution (HPP) attacks.
 * If an attacker passes multiple query parameters with the same name (e.g. ?id=1&id=2),
 * Express parses them as an array ['1', '2'], which can bypass security filters
 * or cause runtime TypeErrors (e.g. calling .trim() on an array).
 * 
 * This middleware cleans req.query by retaining only the last value for scalar parameters.
 */
function preventHPP(options = {}) {
  const whitelist = options.whitelist || [];

  return function hpp(req, res, next) {
    if (!req.query || typeof req.query !== 'object') {
      return next();
    }

    for (const key of Object.keys(req.query)) {
      if (whitelist.includes(key)) {
        continue;
      }
      if (Array.isArray(req.query[key])) {
        // Take the last item in the array to keep scalar parameter semantics
        req.query[key] = req.query[key][req.query[key].length - 1];
      }
    }

    next();
  };
}

module.exports = preventHPP;
