'use strict';

const ApiException = require('./ApiException');

class InvalidLimitException extends ApiException {
  constructor() {
    super('Limit must be a positive integer', 400, 'INVALID_LIMIT');
  }
}

module.exports = InvalidLimitException;
