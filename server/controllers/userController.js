const asyncHandler = require("express-async-handler");
const User = require("../models/User");
const Scan = require("../models/Scan");
const sendSuccess = require("../utils/apiResponse");
const { toPublicUser } = require("./authController");

// @route  GET /api/users/profile
// @access Private
const getProfile = asyncHandler(async (req, res) => {
  return sendSuccess(res, { data: { user: toPublicUser(req.user) } });
});

// @route  PUT /api/users/profile
// @access Private
const updateProfile = asyncHandler(async (req, res) => {
  const allowedFields = ["name", "accountRole"];
  const updates = {};
  allowedFields.forEach((field) => {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  });

  // Handle preferences
  if (req.body.preferences) {
    const currentPrefs = req.user.preferences || {};
    updates.preferences = { ...currentPrefs };
    
    if (req.body.preferences.emailAlerts !== undefined) {
      updates.preferences.emailAlerts = req.body.preferences.emailAlerts;
    }
    if (req.body.preferences.weeklySummary !== undefined) {
      updates.preferences.weeklySummary = req.body.preferences.weeklySummary;
    }
    if (req.body.preferences.notifications !== undefined) {
      updates.preferences.notifications = req.body.preferences.notifications;
    }
    if (req.body.preferences.theme !== undefined) {
      updates.preferences.theme = req.body.preferences.theme;
    }
  }

  const user = await User.findByIdAndUpdate(req.user._id, updates, {
    new: true,
    runValidators: true,
  });

  return sendSuccess(res, { message: "Profile updated.", data: { user: toPublicUser(user) } });
});

// @route  PUT /api/users/password
// @access Private
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    res.status(400);
    throw new Error("Current password and new password are required.");
  }

  if (newPassword.length < 8) {
    res.status(400);
    throw new Error("New password must be at least 8 characters.");
  }

  // Get user with password
  const user = await User.findById(req.user._id).select("+password");
  
  if (!(await user.comparePassword(currentPassword))) {
    res.status(401);
    throw new Error("Incorrect current password.");
  }

  user.password = newPassword;
  user.lastPasswordChange = new Date();
  await user.save(); // This will trigger the pre-save hook to hash the new password

  return sendSuccess(res, { message: "Password updated successfully." });
});

// @route  GET /api/users/dashboard
// @access Private
const getDashboardData = asyncHandler(async (req, res) => {
  const [recentScans, totalScans, safeScans, highRiskScans] = await Promise.all([
    Scan.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(5),
    Scan.countDocuments({ user: req.user._id }),
    Scan.countDocuments({ user: req.user._id, riskLevel: { $regex: /safe|low/i } }),
    Scan.countDocuments({ user: req.user._id, riskLevel: { $regex: /high|critical/i } }),
  ]);

  const level = req.user.getLevel();

  return sendSuccess(res, {
    data: {
      user: toPublicUser(req.user),
      level,
      xpIntoLevel: req.user.xp % 300,
      recentScans,
      stats: {
        totalScans,
        safeScans,
        highRiskScans,
        simulationsCompleted: 0,
        quizzesCompleted: 0,
      },
    },
  });
});

// @route  GET /api/users/scans/:id
// @access Private
const getScanById = asyncHandler(async (req, res) => {
  const scan = await Scan.findOne({ _id: req.params.id, user: req.user._id })
    .populate('forensicInvestigationId');
  if (!scan) {
    res.status(404);
    throw new Error('Scan result not found.');
  }
  return sendSuccess(res, { data: scan });
});

// @route  GET /api/users/scans
// @access Private
const getScanHistory = asyncHandler(async (req, res) => {
  const hasPage = req.query.page !== undefined && req.query.page !== '' && !isNaN(parseInt(req.query.page, 10));
  const hasLimit = req.query.limit !== undefined && req.query.limit !== '' && req.query.limit !== 'all' && !isNaN(parseInt(req.query.limit, 10));
  const isAll = req.query.all === 'true' || req.query.limit === 'all' || (!hasPage && !hasLimit);

  const page = hasPage ? Math.max(1, parseInt(req.query.page, 10)) : 1;
  const limit = isAll ? 1000 : Math.min(Math.max(hasLimit ? parseInt(req.query.limit, 10) : 20, 1), 1000);

  const query = { user: req.user._id };
  if (req.query.type && req.query.type !== 'all') {
    query.$or = [{ scanType: req.query.type }, { inputType: req.query.type }];
  }

  const findQuery = Scan.find(query).sort({ createdAt: -1 });
  if (!isAll) {
    findQuery.skip((page - 1) * limit).limit(limit);
  } else {
    findQuery.limit(limit);
  }

  const [scans, total] = await Promise.all([
    findQuery,
    Scan.countDocuments(query),
  ]);

  return sendSuccess(res, {
    data: { scans },
    meta: {
      page: isAll ? 1 : page,
      limit: isAll ? total : limit,
      total,
      totalPages: isAll ? 1 : Math.max(1, Math.ceil(total / limit)),
    },
  });
});

// @route  GET /api/users/progress
// @access Private
const getProgress = asyncHandler(async (req, res) => {
  return sendSuccess(res, {
    data: {
      xp: req.user.xp,
      level: req.user.getLevel(),
      streakDays: req.user.streakDays,
      simulations: [],
      quizzes: [],
      bookmarkedArticles: [],
      likedArticles: [],
      readArticles: [],
      completedChallenges: [],
      lessonProgress: [],
    },
  });
});

// @route  POST /api/users/scans/:id/personalize
// @access Private
const personalizeScan = asyncHandler(async (req, res) => {
  const scan = await Scan.findOne({ _id: req.params.id, user: req.user._id });
  if (!scan) {
    res.status(404);
    throw new Error('Scan result not found.');
  }
  
  if (scan.inputType !== 'email') {
    res.status(400);
    throw new Error('Only email scans can be added to your email patterns.');
  }
  
  // Safe validation check (low risk or safe)
  if (scan.riskLevel !== 'safe' && scan.riskLevel !== 'low') {
    res.status(400);
    throw new Error('Only safe or low-risk emails can be added to patterns.');
  }

  const bodyContent = scan.fullContent || scan.target;
  
  if (!bodyContent) {
    res.status(400);
    throw new Error('Email content is missing from this scan.');
  }

  // Create an email pattern using auto-parsed headers from bodyContent
  const result = await emailHistoryService.createEmailHistory(req.user._id, { 
    sender: '', 
    recipient: '', 
    subject: '', 
    body: bodyContent 
  });
  
  return sendSuccess(res, { message: 'Successfully added to your email patterns.', data: result });
});

module.exports = {
  getProfile,
  updateProfile,
  changePassword,
  getDashboardData,
  getScanHistory,
  getScanById,
  getProgress,
  personalizeScan,
};
