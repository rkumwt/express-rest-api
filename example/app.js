'use strict';

const express = require('express');
const { PrismaClient } = require('@prisma/client');
const {
  ApiController,
  createApiRouter,
  createPrismaAdapter,
  configure,
  apiErrorHandler,
} = require('../src/index');

const prisma = new PrismaClient();
const app = express();

app.use(express.json());

// ── Global Configuration ──────────────────────────────
configure({
  pagination: { defaultLimit: 20, maxLimit: 200 },
  debug: true,
});

// ── Controllers ───────────────────────────────────────

class UserController extends ApiController {
  adapter = createPrismaAdapter(prisma.user);
  defaultFields = ['id', 'name', 'email', 'role', 'status', 'createdAt'];
  filterableFields = ['id', 'name', 'email', 'role', 'status'];
  hiddenFields = ['password'];
  sortableFields = ['id', 'name', 'email', 'createdAt'];
  defaultLimit = 20;

  // Hook: set default status on create
  async beforeStore(data, req) {
    data.status = data.status || 'active';
    return data;
  }

  // Hook: only show active users by default
  modifyIndex(queryOptions, req) {
    // If ?show_all=true, skip the active filter
    if (req.query.show_all === 'true') return queryOptions;

    queryOptions.filters = queryOptions.filters || [];
    queryOptions.filters.push({ field: 'status', operator: '=', value: 'active', conjunction: 'AND' });
    return queryOptions;
  }
}

class PostController extends ApiController {
  adapter = createPrismaAdapter(prisma.post);
  defaultFields = ['id', 'title', 'published', 'userId', 'createdAt'];
  filterableFields = ['id', 'title', 'published', 'userId'];
  sortableFields = ['id', 'title', 'createdAt'];
}

// ── Routes ────────────────────────────────────────────

const api = createApiRouter({ prefix: '/api', version: 'v1' });
api.apiResource('users', UserController);
api.apiResource('posts', PostController);

app.use(api.getRouter());

// Must be LAST middleware
app.use(apiErrorHandler);

// ── Start ─────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n  express-rest-api example server`);
  console.log(`  ───────────────────────────────`);
  console.log(`  URL: http://localhost:${PORT}`);
  console.log(`\n  Routes:`);
  console.log(`  GET/POST      /api/v1/users`);
  console.log(`  GET/PUT/DELETE /api/v1/users/:id`);
  console.log(`  GET/POST      /api/v1/posts`);
  console.log(`  GET/PUT/DELETE /api/v1/posts/:id`);
  console.log(`\n  Try:`);
  console.log(`  curl http://localhost:${PORT}/api/v1/users`);
  console.log(`  curl http://localhost:${PORT}/api/v1/users?fields=id,name&limit=5`);
  console.log(`  curl http://localhost:${PORT}/api/v1/users?filters=(role eq admin)`);
  console.log(`  curl http://localhost:${PORT}/api/v1/users?order=name desc`);
  console.log('');
});
