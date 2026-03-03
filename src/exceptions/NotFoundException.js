'use strict';

const ApiException = require('./ApiException');

class NotFoundException extends ApiException {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404, 'RESOURCE_NOT_FOUND');
  }
}

module.exports = NotFoundException;
