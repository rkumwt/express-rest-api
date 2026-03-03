'use strict';

/**
 * Create an adapter for Knex.js query builder.
 *
 * Note: Knex is a query builder, not an ORM. Relation includes are not supported
 * and will be silently ignored.
 *
 * @param {object} knex - Configured Knex instance
 * @param {string} tableName - Database table name (e.g., 'users')
 * @param {object} options - { primaryKey: 'id', returning: true }
 * @returns {object} Adapter implementing findMany, findOne, count, create, update, delete
 */
function createKnexAdapter(knex, tableName, options = {}) {
  const primaryKey = options.primaryKey || 'id';
  const useReturning = options.returning !== false;

  return {
    primaryKey,

    async findMany(queryOptions = {}) {
      let query = knex(tableName);

      // Field selection
      const hasFields = queryOptions.fields && queryOptions.fields.length > 0;
      if (hasFields) {
        const fields = [...queryOptions.fields];
        if (!fields.includes(primaryKey)) {
          fields.unshift(primaryKey);
        }
        query = query.select(fields);
      }

      // Filters → WHERE
      if (queryOptions.filters && queryOptions.filters.length > 0) {
        query = applyWhere(query, queryOptions.filters);
      }

      // Ordering
      if (queryOptions.order && queryOptions.order.length > 0) {
        query = query.orderBy(
          queryOptions.order.map((o) => ({
            column: o.field,
            order: o.direction,
          }))
        );
      }

      // Pagination
      if (queryOptions.limit !== undefined) {
        query = query.limit(queryOptions.limit);
      }
      if (queryOptions.offset !== undefined) {
        query = query.offset(queryOptions.offset);
      }

      return query;
    },

    async findOne(id, queryOptions = {}) {
      let query = knex(tableName).where({ [primaryKey]: coerceId(id) });

      const hasFields = queryOptions.fields && queryOptions.fields.length > 0;
      if (hasFields) {
        const fields = [...queryOptions.fields];
        if (!fields.includes(primaryKey)) {
          fields.unshift(primaryKey);
        }
        query = query.select(fields);
      }

      const record = await query.first();
      return record || null;
    },

    async count(filterOptions = {}) {
      let query = knex(tableName);

      if (filterOptions.filters && filterOptions.filters.length > 0) {
        query = applyWhere(query, filterOptions.filters);
      }

      const result = await query.count({ total: '*' }).first();
      return parseInt(result.total, 10);
    },

    async create(data) {
      if (useReturning) {
        const [record] = await knex(tableName).insert(data).returning('*');
        return record;
      }
      const [insertId] = await knex(tableName).insert(data);
      return knex(tableName)
        .where({ [primaryKey]: insertId })
        .first();
    },

    async update(id, data) {
      if (useReturning) {
        const [record] = await knex(tableName)
          .where({ [primaryKey]: coerceId(id) })
          .update(data)
          .returning('*');
        return record;
      }
      await knex(tableName)
        .where({ [primaryKey]: coerceId(id) })
        .update(data);
      return knex(tableName)
        .where({ [primaryKey]: coerceId(id) })
        .first();
    },

    async delete(id) {
      const record = await knex(tableName)
        .where({ [primaryKey]: coerceId(id) })
        .first();

      await knex(tableName)
        .where({ [primaryKey]: coerceId(id) })
        .delete();

      return record || null;
    },
  };
}

/**
 * Apply WHERE conditions to a Knex query from parsed filters.
 */
function applyWhere(query, filters) {
  if (filters.length === 0) return query;

  const hasOr = filters.some((f) => f.conjunction === 'OR');

  if (!hasOr) {
    // All AND — apply each filter directly
    return query.where(function () {
      for (const filter of filters) {
        applyCondition(this, filter, 'and');
      }
    });
  }

  // Mixed AND/OR — group into OR blocks
  const groups = [];
  let currentGroup = [];

  for (const filter of filters) {
    if (filter.conjunction === 'OR' && currentGroup.length > 0) {
      groups.push([...currentGroup]);
      currentGroup = [filter];
    } else {
      currentGroup.push(filter);
    }
  }
  if (currentGroup.length > 0) {
    groups.push([...currentGroup]);
  }

  return query.where(function () {
    const self = this;
    groups.forEach((group, i) => {
      const method = i === 0 ? 'where' : 'orWhere';
      self[method](function () {
        for (const filter of group) {
          applyCondition(this, filter, 'and');
        }
      });
    });
  });
}

/**
 * Apply a single filter condition to a Knex query builder context.
 */
function applyCondition(builder, filter, mode) {
  const { field, operator, value } = filter;
  const method = mode === 'or' ? 'orWhere' : 'where';

  switch (operator) {
    case '=':
      if (value === null) {
        builder.whereNull(field);
      } else {
        builder[method](field, '=', value);
      }
      break;
    case '!=':
      if (value === null) {
        builder.whereNotNull(field);
      } else {
        builder[method](field, '!=', value);
      }
      break;
    case '>':
      builder[method](field, '>', value);
      break;
    case '>=':
      builder[method](field, '>=', value);
      break;
    case '<':
      builder[method](field, '<', value);
      break;
    case '<=':
      builder[method](field, '<=', value);
      break;
    case 'LIKE':
      builder[method](field, 'like', `%${value}%`);
      break;
    default:
      builder[method](field, '=', value);
  }
}

/**
 * Coerce route param ID to the correct type.
 */
function coerceId(id) {
  if (typeof id === 'string' && /^\d+$/.test(id)) {
    return parseInt(id, 10);
  }
  return id;
}

module.exports = { createKnexAdapter };
