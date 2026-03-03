'use strict';

const express = require('express');
const wrapAsync = require('./utils/wrapAsync');
const { createValidator } = require('./middleware/validateRequest');

const ALL_ACTIONS = ['index', 'show', 'store', 'update', 'destroy'];

/**
 * Create an API router with apiResource helper.
 *
 * @param {object} options - { prefix, version, middleware }
 * @returns {object} Router with apiResource() and getRouter()
 */
function createApiRouter(options = {}) {
  const router = express.Router();
  const prefix = buildPrefix(options.prefix, options.version);

  // Apply global router middleware
  if (options.middleware && options.middleware.length > 0) {
    router.use(...options.middleware);
  }

  return {
    /**
     * Register CRUD routes for a resource.
     *
     * @param {string} resourceName - e.g., 'users'
     * @param {Function} ControllerClass - Class extending ApiController
     * @param {object} resourceOptions - { only, except, middleware }
     */
    apiResource(resourceName, ControllerClass, resourceOptions = {}) {
      const controller = new ControllerClass();
      const basePath = `${prefix}/${resourceName}`;
      const itemPath = `${basePath}/:id`;
      const actions = resolveActions(resourceOptions, controller);

      // GET /resource — index
      if (actions.includes('index')) {
        const mw = collectMiddleware(controller, 'index', resourceOptions);
        router.get(basePath, ...mw, wrapAsync(controller.index.bind(controller)));
      }

      // POST /resource — store
      if (actions.includes('store')) {
        const mw = collectMiddleware(controller, 'store', resourceOptions);
        const validator = createValidator(controller.storeSchema);
        if (validator) mw.push(wrapAsync(validator));
        router.post(basePath, ...mw, wrapAsync(controller.store.bind(controller)));
      }

      // GET /resource/:id — show
      if (actions.includes('show')) {
        const mw = collectMiddleware(controller, 'show', resourceOptions);
        router.get(itemPath, ...mw, wrapAsync(controller.show.bind(controller)));
      }

      // PUT /resource/:id — update
      // PATCH /resource/:id — update (partial)
      if (actions.includes('update')) {
        const mw = collectMiddleware(controller, 'update', resourceOptions);
        const validator = createValidator(controller.updateSchema);
        if (validator) mw.push(wrapAsync(validator));
        router.put(itemPath, ...mw, wrapAsync(controller.update.bind(controller)));
        router.patch(itemPath, ...mw, wrapAsync(controller.update.bind(controller)));
      }

      // DELETE /resource/:id — destroy
      if (actions.includes('destroy')) {
        const mw = collectMiddleware(controller, 'destroy', resourceOptions);
        router.delete(itemPath, ...mw, wrapAsync(controller.destroy.bind(controller)));
      }
    },

    /**
     * Get the underlying Express router for mounting.
     */
    getRouter() {
      return router;
    },
  };
}

function buildPrefix(prefix, version) {
  let result = prefix || '';
  if (version) result += `/${version}`;
  return result.replace(/\/$/, '');
}

function resolveActions(options, controller) {
  // Route-level only/except takes priority over controller-level
  if (options.only) return options.only;
  if (options.except) return ALL_ACTIONS.filter((a) => !options.except.includes(a));

  // Fall back to controller-level only/except
  if (controller.only) return controller.only;
  if (controller.except) return ALL_ACTIONS.filter((a) => !controller.except.includes(a));

  return [...ALL_ACTIONS];
}

function collectMiddleware(controller, action, resourceOptions) {
  const mw = [];

  // Controller-level middleware (all actions)
  if (controller.middleware && controller.middleware.length > 0) {
    mw.push(...controller.middleware);
  }

  // Controller-level per-action middleware
  if (controller.middlewareMap && controller.middlewareMap[action]) {
    mw.push(...controller.middlewareMap[action]);
  }

  // Resource-level per-action middleware (from apiResource options)
  if (resourceOptions.middleware && resourceOptions.middleware[action]) {
    mw.push(...resourceOptions.middleware[action]);
  }

  return mw;
}

module.exports = { createApiRouter };
