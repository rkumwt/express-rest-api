'use strict';

const request = require('supertest');
const { prisma, createTestApp, seed, cleanDb, disconnectDb } = require('../helpers');
const { ApiController, createPrismaAdapter } = require('../../src/index');

class UserController extends ApiController {
  constructor() {
    super();
    this.adapter = createPrismaAdapter(prisma.user);
    this.defaultFields = ['id', 'name', 'email', 'role', 'status'];
    this.filterableFields = ['id', 'name', 'email', 'role', 'status'];
    this.hiddenFields = ['password'];
    this.sortableFields = ['id', 'name', 'email'];
  }
}

let app;
let seededUsers;

beforeAll(async () => {
  const data = await seed();
  seededUsers = data.users;
  app = createTestApp((router) => {
    router.apiResource('users', UserController);
  });
});

afterAll(async () => {
  await cleanDb();
  await disconnectDb();
});

describe('CRUD Integration', () => {
  describe('GET /api/v1/users (index)', () => {
    it('should return paginated list', async () => {
      const res = await request(app).get('/api/v1/users');
      expect(res.status).toBe(200);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.meta).toBeDefined();
      expect(res.body.meta.paging.total).toBe(10);
      expect(res.body.meta.paging.limit).toBe(10);
      expect(res.body.meta.paging.offset).toBe(0);
    });

    it('should not expose hidden fields', async () => {
      const res = await request(app).get('/api/v1/users');
      expect(res.status).toBe(200);
      for (const user of res.body.data) {
        expect(user.password).toBeUndefined();
      }
    });

    it('should respect limit and offset', async () => {
      const res = await request(app).get('/api/v1/users?limit=3&offset=2');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(3);
      expect(res.body.meta.paging.limit).toBe(3);
      expect(res.body.meta.paging.offset).toBe(2);
      expect(res.body.meta.paging.previous).not.toBeNull();
    });
  });

  describe('GET /api/v1/users/:id (show)', () => {
    it('should return a single user', async () => {
      const id = seededUsers[0].id;
      const res = await request(app).get(`/api/v1/users/${id}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.id).toBe(id);
      expect(res.body.data.name).toBeDefined();
    });

    it('should return 404 for non-existent user', async () => {
      const res = await request(app).get('/api/v1/users/99999');
      expect(res.status).toBe(404);
      expect(res.body.error_code).toBe('RESOURCE_NOT_FOUND');
    });

    it('should not expose hidden fields', async () => {
      const id = seededUsers[0].id;
      const res = await request(app).get(`/api/v1/users/${id}`);
      expect(res.body.data.password).toBeUndefined();
    });
  });

  describe('POST /api/v1/users (store)', () => {
    it('should create a user', async () => {
      const res = await request(app)
        .post('/api/v1/users')
        .send({ name: 'New User', email: 'new@example.com', password: 'secret' });

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe('New User');
      expect(res.body.data.email).toBe('new@example.com');
      expect(res.body.message).toBe('Resource created successfully');
      expect(res.body.data.password).toBeUndefined(); // Hidden
    });
  });

  describe('PUT /api/v1/users/:id (update)', () => {
    it('should update a user', async () => {
      const id = seededUsers[0].id;
      const res = await request(app)
        .put(`/api/v1/users/${id}`)
        .send({ name: 'Updated Name' });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Updated Name');
      expect(res.body.message).toBe('Resource updated successfully');
    });

    it('should return 404 for non-existent user', async () => {
      const res = await request(app)
        .put('/api/v1/users/99999')
        .send({ name: 'Ghost' });

      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /api/v1/users/:id (partial update)', () => {
    it('should partially update a user', async () => {
      const id = seededUsers[1].id;
      const res = await request(app)
        .patch(`/api/v1/users/${id}`)
        .send({ role: 'editor' });

      expect(res.status).toBe(200);
      expect(res.body.data.role).toBe('editor');
    });
  });

  describe('DELETE /api/v1/users/:id (destroy)', () => {
    let deleteId;

    beforeAll(async () => {
      const user = await prisma.user.create({
        data: { name: 'ToDelete', email: 'delete@example.com' },
      });
      deleteId = user.id;
    });

    it('should delete a user', async () => {
      const res = await request(app).delete(`/api/v1/users/${deleteId}`);
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Resource deleted successfully');
    });

    it('should return 404 when deleting again', async () => {
      const res = await request(app).delete(`/api/v1/users/${deleteId}`);
      expect(res.status).toBe(404);
    });
  });

  describe('Filtering', () => {
    it('should filter by status eq active', async () => {
      const res = await request(app).get(
        '/api/v1/users?filters=(status eq active)'
      );
      expect(res.status).toBe(200);
      for (const user of res.body.data) {
        expect(user.status).toBe('active');
      }
    });

    it('should filter by role with AND', async () => {
      const res = await request(app).get(
        '/api/v1/users?filters=(role eq admin and status eq active)'
      );
      expect(res.status).toBe(200);
      for (const user of res.body.data) {
        expect(user.role).toBe('admin');
        expect(user.status).toBe('active');
      }
    });

    it('should reject disallowed filter field', async () => {
      const res = await request(app).get(
        '/api/v1/users?filters=(password eq secret)'
      );
      expect(res.status).toBe(400);
      expect(res.body.error_code).toBe('FILTER_NOT_ALLOWED');
    });

    it('should reject invalid filter syntax', async () => {
      const res = await request(app).get('/api/v1/users?filters=(invalid)');
      expect(res.status).toBe(400);
      expect(res.body.error_code).toBe('INVALID_FILTER');
    });
  });

  describe('Sorting', () => {
    it('should sort by name asc', async () => {
      const res = await request(app).get('/api/v1/users?order=name asc');
      expect(res.status).toBe(200);
      const names = res.body.data.map((u) => u.name);
      const sorted = [...names].sort();
      expect(names).toEqual(sorted);
    });

    it('should sort by name desc', async () => {
      const res = await request(app).get('/api/v1/users?order=name desc');
      expect(res.status).toBe(200);
      const names = res.body.data.map((u) => u.name);
      const sorted = [...names].sort().reverse();
      expect(names).toEqual(sorted);
    });
  });

  describe('Field Selection', () => {
    it('should return only requested fields', async () => {
      const res = await request(app).get('/api/v1/users?fields=id,name');
      expect(res.status).toBe(200);
      for (const user of res.body.data) {
        expect(user.id).toBeDefined();
        expect(user.name).toBeDefined();
        expect(user.email).toBeUndefined();
      }
    });
  });

  describe('Pagination limits', () => {
    it('should reject zero limit', async () => {
      const res = await request(app).get('/api/v1/users?limit=0');
      expect(res.status).toBe(400);
      expect(res.body.error_code).toBe('INVALID_LIMIT');
    });

    it('should reject exceeding max limit', async () => {
      const res = await request(app).get('/api/v1/users?limit=5000');
      expect(res.status).toBe(400);
      expect(res.body.error_code).toBe('MAX_LIMIT_EXCEEDED');
    });
  });
});
