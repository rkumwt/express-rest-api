# @rkumwt/express-rest-api

REST API package for Express.js. Get full CRUD with filtering, sorting, pagination, and hooks in minutes.

## Quick Start

```bash
npm install @rkumwt/express-rest-api
```

```js
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const {
  ApiController,
  createApiRouter,
  createPrismaAdapter,
  configure,
  apiErrorHandler,
} = require('@rkumwt/express-rest-api');

const prisma = new PrismaClient();
const app = express();
app.use(express.json());

// Define a controller
class UserController extends ApiController {
  adapter = createPrismaAdapter(prisma.user);
  defaultFields = ['id', 'name', 'email', 'role'];
  filterableFields = ['id', 'name', 'email', 'role', 'status'];
  hiddenFields = ['password'];
}

// Register routes
const api = createApiRouter({ prefix: '/api', version: 'v1' });
api.apiResource('users', UserController);
app.use(api.getRouter());
app.use(apiErrorHandler); // Must be last

app.listen(3000);
```

This generates:

| Method | Route | Action |
|--------|-------|--------|
| GET | `/api/v1/users` | List with pagination |
| POST | `/api/v1/users` | Create |
| GET | `/api/v1/users/:id` | Show one |
| PUT | `/api/v1/users/:id` | Update |
| PATCH | `/api/v1/users/:id` | Partial update |
| DELETE | `/api/v1/users/:id` | Delete |

## Query Parameters

### Field Selection

```
GET /api/v1/users?fields=id,name,email
GET /api/v1/users?fields=id,name,posts{id,title}
```

### Filtering

```
GET /api/v1/users?filters=(status eq active)
GET /api/v1/users?filters=(role eq admin and status eq active)
GET /api/v1/users?filters=(role eq admin or role eq editor)
GET /api/v1/users?filters=(name lk john)
GET /api/v1/users?filters=(id gt 5 and id le 20)
```

**Operators**: `eq` (=), `ne` (!=), `gt` (>), `ge` (>=), `lt` (<), `le` (<=), `lk` (LIKE/contains)

### Sorting

```
GET /api/v1/users?order=name asc
GET /api/v1/users?order=name asc, id desc
```

### Pagination

```
GET /api/v1/users?limit=10&offset=20
```

## Response Format

### Collection (GET /api/v1/users)

```json
{
  "data": [
    { "id": 1, "name": "John", "email": "john@example.com" }
  ],
  "meta": {
    "paging": {
      "total": 87,
      "limit": 10,
      "offset": 0,
      "previous": null,
      "next": "/api/v1/users?limit=10&offset=10"
    },
    "timing": "5ms"
  }
}
```

### Single Resource (GET /api/v1/users/1)

```json
{
  "data": { "id": 1, "name": "John", "email": "john@example.com" }
}
```

### Create (POST → 201)

```json
{
  "data": { "id": 42, "name": "New User" },
  "message": "Resource created successfully"
}
```

### Delete (DELETE → 200)

```json
{
  "message": "Resource deleted successfully"
}
```

### Error (404)

```json
{
  "message": "Resource not found",
  "error_code": "RESOURCE_NOT_FOUND",
  "status": 404
}
```

## Controller Configuration

```js
class UserController extends ApiController {
  adapter = createPrismaAdapter(prisma.user);

  // Field selection defaults
  defaultFields = ['id', 'name', 'email', 'role'];

  // Allowed filter fields (null = all allowed)
  filterableFields = ['id', 'name', 'email', 'role', 'status'];

  // Fields stripped from responses
  hiddenFields = ['password', 'rememberToken'];

  // Allowed sort fields (null = all allowed)
  sortableFields = ['id', 'name', 'email', 'createdAt'];

  // Pagination
  defaultLimit = 20;
  maxLimit = 200;

  // Middleware
  middleware = [authMiddleware];             // All actions
  middlewareMap = { destroy: [adminOnly] };  // Per action
}
```

## Lifecycle Hooks

```js
class UserController extends ApiController {
  adapter = createPrismaAdapter(prisma.user);

  // Called before creating a resource
  async beforeStore(data, req) {
    data.password = await bcrypt.hash(data.password, 12);
    return data;
  }

  // Called after creating
  async afterStore(resource, req) {
    await sendWelcomeEmail(resource.email);
  }

  // Called before updating
  async beforeUpdate(data, existing, req) {
    if (data.password) {
      data.password = await bcrypt.hash(data.password, 12);
    }
    return data;
  }

  async afterUpdate(resource, req) { }

  // Called before/after deleting
  async beforeDestroy(resource, req) {
    if (resource.role === 'admin') {
      throw new ForbiddenException('Cannot delete admin users');
    }
  }

  async afterDestroy(resource, req) { }
}
```

## Query Modification Hooks

Modify the database query before execution:

```js
class UserController extends ApiController {
  adapter = createPrismaAdapter(prisma.user);

  // Add filter to every index query
  modifyIndex(queryOptions, req) {
    queryOptions.filters = queryOptions.filters || [];
    queryOptions.filters.push({
      field: 'status', operator: '=', value: 'active', conjunction: 'AND'
    });
    return queryOptions;
  }

  // Scope show to current user
  modifyShow(queryOptions, req) {
    return queryOptions;
  }
}
```

## Validation

Supports Zod, Joi, or custom functions. Auto-detected at runtime.

### With Zod

```js
const { z } = require('zod');

class UserController extends ApiController {
  adapter = createPrismaAdapter(prisma.user);

  storeSchema = z.object({
    name: z.string().min(1).max(255),
    email: z.string().email(),
    password: z.string().min(8),
  });

  updateSchema = z.object({
    name: z.string().min(1).max(255).optional(),
    email: z.string().email().optional(),
  });
}
```

### With Custom Function

```js
class UserController extends ApiController {
  adapter = createPrismaAdapter(prisma.user);

  storeSchema = async (data) => {
    const errors = {};
    if (!data.name) errors.name = ['Name is required'];
    if (!data.email) errors.email = ['Email is required'];
    if (Object.keys(errors).length > 0) {
      return { valid: false, errors };
    }
    return { valid: true, data };
  };
}
```

Validation errors return 422:

```json
{
  "message": "Validation failed",
  "error_code": "VALIDATION_ERROR",
  "status": 422,
  "errors": {
    "email": ["Invalid email format"],
    "password": ["String must contain at least 8 character(s)"]
  }
}
```

## Router Options

```js
const api = createApiRouter({
  prefix: '/api',
  version: 'v1',
  middleware: [corsMiddleware],
});

// All 5 CRUD routes
api.apiResource('users', UserController);

// Read-only (index + show)
api.apiResource('posts', PostController, { only: ['index', 'show'] });

// All except delete
api.apiResource('comments', CommentController, { except: ['destroy'] });

// Per-action middleware
api.apiResource('articles', ArticleController, {
  middleware: { destroy: [adminOnly] }
});

app.use(api.getRouter());
```

## Global Configuration

```js
const { configure } = require('@rkumwt/express-rest-api');

configure({
  pagination: {
    defaultLimit: 20,    // default: 10
    maxLimit: 500,       // default: 1000
  },
  response: {
    envelope: true,      // wrap in { data, meta, message }
    timing: true,        // include timing in meta
  },
  messages: {
    created: 'Resource created successfully',
    updated: 'Resource updated successfully',
    deleted: 'Resource deleted successfully',
  },
  debug: process.env.NODE_ENV !== 'production',
});
```

## Exceptions

Throw these in hooks or middleware for structured error responses:

```js
const {
  NotFoundException,       // 404
  ValidationException,     // 422
  UnauthorizedException,   // 401
  ForbiddenException,      // 403
} = require('@rkumwt/express-rest-api');

// In a hook
async beforeUpdate(data, existing, req) {
  if (existing.userId !== req.user.id) {
    throw new ForbiddenException('You can only edit your own resources');
  }
  return data;
}
```

## Requirements

- Node.js >= 18
- Express 4.18+ or 5.x
- Prisma (for `createPrismaAdapter`)

## License

MIT
