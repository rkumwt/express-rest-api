'use strict';

const ApiException = require('./ApiException');

class ValidationException extends ApiException {
  constructor(errors = {}, message = 'Validation failed') {
    super(message, 422, 'VALIDATION_ERROR');
    this.errors = errors;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      errors: this.errors,
    };
  }
}

module.exports = ValidationException;
