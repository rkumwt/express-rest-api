'use strict';

const ApiResponse = require('../../src/ApiResponse');
const { resetConfig, configure } = require('../../src/config');

describe('ApiResponse', () => {
  afterEach(() => resetConfig());

  describe('collection()', () => {
    it('should wrap data in collection response', () => {
      const data = [{ id: 1 }, { id: 2 }];
      const result = ApiResponse.collection(data);
      expect(result).toEqual({ data });
    });

    it('should include meta and message', () => {
      const data = [{ id: 1 }];
      const meta = { paging: { total: 1 } };
      const result = ApiResponse.collection(data, meta, 'Found');
      expect(result).toEqual({ data, meta, message: 'Found' });
    });
  });

  describe('resource()', () => {
    it('should wrap data in resource response', () => {
      const data = { id: 1, name: 'Test' };
      const result = ApiResponse.resource(data);
      expect(result).toEqual({ data });
    });

    it('should include message', () => {
      const data = { id: 1 };
      const result = ApiResponse.resource(data, 'Created');
      expect(result).toEqual({ data, message: 'Created' });
    });
  });

  describe('message()', () => {
    it('should return message-only response', () => {
      const result = ApiResponse.message('Deleted');
      expect(result).toEqual({ message: 'Deleted' });
    });
  });

  describe('buildMeta()', () => {
    const mockReq = {
      baseUrl: '',
      path: '/api/v1/users',
      query: {},
    };

    it('should build paging metadata', () => {
      const meta = ApiResponse.buildMeta({
        total: 100,
        limit: 10,
        offset: 0,
        startTime: Date.now() - 5,
        req: mockReq,
      });

      expect(meta.paging.total).toBe(100);
      expect(meta.paging.limit).toBe(10);
      expect(meta.paging.offset).toBe(0);
      expect(meta.paging.previous).toBeNull();
      expect(meta.paging.next).toContain('offset=10');
      expect(meta.paging.next).toContain('limit=10');
      expect(meta.timing).toBeDefined();
    });

    it('should have no next on last page', () => {
      const meta = ApiResponse.buildMeta({
        total: 10,
        limit: 10,
        offset: 0,
        req: mockReq,
      });

      expect(meta.paging.next).toBeNull();
    });

    it('should have previous when offset > 0', () => {
      const meta = ApiResponse.buildMeta({
        total: 100,
        limit: 10,
        offset: 20,
        req: mockReq,
      });

      expect(meta.paging.previous).toContain('offset=10');
      expect(meta.paging.next).toContain('offset=30');
    });

    it('should clamp previous offset to 0', () => {
      const meta = ApiResponse.buildMeta({
        total: 100,
        limit: 10,
        offset: 5,
        req: mockReq,
      });

      expect(meta.paging.previous).toContain('offset=0');
    });

    it('should not include timing when disabled', () => {
      configure({ response: { timing: false } });
      const meta = ApiResponse.buildMeta({
        total: 10,
        limit: 10,
        offset: 0,
        startTime: Date.now(),
        req: mockReq,
      });

      expect(meta.timing).toBeUndefined();
    });

    it('should preserve existing query params in page URLs', () => {
      const req = { ...mockReq, query: { fields: 'id,name', filters: '(status eq active)' } };
      const meta = ApiResponse.buildMeta({
        total: 100,
        limit: 10,
        offset: 0,
        req,
      });

      expect(meta.paging.next).toContain('fields=');
      expect(meta.paging.next).toContain('filters=');
    });
  });
});
