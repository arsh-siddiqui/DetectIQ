const rateLimit = require("express-rate-limit");

/**
 * Standard API Rate Limiter
 * Applied globally to all general /api endpoints.
 * 150 requests per 15-minute window.
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 150,
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  message: {
    success: false,
    message: "Too many requests from this IP address, please try again in 15 minutes.",
  },
});

/**
 * Authentication Route Rate Limiter
 * Applied strictly to /api/auth/login and /api/auth/register.
 * Prevents automated brute-force attacks and credential stuffing.
 * 15 attempts per 15-minute window per IP.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many authentication attempts. For security reasons, please try again in 15 minutes.",
  },
});

/**
 * Threat Scan Route Rate Limiter
 * Applied to /api/scan endpoints to prevent denial-of-wallet / API exhaustion
 * across expensive Groq LLM inference, Python ML, and Threat Intelligence queries.
 * 40 scans per minute window per IP.
 */
const scanLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Threat scanning rate limit reached. Please pause for a minute before initiating more scans.",
  },
});

module.exports = {
  apiLimiter,
  authLimiter,
  scanLimiter,
};
