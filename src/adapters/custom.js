'use strict';

const REQUIRED_METHODS = ['findMany', 'findOne', 'count', 'create', 'update', 'delete'];

/**
 * Create a custom adapter from a plain object.
 *
 * Validates that all required methods are present and returns a properly
 * structured adapter object. This is a convenience wrapper — you can also
 * pass a plain object directly to `controller.adapter` without using this.
 *
 * @param {object} implementation - Object with adapter methods
 * @param {object} options - { primaryKey: 'id' }
 * @returns {object} Validated adapter
 *
 * @example
 * const adapter = createCustomAdapter({
 *   async findMany(queryOptions) { ... },
 *   async findOne(id, queryOptions) { ... },
 *   async count(filterOptions) { ... },
 *   async create(data) { ... },
 *   async update(id, data) { ... },
 *   async delete(id) { ... },
 * });
 */
function createCustomAdapter(implementation, options = {}) {
  const primaryKey = options.primaryKey || implementation.primaryKey || 'id';

  // Validate required methods
  for (const method of REQUIRED_METHODS) {
    if (typeof implementation[method] !== 'function') {
      throw new Error(
        `Custom adapter is missing required method: "${method}". ` +
        `Required methods: ${REQUIRED_METHODS.join(', ')}`
      );
    }
  }

  return {
    primaryKey,
    findMany: implementation.findMany.bind(implementation),
    findOne: implementation.findOne.bind(implementation),
    count: implementation.count.bind(implementation),
    create: implementation.create.bind(implementation),
    update: implementation.update.bind(implementation),
    delete: implementation.delete.bind(implementation),
  };
}

module.exports = { createCustomAdapter };
