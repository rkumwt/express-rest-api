'use strict';

const ApiController = require('./ApiController');
const ApiResponse = require('./ApiResponse');
const RequestParser = require('./RequestParser');
const { createApiRouter } = require('./ApiRouter');
const { configure, getConfig } = require('./config');
const apiErrorHandler = require('./middleware/errorHandler');
const { createValidator } = require('./middleware/validateRequest');
const { createPrismaAdapter } = require('./adapters/prisma');
const { createSequelizeAdapter } = require('./adapters/sequelize');
const { createMongooseAdapter } = require('./adapters/mongoose');
const { createKnexAdapter } = require('./adapters/knex');
const { createDrizzleAdapter } = require('./adapters/drizzle');
const { createCustomAdapter } = require('./adapters/custom');
const exceptions = require('./exceptions');

module.exports = {
  // Core classes
  ApiController,
  ApiResponse,
  RequestParser,

  // Router
  createApiRouter,

  // Config
  configure,
  getConfig,

  // Middleware
  apiErrorHandler,
  createValidator,

  // Adapters
  createPrismaAdapter,
  createSequelizeAdapter,
  createMongooseAdapter,
  createKnexAdapter,
  createDrizzleAdapter,
  createCustomAdapter,

  // All exceptions
  ...exceptions,
};
