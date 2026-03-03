'use strict';

/**
 * Create an ORM adapter for Prisma.
 *
 * @param {object} model - Prisma model delegate (e.g., prisma.user)
 * @param {object} options - { primaryKey: 'id' }
 * @returns {object} Adapter implementing findMany, findOne, count, create, update, delete
 */
function createPrismaAdapter(model, options = {}) {
  const primaryKey = options.primaryKey || 'id';

  return {
    primaryKey,

    async findMany(queryOptions = {}) {
      const args = buildFindManyArgs(queryOptions, primaryKey);
      return model.findMany(args);
    },

    async findOne(id, queryOptions = {}) {
      const args = { where: { [primaryKey]: coerceId(id) } };

      const hasFields =
        queryOptions.fields && queryOptions.fields.length > 0;
      const hasIncludes =
        queryOptions.includes && queryOptions.includes.length > 0;

      if (hasFields || hasIncludes) {
        args.select = hasFields
          ? buildSelect(queryOptions.fields, primaryKey)
          : undefined;

        if (hasIncludes) {
          if (!args.select) args.select = {};
          for (const inc of queryOptions.includes) {
            args.select[inc.relation] = buildIncludeClause(inc);
          }
        }
      }

      return model.findUnique(args);
    },

    async count(filterOptions = {}) {
      const args = {};
      if (filterOptions.filters && filterOptions.filters.length > 0) {
        args.where = buildWhere(filterOptions.filters);
      }
      return model.count(args);
    },

    async create(data) {
      return model.create({ data });
    },

    async update(id, data) {
      return model.update({
        where: { [primaryKey]: coerceId(id) },
        data,
      });
    },

    async delete(id) {
      return model.delete({
        where: { [primaryKey]: coerceId(id) },
      });
    },
  };
}

/**
 * Build Prisma findMany args from parsed query options.
 */
function buildFindManyArgs(queryOptions, primaryKey) {
  const args = {};

  // Field selection
  const hasFields = queryOptions.fields && queryOptions.fields.length > 0;
  const hasIncludes =
    queryOptions.includes && queryOptions.includes.length > 0;

  if (hasFields || hasIncludes) {
    // When we have fields or includes, use select
    args.select = hasFields
      ? buildSelect(queryOptions.fields, primaryKey)
      : {};

    if (hasIncludes) {
      for (const inc of queryOptions.includes) {
        args.select[inc.relation] = buildIncludeClause(inc);
      }
    }
  } else if (hasIncludes) {
    // Only includes, no specific fields — use include
    args.include = {};
    for (const inc of queryOptions.includes) {
      args.include[inc.relation] = buildIncludeClause(inc);
    }
  }

  // Filters → WHERE
  if (queryOptions.filters && queryOptions.filters.length > 0) {
    args.where = buildWhere(queryOptions.filters);
  }

  // Ordering → orderBy
  if (queryOptions.order && queryOptions.order.length > 0) {
    args.orderBy = queryOptions.order.map((o) => ({
      [o.field]: o.direction,
    }));
  }

  // Pagination
  if (queryOptions.limit !== undefined) {
    args.take = queryOptions.limit;
  }
  if (queryOptions.offset !== undefined) {
    args.skip = queryOptions.offset;
  }

  return args;
}

/**
 * Build Prisma select object from field names.
 */
function buildSelect(fields, primaryKey) {
  const select = {};

  // Always include primary key
  select[primaryKey] = true;

  for (const field of fields) {
    select[field] = true;
  }

  return select;
}

/**
 * Build Prisma include/select clause for a relation.
 */
function buildIncludeClause(inc) {
  if (!inc.fields && !inc.includes) {
    return true; // Include all fields
  }

  const clause = {};

  if (inc.fields && inc.fields.length > 0) {
    clause.select = {};
    for (const field of inc.fields) {
      clause.select[field] = true;
    }
    // Nest nested includes into select
    if (inc.includes && inc.includes.length > 0) {
      for (const nested of inc.includes) {
        clause.select[nested.relation] = buildIncludeClause(nested);
      }
    }
  } else if (inc.includes && inc.includes.length > 0) {
    clause.include = {};
    for (const nested of inc.includes) {
      clause.include[nested.relation] = buildIncludeClause(nested);
    }
  }

  return clause;
}

/**
 * Build Prisma WHERE clause from parsed filters.
 */
function buildWhere(filters) {
  if (filters.length === 0) return {};

  // Check if there are any OR conjunctions
  const hasOr = filters.some((f) => f.conjunction === 'OR');

  if (!hasOr) {
    // All AND — simple flat where or AND array
    const conditions = filters.map(filterToPrismaCondition);
    if (conditions.length === 1) return conditions[0];
    return { AND: conditions };
  }

  // Mixed AND/OR — group into OR blocks
  // Each "OR" conjunction starts a new group
  const groups = [];
  let currentGroup = [];

  for (const filter of filters) {
    if (filter.conjunction === 'OR' && currentGroup.length > 0) {
      groups.push(
        currentGroup.length === 1
          ? currentGroup[0]
          : { AND: currentGroup.map(filterToPrismaCondition) }
      );
      currentGroup = [filter];
    } else {
      currentGroup.push(filter);
    }
  }

  // Push the last group
  if (currentGroup.length > 0) {
    groups.push(
      currentGroup.length === 1
        ? filterToPrismaCondition(currentGroup[0])
        : { AND: currentGroup.map(filterToPrismaCondition) }
    );
  }

  if (groups.length === 1) return groups[0];
  return { OR: groups };
}

/**
 * Convert a single filter to a Prisma where condition.
 */
function filterToPrismaCondition(filter) {
  const { field, operator, value } = filter;

  switch (operator) {
    case '=':
      return value === null
        ? { [field]: null }
        : { [field]: { equals: value } };
    case '!=':
      return value === null
        ? { [field]: { not: null } }
        : { [field]: { not: value } };
    case '>':
      return { [field]: { gt: value } };
    case '>=':
      return { [field]: { gte: value } };
    case '<':
      return { [field]: { lt: value } };
    case '<=':
      return { [field]: { lte: value } };
    case 'LIKE':
      return { [field]: { contains: value } };
    default:
      return { [field]: { equals: value } };
  }
}

/**
 * Coerce route param ID to the correct type.
 * Express route params are always strings, but Prisma with SQLite expects integers for autoincrement.
 */
function coerceId(id) {
  if (typeof id === 'string' && /^\d+$/.test(id)) {
    return parseInt(id, 10);
  }
  return id;
}

module.exports = { createPrismaAdapter };
