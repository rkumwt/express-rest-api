'use strict';

let Op;

/**
 * Create an ORM adapter for Sequelize.
 *
 * @param {object} Model - Sequelize Model class (e.g., User)
 * @param {object} options - { primaryKey: 'id' }
 * @returns {object} Adapter implementing findMany, findOne, count, create, update, delete
 */
function createSequelizeAdapter(Model, options = {}) {
  if (!Op) {
    try {
      ({ Op } = require('sequelize'));
    } catch (e) {
      throw new Error(
        'sequelize is required for createSequelizeAdapter. Install it with: npm install sequelize'
      );
    }
  }

  const primaryKey = options.primaryKey || 'id';

  return {
    primaryKey,

    async findMany(queryOptions = {}) {
      const args = buildFindAllArgs(queryOptions, primaryKey);
      return Model.findAll(args).then((rows) =>
        rows.map((r) => r.get({ plain: true }))
      );
    },

    async findOne(id, queryOptions = {}) {
      const args = {};

      const hasFields =
        queryOptions.fields && queryOptions.fields.length > 0;
      const hasIncludes =
        queryOptions.includes && queryOptions.includes.length > 0;

      if (hasFields) {
        args.attributes = buildAttributes(queryOptions.fields, primaryKey);
      }

      if (hasIncludes) {
        args.include = buildInclude(queryOptions.includes);
      }

      const record = await Model.findByPk(coerceId(id), args);
      return record ? record.get({ plain: true }) : null;
    },

    async count(filterOptions = {}) {
      const args = {};
      if (filterOptions.filters && filterOptions.filters.length > 0) {
        args.where = buildWhere(filterOptions.filters);
      }
      return Model.count(args);
    },

    async create(data) {
      const record = await Model.create(data);
      return record.get({ plain: true });
    },

    async update(id, data) {
      await Model.update(data, {
        where: { [primaryKey]: coerceId(id) },
      });
      const record = await Model.findByPk(coerceId(id));
      return record ? record.get({ plain: true }) : null;
    },

    async delete(id) {
      const record = await Model.findByPk(coerceId(id));
      await Model.destroy({
        where: { [primaryKey]: coerceId(id) },
      });
      return record ? record.get({ plain: true }) : null;
    },
  };
}

/**
 * Build Sequelize findAll args from parsed query options.
 */
function buildFindAllArgs(queryOptions, primaryKey) {
  const args = {};

  // Field selection
  const hasFields = queryOptions.fields && queryOptions.fields.length > 0;
  const hasIncludes =
    queryOptions.includes && queryOptions.includes.length > 0;

  if (hasFields) {
    args.attributes = buildAttributes(queryOptions.fields, primaryKey);
  }

  if (hasIncludes) {
    args.include = buildInclude(queryOptions.includes);
  }

  // Filters → WHERE
  if (queryOptions.filters && queryOptions.filters.length > 0) {
    args.where = buildWhere(queryOptions.filters);
  }

  // Ordering
  if (queryOptions.order && queryOptions.order.length > 0) {
    args.order = queryOptions.order.map((o) => [
      o.field,
      o.direction.toUpperCase(),
    ]);
  }

  // Pagination
  if (queryOptions.limit !== undefined) {
    args.limit = queryOptions.limit;
  }
  if (queryOptions.offset !== undefined) {
    args.offset = queryOptions.offset;
  }

  return args;
}

/**
 * Build Sequelize attributes array from field names.
 */
function buildAttributes(fields, primaryKey) {
  const attrs = [...fields];
  if (!attrs.includes(primaryKey)) {
    attrs.unshift(primaryKey);
  }
  return attrs;
}

/**
 * Build Sequelize include array from parsed includes.
 */
function buildInclude(includes) {
  return includes.map((inc) => {
    const clause = { association: inc.relation };

    if (inc.fields && inc.fields.length > 0) {
      clause.attributes = [...inc.fields];
    }

    if (inc.includes && inc.includes.length > 0) {
      clause.include = buildInclude(inc.includes);
    }

    return clause;
  });
}

/**
 * Build Sequelize WHERE clause from parsed filters.
 */
function buildWhere(filters) {
  if (filters.length === 0) return {};

  const hasOr = filters.some((f) => f.conjunction === 'OR');

  if (!hasOr) {
    const conditions = filters.map(filterToSequelizeCondition);
    if (conditions.length === 1) return conditions[0];
    return { [Op.and]: conditions };
  }

  // Mixed AND/OR — group into OR blocks
  const groups = [];
  let currentGroup = [];

  for (const filter of filters) {
    if (filter.conjunction === 'OR' && currentGroup.length > 0) {
      groups.push(
        currentGroup.length === 1
          ? filterToSequelizeCondition(currentGroup[0])
          : { [Op.and]: currentGroup.map(filterToSequelizeCondition) }
      );
      currentGroup = [filter];
    } else {
      currentGroup.push(filter);
    }
  }

  if (currentGroup.length > 0) {
    groups.push(
      currentGroup.length === 1
        ? filterToSequelizeCondition(currentGroup[0])
        : { [Op.and]: currentGroup.map(filterToSequelizeCondition) }
    );
  }

  if (groups.length === 1) return groups[0];
  return { [Op.or]: groups };
}

/**
 * Convert a single filter to a Sequelize where condition.
 */
function filterToSequelizeCondition(filter) {
  const { field, operator, value } = filter;

  switch (operator) {
    case '=':
      return value === null
        ? { [field]: { [Op.eq]: null } }
        : { [field]: { [Op.eq]: value } };
    case '!=':
      return value === null
        ? { [field]: { [Op.ne]: null } }
        : { [field]: { [Op.ne]: value } };
    case '>':
      return { [field]: { [Op.gt]: value } };
    case '>=':
      return { [field]: { [Op.gte]: value } };
    case '<':
      return { [field]: { [Op.lt]: value } };
    case '<=':
      return { [field]: { [Op.lte]: value } };
    case 'LIKE':
      return { [field]: { [Op.like]: `%${value}%` } };
    default:
      return { [field]: { [Op.eq]: value } };
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

module.exports = { createSequelizeAdapter };
