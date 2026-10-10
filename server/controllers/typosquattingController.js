'use strict';

const asyncHandler = require('express-async-handler');
const sendSuccess = require('../utils/apiResponse');
const { generateAndAnalyzeTyposquatting } = require('../services/security/typosquattingService');

// @route  POST /api/security/typosquatting
// @route  GET /api/security/typosquatting
// @access Private (authenticated users)
const analyzeTyposquatting = asyncHandler(async (req, res) => {
  const brandOrDomain = req.body?.brand || req.query?.brand || req.body?.domain || req.query?.domain;

  if (!brandOrDomain || typeof brandOrDomain !== 'string' || brandOrDomain.trim().length < 2) {
    res.status(400);
    throw new Error('Please provide a valid brand name or domain (e.g. "paypal" or "google.com").');
  }

  const limit = Math.min(parseInt(req.body?.limit || req.query?.limit || 40, 10), 60);
  const checkDns = req.body?.checkDns !== false && req.query?.checkDns !== 'false';

  const result = await generateAndAnalyzeTyposquatting(brandOrDomain, { limit, checkDns });

  return sendSuccess(res, {
    message: `Generated and analyzed lookalike domains for "${result.target}".`,
    data: result,
  });
});

module.exports = {
  analyzeTyposquatting,
};
