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

  // 2. Threat Status Filter
  if (threatStatus && threatStatus !== 'all') {
    filter.threatStatus = threatStatus.toLowerCase();
  } else {
    filter.threatStatus = { $nin: ['unknown', 'unavailable', null, ""] };
  }

  // 3. Indicator Type Filter
  if (indicatorType && indicatorType !== 'all') {
    filter.type = indicatorType.toLowerCase();
  }

  // 4. Country Filter
  if (country && country !== 'all') {
    filter.$or = [
      { 'geolocation.country': country },
      { 'geolocations.country': country }
    ];
  }

  // 5. Investigation Filter
  if (investigation && investigation !== 'all') {
    filter.investigation = new mongoose.Types.ObjectId(investigation);
  }

  // Define aggregations

  // A. Summary (Total, Malicious, Suspicious, Clean)
  const summaryAgg = await Indicator.aggregate([
    { $match: filter },
    {
      $group: {
        _id: "$threatStatus",
        count: { $sum: 1 }
      }
    }
  ]);

  let summary = {
    total: 0,
    malicious: 0,
    suspicious: 0,
    clean: 0,
    unknown: 0
  };

  summaryAgg.forEach(item => {
    summary.total += item.count;
    if (item._id === 'malicious') summary.malicious = item.count;
    else if (item._id === 'suspicious') summary.suspicious = item.count;
    else if (item._id === 'clean') summary.clean = item.count;
    else summary.unknown += item.count;
  });

  // B. Markers (For the Map)
  // We match any indicator with geolocation or geolocations array
  const mapFilter = { 
    ...filter, 
    $or: [
      { 'geolocation': { $ne: null } },
      { 'geolocations.0': { $exists: true } }
    ]
  };
  const markers = await Indicator.find(mapFilter)
    .select('value type threatStatus geolocation geolocations city country asn isp intelligence')
    .sort({ createdAt: -1 })
    .limit(2000)
    .lean();

  // C. Top Countries
  // Group by country only if country is present.
  const countriesAgg = await Indicator.aggregate([
    { $match: filter },
    { $project: { country: { $ifNull: ["$geolocation.country", { $arrayElemAt: ["$geolocations.country", 0] }] } } },
    { $match: { country: { $exists: true, $nin: [null, ""] } } },
    { $group: { _id: "$country", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 10 }
  ]);

  // D. Indicator Types
  const typesAgg = await Indicator.aggregate([
    { $match: filter },
    { $group: { _id: "$type", count: { $sum: 1 } } }
  ]);

  // E. Recent Activity
  // We want to combine recent indicators and recent investigations (if applicable)
  // If we are filtering by indicatorType or country, it mostly applies to indicators.
  // For simplicity, we fetch recent indicators matching the filter, and recent investigations if no indicator-specific filters are applied.
  
  let recentActivity = [];
  
  const recentIndicators = await Indicator.find(filter)
    .select('_id value type threatStatus geolocation.country geolocations.country createdAt')
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();

  recentIndicators.forEach(ind => {
    let country = ind.geolocation?.country;
    if (!country && ind.geolocations && ind.geolocations.length > 0) {
      country = ind.geolocations[0].country;
    }
    recentActivity.push({
      id: ind._id,
      entityType: 'indicator',
      title: ind.normalizedValue || ind.value,
      type: ind.type,
      status: ind.threatStatus,
      country: country || null,
      timestamp: ind.createdAt
    });
  });

  // Only fetch recent investigations if there's no country or indicatorType filter
  if ((!indicatorType || indicatorType === 'all') && (!country || country === 'all')) {
    let invFilter = { user: req.user._id };
    if (timeRange && filter.createdAt) invFilter.createdAt = filter.createdAt;
    if (investigation && investigation !== 'all') invFilter._id = new mongoose.Types.ObjectId(investigation);

    const recentInvestigations = await EmailInvestigation.find(invFilter)
      .select('_id headers.subject sourceType status createdAt')
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    recentInvestigations.forEach(inv => {
      let title = inv.headers?.subject;
      if (!title) {
         // Try from sender if no subject
         const sender = inv.headers?.from;
         if (sender) {
             title = `From: ${sender}`;
         } else {
             title = 'Untitled investigation';
         }
      }

      recentActivity.push({
        id: inv._id,
        entityType: 'investigation',
        title: title,
        type: 'Investigation',
        status: inv.status,
        country: null,
        timestamp: inv.createdAt
      });
    });
  }

  // Sort combined activity by timestamp descending
  recentActivity.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  recentActivity = recentActivity.slice(0, 20);

  // F. Trends (Group by day for the line chart)
  // Only if timeRange is at least 7 days, else group by hour.
  // For simplicity, group by Day (YYYY-MM-DD)
  const trendsAgg = await Indicator.aggregate([
    { $match: filter },
    {
      $group: {
        _id: {
          $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
        },
        malicious: { $sum: { $cond: [{ $eq: ["$threatStatus", "malicious"] }, 1, 0] } },
        suspicious: { $sum: { $cond: [{ $eq: ["$threatStatus", "suspicious"] }, 1, 0] } },
        clean: { $sum: { $cond: [{ $eq: ["$threatStatus", "clean"] }, 1, 0] } },
        unknown: { $sum: { $cond: [{ $in: ["$threatStatus", [null, "", "unknown"]] }, 1, 0] } }
      }
    },
    { $sort: { _id: 1 } },
    { $limit: 30 }
  ]);

  // Transform trends to match expected chart format
  const trends = trendsAgg.map(t => ({
    date: t._id,
    malicious: t.malicious,
    suspicious: t.suspicious,
    clean: t.clean,
    unknown: t.unknown
  }));

  res.json({
    summary,
    markers,
    countries: countriesAgg.map(c => ({ name: c._id, count: c.count })),
    indicatorTypes: typesAgg.map(t => ({ name: t._id, count: t.count })),
    recentActivity,
    trends
  });
});
