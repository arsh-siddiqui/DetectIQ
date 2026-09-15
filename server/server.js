const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");

const env = require("./config/env");
const { connectDB, isDbConnected } = require("./config/db");
const { notFound, errorHandler } = require("./middleware/errorHandler");

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
// Core middleware
// ---------------------------------------------------------------------------
app.use(helmet());
app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || origin === env.FRONTEND_URL || /^http:\/\/localhost:517\d$/.test(origin)) {
        callback(null, origin || true);
      } else {
        callback(null, env.FRONTEND_URL);
      }
    },
    credentials: true, // required so the browser sends/receives the httpOnly auth cookie
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
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
// API routes
// ---------------------------------------------------------------------------
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/scan", scanRoutes);
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
