const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");

const env = require("./config/env");
const { connectDB, isDbConnected } = require("./config/db");
const { notFound, errorHandler } = require("./middleware/errorHandler");
const { mongoSanitize } = require("./middleware/mongoSanitize");
const preventHPP = require("./middleware/hpp");
const securityHeaders = require("./middleware/securityHeaders");
const csrfProtection = require("./middleware/csrfProtection");

const app = express();
app.set("trust proxy", 1); // Trust first proxy (Render/Vercel) for secure cookies

const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const scanRoutes = require("./routes/scanRoutes");
const adminRoutes = require("./routes/adminRoutes");
const emailHistoryRoutes = require("./routes/emailHistoryRoutes");
const forensicRoutes = require("./routes/forensicRoutes");
const securityRoutes = require("./routes/securityRoutes");

const vulnerabilityRoutes = require("./routes/vulnerabilityRoutes");
const progressRoutes = require("./routes/progressRoutes");

// ---------------------------------------------------------------------------
// Core security middleware
// ---------------------------------------------------------------------------
app.use(
  helmet({
    contentSecurityPolicy: false, // SPA is served by Vercel; Extension pages by Chrome
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    dnsPrefetchControl: { allow: false },
    frameguard: { action: "deny" },
    hidePoweredBy: true,
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    ieNoOpen: true,
    noSniff: true,
    originAgentCluster: true,
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    xssFilter: true,
  })
);
app.use(securityHeaders);
app.use(
  cors({
    origin: function (origin, callback) {
      if (
        !origin ||
        origin === env.FRONTEND_URL ||
        /^http:\/\/localhost:517\d$/.test(origin) ||
        /^http:\/\/127\.0\.0\.1:517\d$/.test(origin) ||
        origin === 'http://localhost:3000' ||
        origin === 'http://127.0.0.1:3000' ||
        /^chrome-extension:\/\/[a-z0-9]+$/.test(origin) ||
        origin.startsWith('chrome-extension://') ||
        origin.startsWith('moz-extension://')
      ) {
        callback(null, origin || true);
      } else {
        callback(new Error('Blocked by CORS policy: Origin not allowed.'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
    exposedHeaders: ['RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset'],
    maxAge: 86400,
  })
);
app.use(express.json({ limit: "500kb" }));
app.use(express.urlencoded({ extended: true, limit: "500kb" }));
app.use(cookieParser());
app.use(mongoSanitize);
app.use(preventHPP());
app.use(csrfProtection);
app.use(morgan(env.NODE_ENV === "development" ? "dev" : "combined"));

// ---------------------------------------------------------------------------
// Health check — always answers, even without a DB connection, so
// deployment platforms and the frontend can distinguish "server is down"
// from "server is up but database isn't connected yet".
// ---------------------------------------------------------------------------
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "DetectIQ API is running.",
    dbConnected: isDbConnected(),
    env: env.NODE_ENV,
  });
});

// ---------------------------------------------------------------------------
// Rate Limiting & Protection
// ---------------------------------------------------------------------------
const { apiLimiter, authLimiter, scanLimiter } = require("./middleware/rateLimiter");

// Global rate limiting for general API calls (health check is excluded above)
app.use("/api", apiLimiter);

// ---------------------------------------------------------------------------
// API routes
// ---------------------------------------------------------------------------
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/scan", scanLimiter, scanRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/email-history", emailHistoryRoutes);
app.use("/api/vulnerabilities", vulnerabilityRoutes);
app.use("/api/progress", progressRoutes);
app.use("/api/email-forensics", forensicRoutes);
app.use("/api/security", securityRoutes);

// ---------------------------------------------------------------------------
// 404 + error handling — must be registered last
// ---------------------------------------------------------------------------
app.use(notFound);
app.use(errorHandler);

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
async function start() {
  await connectDB(); // does not throw — logs and continues if Mongo is unreachable

  // Rebuild all users' FAISS indexes in the background after Python service is ready.
  // Handles the case where Render restarts the Python service (wiping in-memory FAISS).
  const { startRagRebuild } = require('./services/ragStartupService');
  startRagRebuild();

  const server = app.listen(env.PORT, "0.0.0.0", () => {
    // eslint-disable-next-line no-console
    console.log(`[detectiq] API listening on http://0.0.0.0:${env.PORT} (${env.NODE_ENV})`);
  });

  // --- Graceful Shutdown ---
  const shutdown = async (signal) => {
    // eslint-disable-next-line no-console
    console.log(`\n[detectiq] Received ${signal}. Shutting down gracefully...`);
    
    server.close(() => {
      // eslint-disable-next-line no-console
      console.log('[detectiq] HTTP server closed.');
    });
    
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
      // eslint-disable-next-line no-console
      console.log('[detectiq] MongoDB connection closed.');
    }
    
    if (signal === 'SIGUSR2') {
      process.kill(process.pid, 'SIGUSR2');
    } else {
      process.exit(0);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGUSR2', () => shutdown('SIGUSR2'));
}

if (require.main === module) {
  start();
}

module.exports = app;
