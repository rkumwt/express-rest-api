'use strict';

const ApiException = require('./ApiException');

class InvalidFilterException extends ApiException {
  constructor(message = 'Invalid filter syntax') {
    super(message, 400, 'INVALID_FILTER');
  }
}

module.exports = InvalidFilterException;
