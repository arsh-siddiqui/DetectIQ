const jwt = require("jsonwebtoken");
const asyncHandler = require("express-async-handler");
const env = require("../config/env");
const User = require("../models/User");

/**
 * Reads the JWT from the httpOnly cookie (preferred) or an Authorization:
 * Bearer header (useful for tools like Postman), verifies it, and attaches
 * the corresponding user document to req.user.
 */
const protect = asyncHandler(async (req, res, next) => {
  let token = req.cookies?.[env.JWT_COOKIE_NAME];

  if (!token && req.headers.authorization?.startsWith("Bearer ")) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    res.status(401);
    throw new Error("Not authorized — no token provided.");
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("-password");

    if (!user) {
      res.status(401);
      throw new Error("Not authorized — user no longer exists.");
    }

    if (user.status === "Suspended") {
      res.status(403);
      throw new Error("This account has been suspended. Contact support.");
    }

    if (user.isLocked && user.isLocked()) {
      res.status(423);
      throw new Error("Account temporarily locked due to multiple failed login attempts.");
    }

    req.user = user;
    next();
  } catch (err) {
    if (res.statusCode === 403 || res.statusCode === 423) throw err;
    res.status(401);
    throw new Error("Not authorized — invalid or expired token.");
  }
});

/**
 * Restricts a route to one or more roles. Use after `protect`.
 * Example: router.get("/admin-only", protect, authorize("admin"), handler)
 */
function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      res.status(401);
      throw new Error("Not authorized.");
    }
    if (!roles.includes(req.user.role)) {
      res.status(403);
      throw new Error(`Role "${req.user.role}" is not permitted to access this resource.`);
    }
    next();
  };
}

/**
 * Like `protect`, but doesn't fail the request if no/invalid token is
 * present — it just leaves req.user undefined. Used on routes that work
 * for anonymous visitors but personalize (e.g. save to history) when logged in.
 */
const optionalAuth = asyncHandler(async (req, res, next) => {
  let token = req.cookies?.[env.JWT_COOKIE_NAME];
  if (!token && req.headers.authorization?.startsWith("Bearer ")) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) return next();

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("-password");
    if (user) req.user = user;
  } catch (err) {
    // Invalid/expired token on an optional route — proceed as anonymous.
  }

  next();
});

module.exports = { protect, authorize, optionalAuth };
