'use strict';

const ApiException = require('./ApiException');

class InvalidOrderingException extends ApiException {
  constructor(message = 'Invalid ordering syntax') {
    super(message, 400, 'INVALID_ORDERING');
  }
}

module.exports = InvalidOrderingException;
