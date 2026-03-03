'use strict';

const {
  eq,
  ne,
  gt,
  gte,
  lt,
  lte,
  like,
  and,
  or,
  count: drizzleCount,
  asc: drizzleAsc,
  desc: drizzleDesc,
  isNull,
  isNotNull,
} = require('drizzle-orm');

/**
 * Create an ORM adapter for Drizzle ORM.
 *
 * @param {object} db - Drizzle database instance
 * @param {object} table - Drizzle table schema object (e.g., usersTable)
 * @param {object} options - { primaryKey: 'id', queryName: 'users' }
 * @returns {object} Adapter implementing findMany, findOne, count, create, update, delete
 */
function createDrizzleAdapter(db, table, options = {}) {
  const primaryKey = options.primaryKey || 'id';
  const queryName = options.queryName || null;

  return {
    primaryKey,

    async findMany(queryOptions = {}) {
      const hasIncludes =
        queryOptions.includes && queryOptions.includes.length > 0;

      // Use relational queries when includes are present and queryName is set
      if (hasIncludes && queryName && db.query && db.query[queryName]) {
        return findManyRelational(db, queryName, table, queryOptions, primaryKey);
      }

      return findManyBuilder(db, table, queryOptions, primaryKey);
    },

    async findOne(id, queryOptions = {}) {
      const hasIncludes =
        queryOptions.includes && queryOptions.includes.length > 0;

      if (hasIncludes && queryName && db.query && db.query[queryName]) {
        return findOneRelational(
          db,
          queryName,
          table,
          id,
          queryOptions,
          primaryKey
        );
      }

      return findOneBuilder(db, table, id, queryOptions, primaryKey);
    },

    async count(filterOptions = {}) {
      let query = db.select({ total: drizzleCount() }).from(table);

      if (filterOptions.filters && filterOptions.filters.length > 0) {
        const where = buildWhere(filterOptions.filters, table);
        query = query.where(where);
      }

      const result = await query;
      return result[0] ? Number(result[0].total) : 0;
    },

    async create(data) {
      const rows = await db.insert(table).values(data).returning();
      return rows[0];
    },

    async update(id, data) {
      const pkCol = table[primaryKey];
      const rows = await db
        .update(table)
        .set(data)
        .where(eq(pkCol, coerceId(id)))
        .returning();
      return rows[0] || null;
    },

    async delete(id) {
      const pkCol = table[primaryKey];
      const rows = await db
        .delete(table)
        .where(eq(pkCol, coerceId(id)))
        .returning();
      return rows[0] || null;
    },
  };
}

/**
 * Find many using Drizzle query builder (no relations).
 */
async function findManyBuilder(db, table, queryOptions, primaryKey) {
  const hasFields = queryOptions.fields && queryOptions.fields.length > 0;

  let query;

  if (hasFields) {
    const selectObj = buildSelectObj(queryOptions.fields, table, primaryKey);
    query = db.select(selectObj).from(table);
  } else {
    query = db.select().from(table);
  }

  // Filters
  if (queryOptions.filters && queryOptions.filters.length > 0) {
    const where = buildWhere(queryOptions.filters, table);
    query = query.where(where);
  }

  // Ordering
  if (queryOptions.order && queryOptions.order.length > 0) {
    const orderClauses = queryOptions.order.map((o) => {
      const col = table[o.field];
      return o.direction === 'desc' ? drizzleDesc(col) : drizzleAsc(col);
    });
    query = query.orderBy(...orderClauses);
  }

  // Pagination
  if (queryOptions.limit !== undefined) {
    query = query.limit(queryOptions.limit);
  }
  if (queryOptions.offset !== undefined) {
    query = query.offset(queryOptions.offset);
  }

  return query;
}

/**
 * Find many using Drizzle relational query API.
 */
async function findManyRelational(db, queryName, table, queryOptions, primaryKey) {
  const args = {};

  // Field selection → columns
  const hasFields = queryOptions.fields && queryOptions.fields.length > 0;
  if (hasFields) {
    args.columns = buildColumns(queryOptions.fields, primaryKey);
  }

  // Includes → with
  if (queryOptions.includes && queryOptions.includes.length > 0) {
    args.with = buildWith(queryOptions.includes);
  }

  // Filters
  if (queryOptions.filters && queryOptions.filters.length > 0) {
    const where = buildWhere(queryOptions.filters, table);
    args.where = where;
  }

  // Ordering
  if (queryOptions.order && queryOptions.order.length > 0) {
    args.orderBy = queryOptions.order.map((o) => {
      const col = table[o.field];
      return o.direction === 'desc' ? drizzleDesc(col) : drizzleAsc(col);
    });
  }

  // Pagination
  if (queryOptions.limit !== undefined) {
    args.limit = queryOptions.limit;
  }
  if (queryOptions.offset !== undefined) {
    args.offset = queryOptions.offset;
  }

  return db.query[queryName].findMany(args);
}

/**
 * Find one using Drizzle query builder.
 */
async function findOneBuilder(db, table, id, queryOptions, primaryKey) {
  const pkCol = table[primaryKey];
  const hasFields = queryOptions.fields && queryOptions.fields.length > 0;

  let query;

  if (hasFields) {
    const selectObj = buildSelectObj(queryOptions.fields, table, primaryKey);
    query = db.select(selectObj).from(table);
  } else {
    query = db.select().from(table);
  }

  query = query.where(eq(pkCol, coerceId(id))).limit(1);

  const rows = await query;
  return rows[0] || null;
}

/**
 * Find one using Drizzle relational query API.
 */
async function findOneRelational(db, queryName, table, id, queryOptions, primaryKey) {
  const pkCol = table[primaryKey];
  const args = {
    where: eq(pkCol, coerceId(id)),
  };

  const hasFields = queryOptions.fields && queryOptions.fields.length > 0;
  if (hasFields) {
    args.columns = buildColumns(queryOptions.fields, primaryKey);
  }

  if (queryOptions.includes && queryOptions.includes.length > 0) {
    args.with = buildWith(queryOptions.includes);
  }

  const result = await db.query[queryName].findFirst(args);
  return result || null;
}

/**
 * Build Drizzle select object for query builder mode.
 */
function buildSelectObj(fields, table, primaryKey) {
  const selectObj = {};
  selectObj[primaryKey] = table[primaryKey];
  for (const field of fields) {
    if (table[field]) {
      selectObj[field] = table[field];
    }
  }
  return selectObj;
}

/**
 * Build Drizzle columns object for relational query mode.
 */
function buildColumns(fields, primaryKey) {
  const columns = {};
  columns[primaryKey] = true;
  for (const field of fields) {
    columns[field] = true;
  }
  return columns;
}

/**
 * Build Drizzle 'with' clause from parsed includes (relational queries).
 */
function buildWith(includes) {
  const withObj = {};
  for (const inc of includes) {
    if (!inc.fields && !inc.includes) {
      withObj[inc.relation] = true;
    } else {
      const clause = {};
      if (inc.fields && inc.fields.length > 0) {
        clause.columns = {};
        for (const f of inc.fields) {
          clause.columns[f] = true;
        }
      }
      if (inc.includes && inc.includes.length > 0) {
        clause.with = buildWith(inc.includes);
      }
      withObj[inc.relation] = clause;
    }
  }
  return withObj;
}

/**
 * Build Drizzle WHERE clause from parsed filters.
 */
function buildWhere(filters, table) {
  if (filters.length === 0) return undefined;

  const hasOr = filters.some((f) => f.conjunction === 'OR');

  if (!hasOr) {
    const conditions = filters.map((f) => filterToDrizzleCondition(f, table));
    if (conditions.length === 1) return conditions[0];
    return and(...conditions);
  }

  // Mixed AND/OR — group into OR blocks
  const groups = [];
  let currentGroup = [];

  for (const filter of filters) {
    if (filter.conjunction === 'OR' && currentGroup.length > 0) {
      groups.push(buildAndGroup(currentGroup, table));
      currentGroup = [filter];
    } else {
      currentGroup.push(filter);
    }
  }

  if (currentGroup.length > 0) {
    groups.push(buildAndGroup(currentGroup, table));
  }

  if (groups.length === 1) return groups[0];
  return or(...groups);
}

function buildAndGroup(group, table) {
  if (group.length === 1) {
    return filterToDrizzleCondition(group[0], table);
  }
  return and(...group.map((f) => filterToDrizzleCondition(f, table)));
}

/**
 * Convert a single filter to a Drizzle condition.
 */
function filterToDrizzleCondition(filter, table) {
  const { field, operator, value } = filter;
  const col = table[field];

  switch (operator) {
    case '=':
      return value === null ? isNull(col) : eq(col, value);
    case '!=':
      return value === null ? isNotNull(col) : ne(col, value);
    case '>':
      return gt(col, value);
    case '>=':
      return gte(col, value);
    case '<':
      return lt(col, value);
    case '<=':
      return lte(col, value);
    case 'LIKE':
      return like(col, `%${value}%`);
    default:
      return eq(col, value);
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

module.exports = { createDrizzleAdapter };
