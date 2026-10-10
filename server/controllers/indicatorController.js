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
    .populate('investigation', 'headers.subject headers.from sourceType createdAt')
    .sort({ lastSeenAt: -1, createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  // For any indicators where `investigation` is null, look up reverse reference from EmailInvestigation.indicators
  const unlinked = indicators.filter(i => !i.investigation);
  if (unlinked.length > 0) {
    const unlinkedIds = unlinked.map(i => i._id);
    const relatedInvs = await EmailInvestigation.find({
      user: req.user._id,
      indicators: { $in: unlinkedIds }
    }).select('_id headers.subject headers.from sourceType createdAt indicators').lean();

    const invMap = new Map();
    for (const inv of relatedInvs) {
      if (Array.isArray(inv.indicators)) {
        for (const indRef of inv.indicators) {
          const key = indRef.toString();
          if (!invMap.has(key)) {
            invMap.set(key, {
              _id: inv._id,
              headers: inv.headers,
              sourceType: inv.sourceType,
              createdAt: inv.createdAt
            });
          }
        }
      }
    }

    for (const ind of indicators) {
      if (!ind.investigation) {
        const found = invMap.get(ind._id.toString());
        if (found) {
          ind.investigation = found;
        }
      }
    }
  }

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
    .populate('investigation', 'headers.subject headers.from sourceType createdAt')
    .lean();

  if (!indicator) {
    res.status(404);
    throw new Error('Indicator not found.');
  }

  // Find investigations containing this indicator.
  // The EmailInvestigation model has an `indicators` array containing references or direct investigation ref.
  const orConditions = [{ indicators: indId }];
  if (indicator.investigation?._id) {
    orConditions.push({ _id: indicator.investigation._id });
  } else if (indicator.investigation) {
    orConditions.push({ _id: indicator.investigation });
  }

  const relatedInvestigationsRaw = await EmailInvestigation.find({ 
    user: req.user._id, 
    $or: orConditions
  })
    .select('_id createdAt headers.subject headers.from sourceType')
    .sort({ createdAt: -1 })
    .lean();

  const relatedInvestigations = relatedInvestigationsRaw.map(inv => ({
    id: inv._id,
    createdAt: inv.createdAt,
    subject: inv.headers?.subject,
    from: inv.headers?.from,
    sourceType: inv.sourceType
  }));

  res.json({
    ...indicator,
    relatedInvestigations
  });
});
