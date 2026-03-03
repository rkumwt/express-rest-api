'use strict';

const {
  ApiException,
  NotFoundException,
  ValidationException,
  UnauthorizedException,
  ForbiddenException,
  InvalidLimitException,
  MaxLimitException,
  InvalidFilterException,
  FilterNotAllowedException,
  InvalidOrderingException,
} = require('../../src/exceptions');

describe('Exceptions', () => {
  describe('ApiException', () => {
    it('should have default values', () => {
      const err = new ApiException();
      expect(err.message).toBe('Server Error');
      expect(err.statusCode).toBe(500);
      expect(err.errorCode).toBeNull();
      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(ApiException);
    });

    it('should accept custom values', () => {
      const err = new ApiException('Custom', 418, 'TEAPOT');
      expect(err.message).toBe('Custom');
      expect(err.statusCode).toBe(418);
      expect(err.errorCode).toBe('TEAPOT');
    });

    it('should serialize to JSON', () => {
      const err = new ApiException('Test', 400, 'TEST');
      const json = err.toJSON();
      expect(json).toEqual({
        message: 'Test',
        error_code: 'TEST',
        status: 400,
      });
    });

    it('should have a stack trace', () => {
      const err = new ApiException('Test');
      expect(err.stack).toBeDefined();
      expect(err.stack).toContain('ApiException');
    });
  });

  describe('NotFoundException', () => {
    it('should have correct defaults', () => {
      const err = new NotFoundException();
      expect(err.message).toBe('Resource not found');
      expect(err.statusCode).toBe(404);
      expect(err.errorCode).toBe('RESOURCE_NOT_FOUND');
      expect(err).toBeInstanceOf(ApiException);
    });

    it('should accept custom resource name', () => {
      const err = new NotFoundException('User');
      expect(err.message).toBe('User not found');
    });
  });

  describe('ValidationException', () => {
    it('should have correct defaults', () => {
      const errors = { email: ['Invalid email'] };
      const err = new ValidationException(errors);
      expect(err.message).toBe('Validation failed');
      expect(err.statusCode).toBe(422);
      expect(err.errorCode).toBe('VALIDATION_ERROR');
      expect(err.errors).toEqual(errors);
    });

    it('should include errors in toJSON', () => {
      const errors = { name: ['Required'], email: ['Invalid'] };
      const err = new ValidationException(errors);
      const json = err.toJSON();
      expect(json.errors).toEqual(errors);
      expect(json.message).toBe('Validation failed');
      expect(json.error_code).toBe('VALIDATION_ERROR');
      expect(json.status).toBe(422);
    });
  });

  describe('UnauthorizedException', () => {
    it('should have correct defaults', () => {
      const err = new UnauthorizedException();
      expect(err.message).toBe('Unauthorized');
      expect(err.statusCode).toBe(401);
      expect(err.errorCode).toBe('UNAUTHORIZED');
    });

    it('should accept custom message', () => {
      const err = new UnauthorizedException('Token expired');
      expect(err.message).toBe('Token expired');
    });
  });

  describe('ForbiddenException', () => {
    it('should have correct defaults', () => {
      const err = new ForbiddenException();
      expect(err.message).toBe('Forbidden');
      expect(err.statusCode).toBe(403);
      expect(err.errorCode).toBe('FORBIDDEN');
    });
  });

  describe('InvalidLimitException', () => {
    it('should have correct values', () => {
      const err = new InvalidLimitException();
      expect(err.message).toBe('Limit must be a positive integer');
      expect(err.statusCode).toBe(400);
      expect(err.errorCode).toBe('INVALID_LIMIT');
    });
  });

  describe('MaxLimitException', () => {
    it('should include max value in message', () => {
      const err = new MaxLimitException(100);
      expect(err.message).toBe('Limit cannot exceed 100');
      expect(err.statusCode).toBe(400);
      expect(err.errorCode).toBe('MAX_LIMIT_EXCEEDED');
    });
  });

  describe('InvalidFilterException', () => {
    it('should have correct defaults', () => {
      const err = new InvalidFilterException();
      expect(err.message).toBe('Invalid filter syntax');
      expect(err.statusCode).toBe(400);
      expect(err.errorCode).toBe('INVALID_FILTER');
    });
  });

  describe('FilterNotAllowedException', () => {
    it('should include field name in message', () => {
      const err = new FilterNotAllowedException('password');
      expect(err.message).toBe("Filtering on 'password' is not allowed");
      expect(err.statusCode).toBe(400);
      expect(err.errorCode).toBe('FILTER_NOT_ALLOWED');
    });
  });

  describe('InvalidOrderingException', () => {
    it('should have correct defaults', () => {
      const err = new InvalidOrderingException();
      expect(err.message).toBe('Invalid ordering syntax');
      expect(err.statusCode).toBe(400);
      expect(err.errorCode).toBe('INVALID_ORDERING');
    });
  });

  describe('instanceof checks', () => {
    it('all exceptions should be instanceof ApiException and Error', () => {
      const exceptions = [
        new NotFoundException(),
        new ValidationException({}),
        new UnauthorizedException(),
        new ForbiddenException(),
        new InvalidLimitException(),
        new MaxLimitException(100),
        new InvalidFilterException(),
        new FilterNotAllowedException('x'),
        new InvalidOrderingException(),
      ];

      for (const err of exceptions) {
        expect(err).toBeInstanceOf(ApiException);
        expect(err).toBeInstanceOf(Error);
      }
    });
  });
});
