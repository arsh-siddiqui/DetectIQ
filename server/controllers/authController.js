const asyncHandler = require("express-async-handler");
const env = require("../config/env");
const User = require("../models/User");
const sendSuccess = require("../utils/apiResponse");
const { sendTokenCookie, clearTokenCookie } = require("../utils/jwt");
const { OAuth2Client } = require("google-auth-library");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");

// Dummy hash for constant-time comparison to prevent user enumeration
const DUMMY_HASH = "$2a$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ012";

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
  const token = sendTokenCookie(res, user._id);

  return sendSuccess(res, {
    statusCode: 201,
    message: "Account created.",
    data: { user: toPublicUser(user), token },
  });
});

// @route  POST /api/auth/login
// @access Public
const login = asyncHandler(async (req, res) => {
  let { email, password } = req.body;
  email = (email || "").toLowerCase().trim();

  const user = await User.findOne({ email }).select("+password");

  if (!user) {
    // Perform dummy bcrypt comparison to protect against user enumeration timing attacks
    await bcrypt.compare(password, DUMMY_HASH).catch(() => {});
    res.status(401);
    throw new Error("Invalid email or password.");
  }

  // Check if account is temporarily locked
  if (user.isLocked && user.isLocked()) {
    const remainingMinutes = Math.ceil((user.lockUntil - Date.now()) / (60 * 1000));
    res.status(423); // 423 Locked
    throw new Error(`Account temporarily locked due to multiple failed login attempts. Please try again in ${remainingMinutes} minute(s).`);
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
    if (user.failedLoginAttempts >= 5) {
      user.lockUntil = new Date(Date.now() + 15 * 60 * 1000); // 15-minute lockout
    }
    await user.save({ validateBeforeSave: false });

    res.status(401);
    throw new Error("Invalid email or password.");
  }

  if (user.status === "Suspended") {
    res.status(403);
    throw new Error("This account has been suspended. Contact support.");
  }

  // Reset failed login counters upon successful authentication
  if (user.failedLoginAttempts > 0 || user.lockUntil) {
    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    await user.save({ validateBeforeSave: false });
  }

  const token = sendTokenCookie(res, user._id);

  return sendSuccess(res, {
    message: "Logged in.",
    data: { user: toPublicUser(user), token },
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

  const timestamp = Date.now().toString();
  const nonce = crypto.randomBytes(16).toString("hex");
  const data = `${timestamp}:${nonce}`;
  const hmacSecret = env.JWT_SECRET || "oauth_state_hmac_secret";
  const signature = crypto.createHmac("sha256", hmacSecret).update(data).digest("hex");
  const state = `${data}:${signature}`;

  const isProd = (process.env.NODE_ENV || "").includes("production");
  res.cookie("oauth_state", state, {
    httpOnly: true,
    maxAge: 15 * 60 * 1000, // 15 minutes
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    path: "/",
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
  res.clearCookie("oauth_state", {
    httpOnly: true,
    secure: (process.env.NODE_ENV || "").includes("production"),
    sameSite: (process.env.NODE_ENV || "").includes("production") ? "none" : "lax",
    path: "/",
  });

  let stateValid = false;
  if (state) {
    if (savedState && state === savedState) {
      stateValid = true;
    } else {
      // Stateless HMAC verification: allows Linux / privacy-hardened browsers (Firefox, Kali, Ubuntu)
      // where cross-site cookies are blocked by default to authenticate safely.
      const parts = state.split(":");
      if (parts.length === 3) {
        const [tsStr, nonce, sig] = parts;
        const ts = parseInt(tsStr, 10);
        if (!isNaN(ts) && Date.now() - ts >= 0 && Date.now() - ts < 15 * 60 * 1000) {
          const hmacSecret = env.JWT_SECRET || "oauth_state_hmac_secret";
          const expectedSig = crypto.createHmac("sha256", hmacSecret).update(`${tsStr}:${nonce}`).digest("hex");
          if (Buffer.byteLength(sig) === Buffer.byteLength(expectedSig) && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) {
            stateValid = true;
          }
        }
      }
    }
  }

  if (!stateValid) {
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

    const token = sendTokenCookie(res, user._id);
    return res.redirect(`${frontendUrl}/dashboard?token=${encodeURIComponent(token)}`);
  } catch (err) {
    console.error("Google OAuth Error:", err);
    return res.redirect(`${frontendUrl}/login?error=oauth_failed`);
  }
});

module.exports = { register, login, logout, getMe, toPublicUser, googleOAuth, googleOAuthCallback };
