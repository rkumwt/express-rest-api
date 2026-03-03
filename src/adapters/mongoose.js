'use strict';

/**
 * Create an ORM adapter for Mongoose (MongoDB).
 *
 * @param {object} Model - Mongoose Model (e.g., mongoose.model('User', userSchema))
 * @param {object} options - { primaryKey: '_id' }
 * @returns {object} Adapter implementing findMany, findOne, count, create, update, delete
 */
function createMongooseAdapter(Model, options = {}) {
  const primaryKey = options.primaryKey || '_id';

  return {
    primaryKey,

    async findMany(queryOptions = {}) {
      const filter = {};
      const hasFilters = queryOptions.filters && queryOptions.filters.length > 0;

      if (hasFilters) {
        Object.assign(filter, buildFilter(queryOptions.filters));
      }

      let query = Model.find(filter);

      // Field selection
      const hasFields = queryOptions.fields && queryOptions.fields.length > 0;
      if (hasFields) {
        const projection = buildProjection(queryOptions.fields, primaryKey);
        query = query.select(projection);
      }

      // Includes → populate
      const hasIncludes =
        queryOptions.includes && queryOptions.includes.length > 0;
      if (hasIncludes) {
        for (const inc of queryOptions.includes) {
          query = query.populate(buildPopulate(inc));
        }
      }

      // Ordering
      if (queryOptions.order && queryOptions.order.length > 0) {
        const sort = {};
        for (const o of queryOptions.order) {
          sort[mapField(o.field, primaryKey)] =
            o.direction === 'desc' ? -1 : 1;
        }
        query = query.sort(sort);
      }

      // Pagination
      if (queryOptions.offset !== undefined) {
        query = query.skip(queryOptions.offset);
      }
      if (queryOptions.limit !== undefined) {
        query = query.limit(queryOptions.limit);
      }

      const docs = await query.lean().exec();
      return docs;
    },

    async findOne(id, queryOptions = {}) {
      let query = Model.findById(coerceId(id, primaryKey));

      const hasFields = queryOptions.fields && queryOptions.fields.length > 0;
      if (hasFields) {
        const projection = buildProjection(queryOptions.fields, primaryKey);
        query = query.select(projection);
      }

      const hasIncludes =
        queryOptions.includes && queryOptions.includes.length > 0;
      if (hasIncludes) {
        for (const inc of queryOptions.includes) {
          query = query.populate(buildPopulate(inc));
        }
      }

      const doc = await query.lean().exec();
      return doc || null;
    },

    async count(filterOptions = {}) {
      const filter = {};
      if (filterOptions.filters && filterOptions.filters.length > 0) {
        Object.assign(filter, buildFilter(filterOptions.filters));
      }
      return Model.countDocuments(filter);
    },

    async create(data) {
      const doc = await Model.create(data);
      return doc.toObject();
    },

    async update(id, data) {
      const doc = await Model.findByIdAndUpdate(coerceId(id, primaryKey), data, {
        new: true,
      }).lean();
      return doc || null;
    },

    async delete(id) {
      const doc = await Model.findByIdAndDelete(coerceId(id, primaryKey)).lean();
      return doc || null;
    },
  };
}

/**
 * Build MongoDB projection object from field names.
 */
function buildProjection(fields, primaryKey) {
  const projection = {};
  for (const field of fields) {
    const mapped = mapField(field, primaryKey);
    projection[mapped] = 1;
  }
  // Always include primary key
  projection[primaryKey] = 1;
  return projection;
}

/**
 * Map 'id' to '_id' when primaryKey is '_id'.
 */
function mapField(field, primaryKey) {
  if (primaryKey === '_id' && field === 'id') {
    return '_id';
  }
  return field;
}

/**
 * Build Mongoose populate object from a parsed include.
 */
function buildPopulate(inc) {
  const pop = { path: inc.relation };

  if (inc.fields && inc.fields.length > 0) {
    pop.select = inc.fields.join(' ');
  }

  if (inc.includes && inc.includes.length > 0) {
    pop.populate = inc.includes.map(buildPopulate);
  }

  return pop;
}

/**
 * Build MongoDB filter object from parsed filters.
 */
function buildFilter(filters) {
  if (filters.length === 0) return {};

  const hasOr = filters.some((f) => f.conjunction === 'OR');

  if (!hasOr) {
    const conditions = filters.map(filterToMongoCondition);
    if (conditions.length === 1) return conditions[0];
    return { $and: conditions };
  }

  // Mixed AND/OR — group into OR blocks
  const groups = [];
  let currentGroup = [];

  for (const filter of filters) {
    if (filter.conjunction === 'OR' && currentGroup.length > 0) {
      groups.push(
        currentGroup.length === 1
          ? filterToMongoCondition(currentGroup[0])
          : { $and: currentGroup.map(filterToMongoCondition) }
      );
      currentGroup = [filter];
    } else {
      currentGroup.push(filter);
    }
  }

  if (currentGroup.length > 0) {
    groups.push(
      currentGroup.length === 1
        ? filterToMongoCondition(currentGroup[0])
        : { $and: currentGroup.map(filterToMongoCondition) }
    );
  }

  if (groups.length === 1) return groups[0];
  return { $or: groups };
}

/**
 * Convert a single filter to a MongoDB query condition.
 */
function filterToMongoCondition(filter) {
  const { field, operator, value } = filter;

  switch (operator) {
    case '=':
      return { [field]: value };
    case '!=':
      return { [field]: { $ne: value } };
    case '>':
      return { [field]: { $gt: value } };
    case '>=':
      return { [field]: { $gte: value } };
    case '<':
      return { [field]: { $lt: value } };
    case '<=':
      return { [field]: { $lte: value } };
    case 'LIKE':
      return { [field]: { $regex: escapeRegex(value), $options: 'i' } };
    default:
      return { [field]: value };
  }
}

/**
 * Escape special regex characters for safe use in $regex.
 */
function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Coerce route param ID to the correct type.
 * Mongoose handles ObjectId casting automatically.
 * Only coerce numeric strings to integers for non-ObjectId primary keys.
 */
function coerceId(id, primaryKey) {
  if (primaryKey !== '_id' && typeof id === 'string' && /^\d+$/.test(id)) {
    return parseInt(id, 10);
  }
  return id;
}

module.exports = { createMongooseAdapter };
