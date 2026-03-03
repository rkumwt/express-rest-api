'use strict';

const ApiException = require('./ApiException');

class ForbiddenException extends ApiException {
  constructor(message = 'Forbidden') {
    super(message, 403, 'FORBIDDEN');
  }
}

module.exports = ForbiddenException;
