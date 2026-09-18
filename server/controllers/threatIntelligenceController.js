const asyncHandler = require("express-async-handler");
const Indicator = require("../models/Indicator");
const EmailInvestigation = require("../models/EmailInvestigation");
const mongoose = require("mongoose");

/**
 * @route   GET /api/security/threat-intelligence/overview
 * @desc    Get aggregated threat intelligence data for the global dashboard
 * @access  Private
 */
exports.getThreatIntelligenceOverview = asyncHandler(async (req, res) => {
  const { timeRange, threatStatus, indicatorType, country, investigation } = req.query;

  // Build the base filter
  const filter = { user: req.user._id };

  // 1. Time Range Filter
  if (timeRange && timeRange !== 'all') {
    const now = new Date();
    let pastDate = new Date();
    if (timeRange === 'today') pastDate.setHours(0, 0, 0, 0);
    else if (timeRange === '24h') pastDate.setHours(now.getHours() - 24);
    else if (timeRange === '7d') pastDate.setDate(now.getDate() - 7);
    else if (timeRange === '30d') pastDate.setDate(now.getDate() - 30);
    
    filter.createdAt = { $gte: pastDate };
  }

  // 2. Investigation Filter
  if (investigation && investigation !== 'all') {
    const invId = new mongoose.Types.ObjectId(investigation);
    filter.investigation = invId;
  }

  // Fetch Raw Indicators
  // We fetch up to 2000 indicators so the frontend can compute all stats dynamically
  const indicators = await Indicator.find(filter)
    .select('_id value normalizedValue type threatStatus geolocation geolocations city country asn isp intelligence investigation createdAt')
    .sort({ createdAt: -1 })
    .limit(2000)
    .lean();

  const limitReached = indicators.length === 2000;

  // Fetch Recent Investigations for the same time window
  let invFilter = { user: req.user._id };
  if (timeRange && filter.createdAt) invFilter.createdAt = filter.createdAt;
  if (investigation && investigation !== 'all') invFilter._id = new mongoose.Types.ObjectId(investigation);

  const recentInvestigations = await EmailInvestigation.find(invFilter)
    .select('_id headers.subject headers.from sourceType status createdAt')
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  res.json({
    indicators,
    recentInvestigations,
    limitReached
  });
});
