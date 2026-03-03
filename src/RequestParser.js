'use strict';

const { getConfig } = require('./config');
const InvalidLimitException = require('./exceptions/InvalidLimitException');
const MaxLimitException = require('./exceptions/MaxLimitException');
const InvalidFilterException = require('./exceptions/InvalidFilterException');
const FilterNotAllowedException = require('./exceptions/FilterNotAllowedException');
const InvalidOrderingException = require('./exceptions/InvalidOrderingException');

const OPERATORS = {
  eq: '=',
  ne: '!=',
  gt: '>',
  ge: '>=',
  lt: '<',
  le: '<=',
  lk: 'LIKE',
};

class RequestParser {
  constructor(query, options = {}) {
    this.query = query || {};
    this.defaultFields = options.defaultFields || null;
    this.filterableFields = options.filterableFields || null;
    this.sortableFields = options.sortableFields || null;
    this.defaultLimit = options.defaultLimit || getConfig().pagination.defaultLimit;
    this.maxLimit = options.maxLimit || getConfig().pagination.maxLimit;
    this.primaryKey = options.primaryKey || 'id';
  }

  parse() {
    return {
      fields: this._parseFields(),
      includes: this._parseIncludes(),
      filters: this._parseFilters(),
      order: this._parseOrder(),
      limit: this._parseLimit(),
      offset: this._parseOffset(),
    };
  }

  _parseFields() {
    const raw = this.query.fields;
    if (!raw) {
      return this.defaultFields ? [...this.defaultFields] : [];
    }

    const fields = [];
    const tokens = this._tokenize(raw);

    for (const token of tokens) {
      // Skip relation tokens (handled by _parseIncludes)
      if (token.includes('{')) continue;
      fields.push(token.trim());
    }

    // Ensure primary key is always included
    if (fields.length > 0 && !fields.includes(this.primaryKey)) {
      fields.unshift(this.primaryKey);
    }

    return fields;
  }

  _parseIncludes() {
    const raw = this.query.fields;
    if (!raw) return [];

    const includes = [];
    const tokens = this._tokenize(raw);

    for (const token of tokens) {
      if (!token.includes('{')) continue;
      const include = this._parseIncludeToken(token.trim());
      if (include) includes.push(include);
    }

    return includes;
  }

  _parseIncludeToken(token) {
    const braceStart = token.indexOf('{');
    const braceEnd = token.lastIndexOf('}');
    if (braceStart === -1 || braceEnd === -1) return null;

    const relation = token.substring(0, braceStart).trim();
    const innerStr = token.substring(braceStart + 1, braceEnd).trim();

    if (!innerStr) {
      return { relation };
    }

    const innerTokens = this._tokenize(innerStr);
    const fields = [];
    const nestedIncludes = [];

    for (const inner of innerTokens) {
      if (inner.includes('{')) {
        const nested = this._parseIncludeToken(inner.trim());
        if (nested) nestedIncludes.push(nested);
      } else {
        fields.push(inner.trim());
      }
    }

    const include = { relation };
    if (fields.length > 0) include.fields = fields;
    if (nestedIncludes.length > 0) include.includes = nestedIncludes;
    return include;
  }

  /**
   * Tokenize a comma-separated string, respecting curly brace nesting.
   * e.g., "id,name,posts{id,title}" → ["id", "name", "posts{id,title}"]
   */
  _tokenize(str) {
    const tokens = [];
    let current = '';
    let depth = 0;

    for (const char of str) {
      if (char === '{') {
        depth++;
        current += char;
      } else if (char === '}') {
        depth--;
        current += char;
      } else if (char === ',' && depth === 0) {
        if (current.trim()) tokens.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    if (current.trim()) tokens.push(current.trim());
    return tokens;
  }

  _parseFilters() {
    const raw = this.query.filters;
    if (!raw) return [];

    let filterStr = raw.trim();

    // Strip outer parentheses
    if (filterStr.startsWith('(') && filterStr.endsWith(')')) {
      filterStr = filterStr.slice(1, -1).trim();
    }

    if (!filterStr) return [];

    // Split by AND/OR (case-insensitive), keeping the conjunction
    const parts = [];
    const regex = /\s+(and|or)\s+/gi;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(filterStr)) !== null) {
      parts.push({
        expr: filterStr.substring(lastIndex, match.index).trim(),
        conjunction: match[1].toUpperCase(),
      });
      lastIndex = match.index + match[0].length;
    }

    // Last (or only) part
    parts.push({
      expr: filterStr.substring(lastIndex).trim(),
      conjunction: null,
    });

    const filters = [];

    for (let i = 0; i < parts.length; i++) {
      const { expr, conjunction } = parts[i];
      const filter = this._parseSingleFilter(expr);

      // The conjunction tells how THIS filter connects to the NEXT one
      // For the adapter, we store the conjunction that connects to the previous filter
      if (i > 0) {
        filter.conjunction = parts[i - 1].conjunction;
      } else {
        filter.conjunction = 'AND'; // Default
      }

      filters.push(filter);
    }

    return filters;
  }

  _parseSingleFilter(expr) {
    const match = expr.match(/^(\w+)\s+(eq|ne|gt|ge|lt|le|lk)\s+(.+)$/i);
    if (!match) {
      throw new InvalidFilterException(`Invalid filter: "${expr}"`);
    }

    const field = match[1];
    const opKey = match[2].toLowerCase();
    const rawValue = match[3].trim();

    // Validate against allowed fields
    if (this.filterableFields && !this.filterableFields.includes(field)) {
      throw new FilterNotAllowedException(field);
    }

    const operator = OPERATORS[opKey];
    const value = this._parseValue(rawValue);

    return { field, operator, value };
  }

  _parseValue(raw) {
    if (raw === 'null') return null;
    if (raw === 'true') return true;
    if (raw === 'false') return false;
    if (/^-?\d+$/.test(raw)) return parseInt(raw, 10);
    if (/^-?\d+\.\d+$/.test(raw)) return parseFloat(raw);
    return raw;
  }

  _parseOrder() {
    const raw = this.query.order;
    if (!raw) return [];

    const parts = raw.split(',');
    const orders = [];

    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;

      const tokens = trimmed.split(/\s+/);
      const field = tokens[0];
      const direction = (tokens[1] || 'asc').toLowerCase();

      if (direction !== 'asc' && direction !== 'desc') {
        throw new InvalidOrderingException(
          `Invalid order direction '${direction}' for field '${field}'. Use 'asc' or 'desc'.`
        );
      }

      if (this.sortableFields && !this.sortableFields.includes(field)) {
        throw new InvalidOrderingException(
          `Sorting on '${field}' is not allowed`
        );
      }

      orders.push({ field, direction });
    }

    return orders;
  }

  _parseLimit() {
    const raw = this.query.limit;
    if (raw === undefined || raw === null || raw === '') {
      return this.defaultLimit;
    }

    const limit = parseInt(raw, 10);
    if (isNaN(limit) || limit <= 0) {
      throw new InvalidLimitException();
    }
    if (limit > this.maxLimit) {
      throw new MaxLimitException(this.maxLimit);
    }

    return limit;
  }

  _parseOffset() {
    const raw = this.query.offset;
    if (raw === undefined || raw === null || raw === '') {
      return 0;
    }

    const offset = parseInt(raw, 10);
    if (isNaN(offset)) return 0;
    return Math.max(0, offset);
  }
}

module.exports = RequestParser;
