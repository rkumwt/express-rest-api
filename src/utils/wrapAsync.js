'use strict';

/**
 * Wraps an async Express route handler to forward rejected promises to next(err).
 * Prevents unhandled promise rejections in Express 4.
 *
 * @param {Function} fn - Async route handler (req, res, next) => Promise
 * @returns {Function} Express middleware
 */
function wrapAsync(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = wrapAsync;
