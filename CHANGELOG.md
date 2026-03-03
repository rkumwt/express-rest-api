# Changelog

## [1.0.0] - 2026-03-03

### Added
- `ApiController` base class with CRUD operations (index, show, store, update, destroy)
- Lifecycle hooks: `beforeStore`, `afterStore`, `beforeUpdate`, `afterUpdate`, `beforeDestroy`, `afterDestroy`
- Query modification hooks: `modifyIndex`, `modifyShow`, `modifyUpdate`, `modifyDelete`
- `RequestParser` with examyou/rest-api compatible query format
  - Field selection: `?fields=id,name,posts{id,title}`
  - Filtering: `?filters=(status eq active and role ne admin)`
  - Sorting: `?order=name asc, id desc`
  - Pagination: `?limit=10&offset=20`
- `ApiResponse` with standardized envelope format (`{ data, meta, message }`)
- `createApiRouter()` with `apiResource()` route helper
- `createPrismaAdapter()` for Prisma ORM support
- `apiErrorHandler` middleware for structured error responses
- Auto-detect validation for Zod, Joi, and custom functions
- `configure()` for global configuration
- Exception hierarchy: `ApiException`, `NotFoundException`, `ValidationException`, `UnauthorizedException`, `ForbiddenException`, and parse exceptions
- Hidden field stripping
- Pagination metadata with next/previous links
