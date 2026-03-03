'use strict';

const ApiException = require('./ApiException');

class MaxLimitException extends ApiException {
  constructor(max) {
    super(`Limit cannot exceed ${max}`, 400, 'MAX_LIMIT_EXCEEDED');
  }
}

module.exports = MaxLimitException;
