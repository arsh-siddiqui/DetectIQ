const asyncHandler = require("express-async-handler");
const User = require("../models/User");
const sendSuccess = require("../utils/apiResponse");
const { sendTokenCookie, clearTokenCookie } = require("../utils/jwt");
const { OAuth2Client } = require("google-auth-library");
const crypto = require("crypto");

/**
 * Strips fields the client should never see / doesn't need, and reshapes
 * the user document into what the frontend's AppDataContext expects.
 */
function toPublicUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.accountRole,
    avatar: user.avatarInitials,
    xp: user.xp || 0,
    streakDays: user.streakDays,
    status: user.status,
    isAdmin: user.role === "admin",
    authProvider: user.authProvider || "local",
    memberSince: user.createdAt,
    lastPasswordChange: user.lastPasswordChange || null,
    preferences: {
      emailAlerts: user.preferences?.emailAlerts ?? true,
      weeklySummary: user.preferences?.weeklySummary ?? false,
      notifications: user.preferences?.notifications ?? true,
      theme: user.preferences?.theme ?? 'system',
    },
    learningProfile: {
      strengths: user.learningProfile?.strengths || [],
      weaknesses: user.learningProfile?.weaknesses || [],
      recommendedFocus: user.learningProfile?.recommendedFocus || null,
    },
    securityProfile: {
      riskScore: user.securityProfile?.riskScore || 0,
      phishingSusceptibility: user.securityProfile?.phishingSusceptibility || 'Medium',
    },
  };
}


// @route  POST /api/auth/register
// @access Public
const register = asyncHandler(async (req, res) => {
  let { name, email, password, accountRole } = req.body;
  email = (email || "").toLowerCase().trim();

  const existing = await User.findOne({ email });
  if (existing) {
    res.status(409);
    throw new Error("An account with this email already exists.");
  }

  const user = await User.create({ name, email, password, accountRole });
  sendTokenCookie(res, user._id);

  return sendSuccess(res, {
    statusCode: 201,
    message: "Account created.",
    data: { user: toPublicUser(user) },
  });
});

// @route  POST /api/auth/login
// @access Public
const login = asyncHandler(async (req, res) => {
  let { email, password } = req.body;
  email = (email || "").toLowerCase().trim();

  const user = await User.findOne({ email }).select("+password");
  if (!user || !(await user.comparePassword(password))) {
    res.status(401);
    throw new Error("Invalid email or password.");
  }

  if (user.status === "Suspended") {
    res.status(403);
    throw new Error("This account has been suspended. Contact support.");
  }

  sendTokenCookie(res, user._id);

  return sendSuccess(res, {
    message: "Logged in.",
    data: { user: toPublicUser(user) },
  });
});

// @route  POST /api/auth/logout
// @access Private
const logout = asyncHandler(async (req, res) => {
  clearTokenCookie(res);
  return sendSuccess(res, { message: "Logged out." });
});

// @route  GET /api/auth/me
// @access Private
const getMe = asyncHandler(async (req, res) => {
  return sendSuccess(res, { data: { user: toPublicUser(req.user) } });
});

// @route  GET /api/auth/google
// @access Public
const googleOAuth = asyncHandler(async (req, res) => {
  const client = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_CALLBACK_URL
  );

  const state = crypto.randomBytes(32).toString("hex");
  res.cookie("oauth_state", state, {
    httpOnly: true,
    maxAge: 10 * 60 * 1000, // 10 minutes
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  });

  const authorizeUrl = client.generateAuthUrl({
    access_type: "offline",
    scope: ["email", "profile"],
    state: state,
    prompt: "consent",
  });

  res.redirect(authorizeUrl);
});

// @route  GET /api/auth/google/callback
// @access Public
const googleOAuthCallback = asyncHandler(async (req, res) => {
  const { code, state, error } = req.query;
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";

  if (error) {
    return res.redirect(`${frontendUrl}/login?error=oauth_rejected`);
  }

  const savedState = req.cookies?.oauth_state;
  res.clearCookie("oauth_state");

  if (!state || !savedState || state !== savedState) {
    return res.redirect(`${frontendUrl}/login?error=invalid_state`);
  }

  try {
    const client = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_CALLBACK_URL
    );

    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);

    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    
    const payload = ticket.getPayload();
    if (!payload || !payload.email_verified) {
      return res.redirect(`${frontendUrl}/login?error=unverified_email`);
    }

    const { email, name, sub: googleId } = payload;
    let user = await User.findOne({ email });

    if (user) {
      // If local user exists, link accounts
      if (user.authProvider === "local") {
        user.authProvider = "linked";
        user.googleId = googleId;
        await user.save();
      }
    } else {
      // New user
      user = await User.create({
        name,
        email,
        authProvider: "google",
        googleId,
        accountRole: "Student", // default
      });
    }

    sendTokenCookie(res, user._id);
    return res.redirect(`${frontendUrl}/dashboard`);
  } catch (err) {
    console.error("Google OAuth Error:", err);
    return res.redirect(`${frontendUrl}/login?error=oauth_failed`);
  }
});

module.exports = { register, login, logout, getMe, toPublicUser, googleOAuth, googleOAuthCallback };
