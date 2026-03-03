'use strict';

class ApiException extends Error {
  constructor(message = 'Server Error', statusCode = 500, errorCode = null) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      message: this.message,
      error_code: this.errorCode,
      status: this.statusCode,
    };
  }
}

module.exports = ApiException;
