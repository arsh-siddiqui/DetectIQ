const env = require("../config/env");

function notFound(req, res, next) {
  res.status(404);
  next(new Error(`Route not found — ${req.method} ${req.originalUrl}`));
}

/**
 * Final error handler. Express recognizes this as an error middleware
 * because it declares four parameters. Normalizes Mongoose-specific error
 * shapes (CastError, duplicate key, ValidationError) into a consistent
 * response body, and never leaks stack traces outside development.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let statusCode = res.statusCode && res.statusCode !== 200 ? res.statusCode : 500;
  let message = err.message || "Server error.";

  // CORS policy violation
  if (err.message && err.message.includes("CORS")) {
    statusCode = 403;
    message = "Cross-Origin Request Blocked by security policy.";
  }

  // Malformed Mongo ObjectId
  if (err.name === "CastError" && err.kind === "ObjectId") {
    statusCode = 404;
    message = "Resource not found.";
  }

  // Duplicate key (e.g. email already registered)
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue || {})[0] || "field";
    message = `${field} already exists.`;
  }

  // Mongoose schema validation
  if (err.name === "ValidationError") {
    statusCode = 422;
    message = Object.values(err.errors)
      .map((e) => e.message)
      .join(", ");
  }

  // Prevent internal error details from leaking in production
  if (statusCode === 500 && env.NODE_ENV !== "development") {
    message = "An internal server error occurred. Please try again later.";
  }

  res.status(statusCode).json({
    success: false,
    message,
    stack: env.NODE_ENV === "development" ? err.stack : undefined,
  });
}

module.exports = { notFound, errorHandler };
