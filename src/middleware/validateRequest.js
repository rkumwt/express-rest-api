'use strict';

const ValidationException = require('../exceptions/ValidationException');

/**
 * Creates validation middleware for a given schema.
 * Auto-detects Zod, Joi, or custom validation function.
 *
 * @param {any} schema - Zod schema, Joi schema, or async function(data) => { valid, errors?, data? }
 * @returns {Function|null} Express middleware or null if no schema
 */
function createValidator(schema) {
  if (!schema) return null;

  // Detect Zod: has .safeParse method
  if (typeof schema.safeParse === 'function') {
    return (req, res, next) => {
      const result = schema.safeParse(req.body);
      if (!result.success) {
        const errors = formatZodErrors(result.error);
        throw new ValidationException(errors);
      }
      req.validated = result.data;
      next();
    };
  }

  // Detect Joi: has .validate method and .$_root (Joi internal marker)
  if (typeof schema.validate === 'function' && schema.$_root) {
    return (req, res, next) => {
      const { error, value } = schema.validate(req.body, { abortEarly: false });
      if (error) {
        const errors = formatJoiErrors(error);
        throw new ValidationException(errors);
      }
      req.validated = value;
      next();
    };
  }

  // Custom function validator
  if (typeof schema === 'function') {
    return async (req, res, next) => {
      try {
        const result = await schema(req.body, req);
        if (!result.valid) {
          throw new ValidationException(result.errors || {});
        }
        req.validated = result.data || req.body;
        next();
      } catch (err) {
        if (err instanceof ValidationException) return next(err);
        next(err);
      }
    };
  }

  return null;
}

function formatZodErrors(zodError) {
  const errors = {};
  for (const issue of zodError.issues) {
    const path = issue.path.join('.') || '_root';
    if (!errors[path]) errors[path] = [];
    errors[path].push(issue.message);
  }
  return errors;
}

function formatJoiErrors(joiError) {
  const errors = {};
  for (const detail of joiError.details) {
    const path = detail.path.join('.') || '_root';
    if (!errors[path]) errors[path] = [];
    errors[path].push(detail.message);
  }
  return errors;
}

module.exports = { createValidator, formatZodErrors, formatJoiErrors };
