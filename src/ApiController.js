'use strict';

const { getConfig } = require('./config');
const RequestParser = require('./RequestParser');
const ApiResponse = require('./ApiResponse');
const NotFoundException = require('./exceptions/NotFoundException');

class ApiController {
  // Subclass should set:
  // adapter = createPrismaAdapter(prisma.user)

  // Optional configuration (override in subclass)
  defaultFields = null;
  filterableFields = null;
  hiddenFields = null;
  sortableFields = null;
  defaultLimit = undefined;
  maxLimit = undefined;

  // Action filtering
  only = null;
  except = null;

  // Middleware
  middleware = [];
  middlewareMap = {};

  // Validation schemas (Zod, Joi, or custom function)
  storeSchema = null;
  updateSchema = null;

  // ──────────────────────────────────────
  // CRUD Methods
  // ──────────────────────────────────────

  async index(req, res) {
    const startTime = Date.now();
    const config = getConfig();

    const parser = new RequestParser(req.query, {
      defaultFields: this.defaultFields,
      filterableFields: this.filterableFields,
      sortableFields: this.sortableFields,
      defaultLimit: this.defaultLimit || config.pagination.defaultLimit,
      maxLimit: this.maxLimit || config.pagination.maxLimit,
      primaryKey: this.adapter.primaryKey || 'id',
    });

    let queryOptions = parser.parse();
    queryOptions = this.modifyIndex(queryOptions, req);

    const data = await this.adapter.findMany(queryOptions);
    const total = await this.adapter.count({ filters: queryOptions.filters });

    const stripped = this._stripHiddenFields(data);

    const meta = ApiResponse.buildMeta({
      total,
      limit: queryOptions.limit,
      offset: queryOptions.offset,
      startTime,
      req,
    });

    return res.status(200).json(ApiResponse.collection(stripped, meta));
  }

  async show(req, res) {
    const parser = new RequestParser(req.query, {
      defaultFields: this.defaultFields,
      primaryKey: this.adapter.primaryKey || 'id',
    });

    const parsed = parser.parse();
    let queryOptions = {
      fields: parsed.fields,
      includes: parsed.includes,
    };

    queryOptions = this.modifyShow(queryOptions, req);

    const resource = await this.adapter.findOne(req.params.id, queryOptions);
    if (!resource) {
      throw new NotFoundException();
    }

    const stripped = this._stripHiddenFields(resource);
    return res.status(200).json(ApiResponse.resource(stripped));
  }

  async store(req, res) {
    const config = getConfig();
    let data = req.validated || req.body;

    data = await this.beforeStore(data, req);
    const resource = await this.adapter.create(data);
    await this.afterStore(resource, req);

    const stripped = this._stripHiddenFields(resource);
    return res.status(201).json(
      ApiResponse.resource(stripped, config.messages.created)
    );
  }

  async update(req, res) {
    const config = getConfig();
    let data = req.validated || req.body;

    const existing = await this.adapter.findOne(req.params.id);
    if (!existing) {
      throw new NotFoundException();
    }

    data = await this.beforeUpdate(data, existing, req);
    const resource = await this.adapter.update(req.params.id, data);
    await this.afterUpdate(resource, req);

    const stripped = this._stripHiddenFields(resource);
    return res.status(200).json(
      ApiResponse.resource(stripped, config.messages.updated)
    );
  }

  async destroy(req, res) {
    const config = getConfig();

    const existing = await this.adapter.findOne(req.params.id);
    if (!existing) {
      throw new NotFoundException();
    }

    let queryOptions = {};
    queryOptions = this.modifyDelete(queryOptions, req);

    await this.beforeDestroy(existing, req);
    await this.adapter.delete(req.params.id);
    await this.afterDestroy(existing, req);

    return res.status(200).json(ApiResponse.message(config.messages.deleted));
  }

  // ──────────────────────────────────────
  // Query Modification Hooks
  // Override in subclass to customize queries
  // ──────────────────────────────────────

  modifyIndex(queryOptions, req) {
    return queryOptions;
  }

  modifyShow(queryOptions, req) {
    return queryOptions;
  }

  modifyUpdate(queryOptions, req) {
    return queryOptions;
  }

  modifyDelete(queryOptions, req) {
    return queryOptions;
  }

  // ──────────────────────────────────────
  // Lifecycle Hooks
  // Override in subclass to add custom logic
  // ──────────────────────────────────────

  async beforeStore(data, req) {
    return data;
  }

  async afterStore(resource, req) {}

  async beforeUpdate(data, existing, req) {
    return data;
  }

  async afterUpdate(resource, req) {}

  async beforeDestroy(resource, req) {}

  async afterDestroy(resource, req) {}

  // ──────────────────────────────────────
  // Private helpers
  // ──────────────────────────────────────

  _stripHiddenFields(data) {
    if (!this.hiddenFields || this.hiddenFields.length === 0) return data;
    if (Array.isArray(data)) {
      return data.map((item) => this._stripOne(item));
    }
    return this._stripOne(data);
  }

  _stripOne(item) {
    if (!item || typeof item !== 'object') return item;
    const result = { ...item };
    for (const field of this.hiddenFields) {
      delete result[field];
    }
    return result;
  }
}

module.exports = ApiController;
