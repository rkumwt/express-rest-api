'use strict';

const RequestParser = require('../../src/RequestParser');
const { resetConfig, configure } = require('../../src/config');
const InvalidLimitException = require('../../src/exceptions/InvalidLimitException');
const MaxLimitException = require('../../src/exceptions/MaxLimitException');
const InvalidFilterException = require('../../src/exceptions/InvalidFilterException');
const FilterNotAllowedException = require('../../src/exceptions/FilterNotAllowedException');
const InvalidOrderingException = require('../../src/exceptions/InvalidOrderingException');

describe('RequestParser', () => {
  afterEach(() => resetConfig());

  describe('fields', () => {
    it('should return empty array when no fields and no defaults', () => {
      const parser = new RequestParser({});
      const result = parser.parse();
      expect(result.fields).toEqual([]);
    });

    it('should use defaultFields when no query fields', () => {
      const parser = new RequestParser({}, { defaultFields: ['id', 'name'] });
      const result = parser.parse();
      expect(result.fields).toEqual(['id', 'name']);
    });

    it('should parse comma-separated fields', () => {
      const parser = new RequestParser({ fields: 'id,name,email' });
      const result = parser.parse();
      expect(result.fields).toContain('id');
      expect(result.fields).toContain('name');
      expect(result.fields).toContain('email');
    });

    it('should always include primary key', () => {
      const parser = new RequestParser({ fields: 'name,email' });
      const result = parser.parse();
      expect(result.fields[0]).toBe('id');
    });

    it('should exclude relation tokens from fields', () => {
      const parser = new RequestParser({ fields: 'id,name,posts{id,title}' });
      const result = parser.parse();
      expect(result.fields).toContain('id');
      expect(result.fields).toContain('name');
      expect(result.fields).not.toContain('posts{id,title}');
    });
  });

  describe('includes', () => {
    it('should return empty array when no relation fields', () => {
      const parser = new RequestParser({ fields: 'id,name' });
      const result = parser.parse();
      expect(result.includes).toEqual([]);
    });

    it('should parse relation includes', () => {
      const parser = new RequestParser({ fields: 'id,name,posts{id,title}' });
      const result = parser.parse();
      expect(result.includes).toHaveLength(1);
      expect(result.includes[0].relation).toBe('posts');
      expect(result.includes[0].fields).toEqual(['id', 'title']);
    });

    it('should parse nested includes', () => {
      const parser = new RequestParser({
        fields: 'id,posts{id,title,comments{id,body}}',
      });
      const result = parser.parse();
      expect(result.includes[0].relation).toBe('posts');
      expect(result.includes[0].includes[0].relation).toBe('comments');
      expect(result.includes[0].includes[0].fields).toEqual(['id', 'body']);
    });

    it('should handle include without specific fields', () => {
      const parser = new RequestParser({ fields: 'id,posts{}' });
      const result = parser.parse();
      expect(result.includes[0].relation).toBe('posts');
      expect(result.includes[0].fields).toBeUndefined();
    });
  });

  describe('filters', () => {
    it('should return empty array when no filters', () => {
      const parser = new RequestParser({});
      const result = parser.parse();
      expect(result.filters).toEqual([]);
    });

    it('should parse single eq filter', () => {
      const parser = new RequestParser({ filters: '(status eq active)' });
      const result = parser.parse();
      expect(result.filters).toHaveLength(1);
      expect(result.filters[0]).toMatchObject({
        field: 'status',
        operator: '=',
        value: 'active',
      });
    });

    it('should parse AND combination', () => {
      const parser = new RequestParser({
        filters: '(status eq active and role eq admin)',
      });
      const result = parser.parse();
      expect(result.filters).toHaveLength(2);
      expect(result.filters[0].field).toBe('status');
      expect(result.filters[1].field).toBe('role');
      expect(result.filters[1].conjunction).toBe('AND');
    });

    it('should parse OR combination', () => {
      const parser = new RequestParser({
        filters: '(role eq admin or role eq editor)',
      });
      const result = parser.parse();
      expect(result.filters).toHaveLength(2);
      expect(result.filters[1].conjunction).toBe('OR');
    });

    it('should parse all operators', () => {
      const operators = {
        eq: '=',
        ne: '!=',
        gt: '>',
        ge: '>=',
        lt: '<',
        le: '<=',
        lk: 'LIKE',
      };

      for (const [short, full] of Object.entries(operators)) {
        const parser = new RequestParser({ filters: `(id ${short} 5)` });
        const result = parser.parse();
        expect(result.filters[0].operator).toBe(full);
      }
    });

    it('should parse null values', () => {
      const parser = new RequestParser({ filters: '(deletedAt eq null)' });
      const result = parser.parse();
      expect(result.filters[0].value).toBeNull();
    });

    it('should parse boolean values', () => {
      const parser = new RequestParser({ filters: '(published eq true)' });
      const result = parser.parse();
      expect(result.filters[0].value).toBe(true);
    });

    it('should parse integer values', () => {
      const parser = new RequestParser({ filters: '(age gt 18)' });
      const result = parser.parse();
      expect(result.filters[0].value).toBe(18);
    });

    it('should parse float values', () => {
      const parser = new RequestParser({ filters: '(price gt 9.99)' });
      const result = parser.parse();
      expect(result.filters[0].value).toBe(9.99);
    });

    it('should throw on invalid filter syntax', () => {
      const parser = new RequestParser({ filters: '(invalid)' });
      expect(() => parser.parse()).toThrow(InvalidFilterException);
    });

    it('should throw on disallowed field', () => {
      const parser = new RequestParser(
        { filters: '(password eq test)' },
        { filterableFields: ['name', 'email'] }
      );
      expect(() => parser.parse()).toThrow(FilterNotAllowedException);
    });

    it('should allow field in filterableFields', () => {
      const parser = new RequestParser(
        { filters: '(name eq test)' },
        { filterableFields: ['name', 'email'] }
      );
      expect(() => parser.parse()).not.toThrow();
    });
  });

  describe('order', () => {
    it('should return empty array when no order', () => {
      const parser = new RequestParser({});
      const result = parser.parse();
      expect(result.order).toEqual([]);
    });

    it('should parse single field asc', () => {
      const parser = new RequestParser({ order: 'name asc' });
      const result = parser.parse();
      expect(result.order).toEqual([{ field: 'name', direction: 'asc' }]);
    });

    it('should parse single field desc', () => {
      const parser = new RequestParser({ order: 'name desc' });
      const result = parser.parse();
      expect(result.order).toEqual([{ field: 'name', direction: 'desc' }]);
    });

    it('should default direction to asc', () => {
      const parser = new RequestParser({ order: 'name' });
      const result = parser.parse();
      expect(result.order[0].direction).toBe('asc');
    });

    it('should parse multiple order fields', () => {
      const parser = new RequestParser({ order: 'name asc, id desc' });
      const result = parser.parse();
      expect(result.order).toHaveLength(2);
      expect(result.order[0]).toEqual({ field: 'name', direction: 'asc' });
      expect(result.order[1]).toEqual({ field: 'id', direction: 'desc' });
    });

    it('should throw on invalid direction', () => {
      const parser = new RequestParser({ order: 'name up' });
      expect(() => parser.parse()).toThrow(InvalidOrderingException);
    });

    it('should throw on disallowed sort field', () => {
      const parser = new RequestParser(
        { order: 'secret asc' },
        { sortableFields: ['name', 'email'] }
      );
      expect(() => parser.parse()).toThrow(InvalidOrderingException);
    });
  });

  describe('limit', () => {
    it('should use default limit', () => {
      const parser = new RequestParser({});
      const result = parser.parse();
      expect(result.limit).toBe(10); // Default from config
    });

    it('should use custom default limit', () => {
      const parser = new RequestParser({}, { defaultLimit: 25 });
      const result = parser.parse();
      expect(result.limit).toBe(25);
    });

    it('should parse explicit limit', () => {
      const parser = new RequestParser({ limit: '5' });
      const result = parser.parse();
      expect(result.limit).toBe(5);
    });

    it('should throw on zero limit', () => {
      const parser = new RequestParser({ limit: '0' });
      expect(() => parser.parse()).toThrow(InvalidLimitException);
    });

    it('should throw on negative limit', () => {
      const parser = new RequestParser({ limit: '-5' });
      expect(() => parser.parse()).toThrow(InvalidLimitException);
    });

    it('should throw on exceeding max limit', () => {
      const parser = new RequestParser({ limit: '2000' }, { maxLimit: 1000 });
      expect(() => parser.parse()).toThrow(MaxLimitException);
    });
  });

  describe('offset', () => {
    it('should default to 0', () => {
      const parser = new RequestParser({});
      const result = parser.parse();
      expect(result.offset).toBe(0);
    });

    it('should parse explicit offset', () => {
      const parser = new RequestParser({ offset: '20' });
      const result = parser.parse();
      expect(result.offset).toBe(20);
    });

    it('should clamp negative offset to 0', () => {
      const parser = new RequestParser({ offset: '-5' });
      const result = parser.parse();
      expect(result.offset).toBe(0);
    });

    it('should handle non-numeric offset', () => {
      const parser = new RequestParser({ offset: 'abc' });
      const result = parser.parse();
      expect(result.offset).toBe(0);
    });
  });
});
