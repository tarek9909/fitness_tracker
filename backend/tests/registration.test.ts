import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../src/app/app.js';
import { runMigrations } from '../src/database/migrate.js';
import { seedDatabase } from '../src/database/seed.js';
import { getDatabasePool, closeDatabasePool, resetDatabasePool } from '../src/database/pool.js';
import { FastifyInstance } from 'fastify';
import { env } from '../src/config/env.js';

const testDbDir = path.resolve(process.cwd(), 'tests', '.tmp');
const testDbPath = path.resolve(testDbDir, `registration_test_${process.pid}_${Date.now()}.db`);

describe('User Registration (SignUp) Integration Suite', () => {
  let app: FastifyInstance;
  const origDbClient = env.dbClient;

  beforeAll(async () => {
    if (!fs.existsSync(testDbDir)) {
      fs.mkdirSync(testDbDir, { recursive: true });
    }
    process.env.DB_CLIENT = 'sqlite';
    process.env.SQLITE_DB_PATH = testDbPath;
    (env as any).dbClient = 'sqlite';
    (env as any).sqliteDbPath = testDbPath;

    resetDatabasePool();
    await runMigrations();
    await seedDatabase();

    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    if (app) await app.close();
    await closeDatabasePool();
    process.env.DB_CLIENT = origDbClient;
    (env as any).dbClient = origDbClient;
    try {
      if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    } catch (_) {}
  });

  it('successfully registers a new user via POST /api/v1/auth/register', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        firstName: 'Alice',
        lastName: 'Walker',
        email: 'alice.walker@example.com',
        password: 'Password123!',
      },
    });

    expect(res.statusCode).toBe(201);
    const json = JSON.parse(res.body);
    expect(json.success).toBe(true);
    expect(json.data.user).toBeDefined();
    expect(json.data.user.id).toBeGreaterThan(0);
    expect(json.data.user.role).toBe('user');
    expect(json.data.user.firstName).toBe('Alice');
    expect(json.data.user.lastName).toBe('Walker');
    expect(json.data.user.email).toBe('alice.walker@example.com');
    expect(json.data.accessToken).toBeDefined();
    expect(json.data.refreshToken).toBeDefined();
    expect(json.data.expiresInSeconds).toBeGreaterThan(0);

    // Verify cookies set
    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
  });

  it('supports full onboarding profile metadata on registration', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        firstName: 'Bob',
        lastName: 'Builder',
        email: 'bob.builder@example.com',
        password: 'StrongPassword123!',
        phone: '+15551234567',
        gender: 'male',
        heightCm: 182,
        timezone: 'America/Chicago',
        locale: 'en',
      },
    });

    expect(res.statusCode).toBe(201);
    const json = JSON.parse(res.body);
    expect(json.success).toBe(true);
    expect(json.data.user.firstName).toBe('Bob');
    expect(json.data.user.timezone).toBe('America/Chicago');
  });

  it('supports the /auth/signup route alias', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: {
        firstName: 'Charlie',
        email: 'charlie.alias@example.com',
        password: 'Password123!',
      },
    });

    expect(res.statusCode).toBe(201);
    const json = JSON.parse(res.body);
    expect(json.success).toBe(true);
    expect(json.data.user.firstName).toBe('Charlie');
  });

  it('rejects duplicate email with 409 Conflict and EMAIL_ALREADY_EXISTS', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        firstName: 'Duplicate',
        email: 'ALICE.WALKER@example.com', // Case insensitive duplicate check
        password: 'DifferentPassword123!',
      },
    });

    expect(res.statusCode).toBe(409);
    const json = JSON.parse(res.body);
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('EMAIL_ALREADY_EXISTS');
  });

  it('rejects password shorter than 8 characters with 400 Bad Request', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        firstName: 'Dave',
        email: 'dave@example.com',
        password: 'short',
      },
    });

    expect(res.statusCode).toBe(400);
    const json = JSON.parse(res.body);
    expect(json.success).toBe(false);
  });

  it('rejects invalid email address with 400 Bad Request', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        firstName: 'Eve',
        email: 'not-an-email',
        password: 'ValidPassword123!',
      },
    });

    expect(res.statusCode).toBe(400);
    const json = JSON.parse(res.body);
    expect(json.success).toBe(false);
  });

  it('rejects missing firstName with 400 Bad Request', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        firstName: '   ',
        email: 'frank@example.com',
        password: 'ValidPassword123!',
      },
    });

    expect(res.statusCode).toBe(400);
    const json = JSON.parse(res.body);
    expect(json.success).toBe(false);
  });

  it('allows newly registered user to immediately access authenticated /me endpoint', async () => {
    const regRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        firstName: 'Grace',
        lastName: 'Hopper',
        email: 'grace.hopper@example.com',
        password: 'CompilerPioneer123!',
        heightCm: 165,
      },
    });

    expect(regRes.statusCode).toBe(201);
    const regJson = JSON.parse(regRes.body);
    const token = regJson.data.accessToken;

    const meRes = await app.inject({
      method: 'GET',
      url: '/api/v1/me',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(meRes.statusCode).toBe(200);
    const meJson = JSON.parse(meRes.body);
    expect(meJson.success).toBe(true);
    expect(meJson.data.email).toBe('grace.hopper@example.com');
    expect(meJson.data.first_name ?? meJson.data.firstName).toBe('Grace');
    expect(meJson.data.last_name ?? meJson.data.lastName).toBe('Hopper');
  });
});
