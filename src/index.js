'use strict';

const ApiController = require('./ApiController');
const ApiResponse = require('./ApiResponse');
const RequestParser = require('./RequestParser');
const { createApiRouter } = require('./ApiRouter');
const { configure, getConfig } = require('./config');
const apiErrorHandler = require('./middleware/errorHandler');
const { createValidator } = require('./middleware/validateRequest');
const { createPrismaAdapter } = require('./adapters/prisma');
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

  // Adapters (always available)
  createPrismaAdapter,
  createCustomAdapter,

  // Adapters (lazy-loaded — ORM only required when called)
  get createSequelizeAdapter() {
    return require('./adapters/sequelize').createSequelizeAdapter;
  },
  get createMongooseAdapter() {
    return require('./adapters/mongoose').createMongooseAdapter;
  },
  get createKnexAdapter() {
    return require('./adapters/knex').createKnexAdapter;
  },
  get createDrizzleAdapter() {
    return require('./adapters/drizzle').createDrizzleAdapter;
  },

  // All exceptions
  ...exceptions,
};
