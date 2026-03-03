'use strict';

const ApiException = require('./ApiException');

class UnauthorizedException extends ApiException {
  constructor(message = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

module.exports = UnauthorizedException;
