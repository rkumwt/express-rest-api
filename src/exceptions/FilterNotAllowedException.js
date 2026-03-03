'use strict';

const ApiException = require('./ApiException');

class FilterNotAllowedException extends ApiException {
  constructor(field) {
    super(`Filtering on '${field}' is not allowed`, 400, 'FILTER_NOT_ALLOWED');
  }
}

module.exports = FilterNotAllowedException;
