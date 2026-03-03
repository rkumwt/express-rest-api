'use strict';

const { getConfig } = require('./config');

class ApiResponse {
  static collection(data, meta, message) {
    const response = { data };
    if (message) response.message = message;
    if (meta) response.meta = meta;
    return response;
  }

  static resource(data, message) {
    const response = { data };
    if (message) response.message = message;
    return response;
  }

  static message(message) {
    return { message };
  }

  static buildMeta({ total, limit, offset, startTime, req }) {
    const config = getConfig();
    const meta = {
      paging: {
        total,
        limit,
        offset,
        previous:
          offset > 0
            ? ApiResponse._buildPageUrl(req, Math.max(0, offset - limit), limit)
            : null,
        next:
          offset + limit < total
            ? ApiResponse._buildPageUrl(req, offset + limit, limit)
            : null,
      },
    };

    if (config.response.timing && startTime) {
      meta.timing = `${Date.now() - startTime}ms`;
    }

    return meta;
  }

  static _buildPageUrl(req, newOffset, limit) {
    const url = `${req.baseUrl}${req.path}`;
    const params = new URLSearchParams();

    // Preserve existing query params
    for (const [key, value] of Object.entries(req.query)) {
      if (key !== 'offset' && key !== 'limit') {
        params.set(key, value);
      }
    }

    params.set('limit', String(limit));
    params.set('offset', String(newOffset));
    return `${url}?${params.toString()}`;
  }
}

module.exports = ApiResponse;
