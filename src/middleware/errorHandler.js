'use strict';

const ApiException = require('../exceptions/ApiException');
const ValidationException = require('../exceptions/ValidationException');

/**
 * Global API error handler middleware for Express.
 * Must be registered AFTER all routes: app.use(apiErrorHandler)
 *
 * Formats ApiException subclasses into structured JSON responses.
 * Handles JSON parse errors and unknown errors.
 */
function apiErrorHandler(err, req, res, next) {
  // If headers already sent, delegate to Express default handler
  if (res.headersSent) {
    return next(err);
  }

  // Handle our custom API exceptions
  if (err instanceof ApiException) {
    const body = err.toJSON();

    if (process.env.NODE_ENV !== 'production') {
      body.stack = err.stack;
    }

    return res.status(err.statusCode).json(body);
  }

  // Handle JSON parse errors from express.json()
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      message: 'Invalid JSON in request body',
      error_code: 'INVALID_JSON',
      status: 400,
    });
  }

  // Unhandled errors
  console.error('Unhandled error:', err);

  const body = {
    message:
      process.env.NODE_ENV === 'production'
        ? 'Internal server error'
        : err.message || 'Internal server error',
    error_code: 'INTERNAL_ERROR',
    status: 500,
  };

  if (process.env.NODE_ENV !== 'production') {
    body.stack = err.stack;
  }

  return res.status(500).json(body);
}

module.exports = apiErrorHandler;
