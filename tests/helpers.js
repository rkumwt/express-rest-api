'use strict';

const path = require('path');
const { PrismaClient } = require('@prisma/client');
const express = require('express');
const { createApiRouter, apiErrorHandler } = require('../src/index');

const dbPath = path.join(__dirname, 'prisma', 'test.db');
const prisma = new PrismaClient({
  datasources: { db: { url: `file:${dbPath}` } },
});

/**
 * Create a test Express app with the given resource registrations.
 * @param {Function} registerFn - (router) => { router.apiResource('users', UserController) }
 * @returns {express.Application}
 */
function createTestApp(registerFn) {
  const app = express();
  app.use(express.json());

  const router = createApiRouter({ prefix: '/api', version: 'v1' });
  registerFn(router);
  app.use(router.getRouter());
  app.use(apiErrorHandler);

  return app;
}

/**
 * Seed the test database with sample data.
 */
async function seed() {
  // Clean up in reverse dependency order
  await prisma.comment.deleteMany();
  await prisma.post.deleteMany();
  await prisma.user.deleteMany();

  // Create users
  const users = [];
  for (let i = 1; i <= 10; i++) {
    const user = await prisma.user.create({
      data: {
        name: `User ${i}`,
        email: `user${i}@example.com`,
        password: 'hashed_password',
        role: i <= 2 ? 'admin' : 'user',
        status: i <= 8 ? 'active' : 'inactive',
      },
    });
    users.push(user);
  }

  // Create posts
  const posts = [];
  for (let i = 0; i < 20; i++) {
    const post = await prisma.post.create({
      data: {
        title: `Post ${i + 1}`,
        body: `Body of post ${i + 1}`,
        published: i < 15,
        userId: users[i % 10].id,
      },
    });
    posts.push(post);
  }

  // Create comments
  for (let i = 0; i < 10; i++) {
    await prisma.comment.create({
      data: {
        body: `Comment ${i + 1}`,
        postId: posts[i % 20].id,
      },
    });
  }

  return { users, posts };
}

/**
 * Clean all tables.
 */
async function cleanDb() {
  await prisma.comment.deleteMany();
  await prisma.post.deleteMany();
  await prisma.user.deleteMany();
}

async function disconnectDb() {
  await prisma.$disconnect();
}

module.exports = { prisma, createTestApp, seed, cleanDb, disconnectDb };
