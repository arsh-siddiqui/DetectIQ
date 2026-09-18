const asyncHandler = require("express-async-handler");
const Indicator = require("../models/Indicator");
const EmailInvestigation = require("../models/EmailInvestigation");

/**
 * @route   GET /api/security/indicators
 * @desc    Get user-owned indicators with pagination and filtering
 * @access  Private
 */
exports.getIndicators = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const skip = (page - 1) * limit;

  // Filters
  const filter = { user: req.user._id };

  if (req.query.type) filter.type = req.query.type;
  if (req.query.threat) filter.threatStatus = req.query.threat;
  if (req.query.search) {
    // Basic search on normalizedValue
    filter.normalizedValue = { $regex: req.query.search.toLowerCase(), $options: 'i' };
  }
  
  if (req.query.ids) {
    const mongoose = require('mongoose');
    const idsArray = req.query.ids.split(',');
    const validIds = [...new Set(idsArray)].filter(id => mongoose.Types.ObjectId.isValid(id.trim()));
    if (validIds.length > 0) {
      filter._id = { $in: validIds };
    } else {
      // If none of the requested IDs are valid, return empty result to prevent exposing all indicators
      return res.json({ total: 0, page: 1, pages: 1, indicators: [] });
    }
  }

  const total = await Indicator.countDocuments(filter);

  const indicators = await Indicator.find(filter)
    .select('-__v -user') // Exclude internal
    .sort({ lastSeenAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  res.json({
    total,
    page,
    pages: Math.ceil(total / limit),
    indicators
  });
});

/**
 * @route   GET /api/security/indicators/:id
 * @desc    Get indicator detail and related investigations
 * @access  Private
 */
exports.getIndicatorById = asyncHandler(async (req, res) => {
  const indId = req.params.id;

  const indicator = await Indicator.findOne({ _id: indId, user: req.user._id })
    .select('-__v -user')
    .lean();

  if (!indicator) {
    res.status(404);
    throw new Error('Indicator not found.');
  }

  // Find investigations containing this indicator.
  // The EmailInvestigation model has an `indicators` array containing references.
  const relatedInvestigationsRaw = await EmailInvestigation.find({ 
    user: req.user._id, 
    indicators: indId 
  })
    .select('_id createdAt headers.subject sourceType')
    .sort({ createdAt: -1 })
    .lean();

  const relatedInvestigations = relatedInvestigationsRaw.map(inv => ({
    id: inv._id,
    createdAt: inv.createdAt,
    subject: inv.headers?.subject,
    sourceType: inv.sourceType
  }));

  res.json({
    ...indicator,
    relatedInvestigations
  });
});
