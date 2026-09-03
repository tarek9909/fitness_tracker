import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../src/app/app.js';
import { runMigrations } from '../src/database/migrate.js';
import { seedDatabase } from '../src/database/seed.js';
import { getDatabasePool, closeDatabasePool, resetDatabasePool } from '../src/database/pool.js';
import { testResetTokenStore } from '../src/modules/auth/auth.service.js';
import { testSentEmails } from '../src/shared/services/email.service.js';
import { ReminderWorker } from '../src/workers/reminder.worker.js';
import { FastifyInstance } from 'fastify';
import { env } from '../src/config/env.js';

const testDbDir = path.resolve(process.cwd(), 'tests', '.tmp');
const testDbPath = path.resolve(testDbDir, `fitness_test_${process.pid}_${Date.now()}.db`);

describe('Fitness Platform REST API Suite', () => {
  let app: FastifyInstance;
  let adminToken: string;
  let userToken: string;
  let userRefreshToken: string;
  let previousUserRefreshToken: string;
  let janeToken: string;
  let waterIdempotencyKey: string;

  beforeAll(async () => {
    // 1. Ensure test isolated directory exists
    if (!fs.existsSync(testDbDir)) {
      fs.mkdirSync(testDbDir, { recursive: true });
    }

    // 2. Point SQLite engine to the isolated temporary test database
    process.env.SQLITE_DB_PATH = testDbPath;
    env.sqliteDbPath = testDbPath;
    resetDatabasePool();

    // 3. Migrate and seed the dedicated test database
    await runMigrations();
    await seedDatabase();

    const bcryptModule = await import('bcryptjs');
    const bcrypt = bcryptModule.default || bcryptModule;
    const userHash = await bcrypt.hash('User123!', 10);
    const db = getDatabasePool();
    await db.execute('UPDATE users SET password_hash = ? WHERE email = ?', [userHash, 'john.doe@fitnessplatform.com']);

    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    await closeDatabasePool();

    // Clean up temporary database files
    try {
      const filesToDelete = [
        testDbPath,
        `${testDbPath}-wal`,
        `${testDbPath}-shm`,
      ];
      for (const file of filesToDelete) {
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
        }
      }
      if (fs.existsSync(testDbDir) && fs.readdirSync(testDbDir).length === 0) {
        fs.rmdirSync(testDbDir);
      }
    } catch {
      // Best-effort cleanup
    }
  });

  describe('1. System Health, Liveness & Readiness', () => {
    it('GET /api/v1/health should return ok and db connected', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/health',
      });
      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.success).toBe(true);
      expect(json.data.status).toBe('ok');
      expect(json.data.database).toBe('connected');
    });

    it('GET /api/v1/health/live should return liveness status and process uptime', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/health/live',
      });
      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.success).toBe(true);
      expect(json.data.status).toBe('alive');
      expect(json.data.uptimeSeconds).toBeGreaterThanOrEqual(0);
    });

    it('GET /api/v1/health/ready should return ready when database pool is active', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/health/ready',
      });
      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.success).toBe(true);
      expect(json.data.status).toBe('ready');
      expect(json.data.database).toBe('connected');
    });

    it('GET /api/v1/auth/csrf should issue a token for cross-origin web clients', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/csrf',
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().data.csrfToken).toMatch(/^[a-f0-9]{64}$/);
      expect(res.headers['set-cookie']).toBeDefined();
    });

    it('should reject request payloads exceeding bodyLimit with 413 Payload Too Large', async () => {
      const oversizedPayload = JSON.stringify({ data: 'x'.repeat(1048576 + 512) });
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        headers: { 'content-type': 'application/json' },
        payload: oversizedPayload,
      });
      expect(res.statusCode).toBe(413);
      const json = res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('FST_ERR_CTP_BODY_TOO_LARGE');
    });

    it('should enforce rate limiting while preserving health probe exemptions', async () => {
      const rateLimitedApp = await buildApp({ rateLimitMax: 2 });
      await rateLimitedApp.ready();
      try {
        // 1. Health probe is exempt from rate limiting
        for (let i = 0; i < 5; i++) {
          const healthRes = await rateLimitedApp.inject({
            method: 'GET',
            url: '/api/v1/health/live',
          });
          expect(healthRes.statusCode).toBe(200);
        }

        // 2. Non-exempt route counts toward rate limit (max: 2)
        const req1 = await rateLimitedApp.inject({
          method: 'POST',
          url: '/api/v1/auth/login',
          payload: { email: 'admin@fitnessplatform.com', password: 'WrongPassword123!' },
        });
        expect(req1.statusCode).toBe(401);

        const req2 = await rateLimitedApp.inject({
          method: 'POST',
          url: '/api/v1/auth/login',
          payload: { email: 'admin@fitnessplatform.com', password: 'WrongPassword123!' },
        });
        expect(req2.statusCode).toBe(401);

        // 3. 3rd request exceeds limit of 2 and returns 429
        const req3 = await rateLimitedApp.inject({
          method: 'POST',
          url: '/api/v1/auth/login',
          payload: { email: 'admin@fitnessplatform.com', password: 'WrongPassword123!' },
        });
        expect(req3.statusCode).toBe(429);
        const json = req3.json();
        expect(json.success).toBe(false);
        expect(json.error.code).toBe('RATE_LIMIT_EXCEEDED');
        expect(json.error.message).toContain('Rate limit exceeded');
      } finally {
        await rateLimitedApp.close();
      }
    });
  });

  describe('2. Authentication Module & Token Lifecycle', () => {
    it('POST /api/v1/auth/login with wrong credentials should fail', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'admin@fitnessplatform.com',
          password: 'WrongPassword!',
        },
      });
      expect(res.statusCode).toBe(401);
      const json = res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('POST /api/v1/auth/login with admin credentials should succeed', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'admin@fitnessplatform.com',
          password: 'Admin123!',
          deviceName: 'Admin Dashboard Web',
        },
      });
      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.success).toBe(true);
      expect(json.data.accessToken).toBeDefined();
      expect(json.data.user.role).toBe('super_admin');
      adminToken = json.data.accessToken;
    });

    it('POST /api/v1/auth/login with regular user credentials should succeed', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'john.doe@fitnessplatform.com',
          password: 'User123!',
          deviceName: 'Flutter Mobile Pixel 8',
        },
      });
      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.success).toBe(true);
      expect(json.data.accessToken).toBeDefined();
      expect(json.data.user.role).toBe('user');
      userToken = json.data.accessToken;
      userRefreshToken = json.data.refreshToken;
      previousUserRefreshToken = userRefreshToken;
    });

    it('POST /api/v1/auth/refresh should rotate refresh token and provide new access token', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        payload: {
          refreshToken: userRefreshToken,
        },
      });
      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.success).toBe(true);
      expect(json.data.accessToken).toBeDefined();
      expect(json.data.refreshToken).toBeDefined();
      expect(json.data.refreshToken).not.toBe(userRefreshToken);
      // Update tokens for subsequent tests
      userToken = json.data.accessToken;
      userRefreshToken = json.data.refreshToken;
    });

    it('Concurrent refresh requests with same token: exactly one succeeds, others rejected with 401', async () => {
      const tokenToRace = userRefreshToken;
      const [res1, res2] = await Promise.all([
        app.inject({
          method: 'POST',
          url: '/api/v1/auth/refresh',
          payload: { refreshToken: tokenToRace },
        }),
        app.inject({
          method: 'POST',
          url: '/api/v1/auth/refresh',
          payload: { refreshToken: tokenToRace },
        }),
      ]);

      const statusCodes = [res1.statusCode, res2.statusCode].sort();
      expect(statusCodes).toEqual([200, 401]);

      const successRes = res1.statusCode === 200 ? res1 : res2;
      const failRes = res1.statusCode === 401 ? res1 : res2;

      expect(successRes.json().success).toBe(true);
      expect(failRes.json().error.code).toBe('REFRESH_TOKEN_INVALID');

      // Update active tokens
      userToken = successRes.json().data.accessToken;
      userRefreshToken = successRes.json().data.refreshToken;
    });

    it('Reusing an already-rotated refresh token must fail (401 REFRESH_TOKEN_INVALID)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        payload: {
          refreshToken: previousUserRefreshToken,
        },
      });
      expect(res.statusCode).toBe(401);
      expect(res.json().error.code).toBe('REFRESH_TOKEN_INVALID');
    });

    it('Password reset workflow: request, reset with token, and login with new password', async () => {
      // 1. Request reset
      const reqRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/request-password-reset',
        payload: { email: 'john.doe@fitnessplatform.com' },
      });
      expect(reqRes.statusCode).toBe(202);
      expect(reqRes.json().success).toBe(true);

      const resetToken = testResetTokenStore.get('john.doe@fitnessplatform.com');
      expect(resetToken).toBeDefined();

      // Verify email was dispatched to mock store with template
      const sentEmail = testSentEmails.find(e => e.to === 'john.doe@fitnessplatform.com');
      expect(sentEmail).toBeDefined();
      expect(sentEmail?.subject).toContain('Password Reset');
      expect(sentEmail?.html).toContain(resetToken);

      // 2. Perform reset
      const resetRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/reset-password',
        payload: {
          token: resetToken,
          password: 'NewUserPassword123!',
        },
      });
      expect(resetRes.statusCode).toBe(200);
      expect(resetRes.json().success).toBe(true);

      // 3. Replay reset token must fail
      const replayReset = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/reset-password',
        payload: {
          token: resetToken,
          password: 'AnotherPassword123!',
        },
      });
      expect(replayReset.statusCode).toBe(401);
      expect(replayReset.json().error.code).toBe('PASSWORD_RESET_INVALID');

      // 4. Login with updated password and verify HttpOnly cookies
      const newLogin = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'john.doe@fitnessplatform.com',
          password: 'NewUserPassword123!',
        },
      });
      expect(newLogin.statusCode).toBe(200);
      expect(newLogin.headers['set-cookie']).toBeDefined();
      userToken = newLogin.json().data.accessToken;
      userRefreshToken = newLogin.json().data.refreshToken;
    });

    it('Cookie-based authentication: GET /api/v1/me with access_token cookie succeeds', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/me',
        cookies: {
          access_token: userToken,
        },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);
      expect(res.json().data.email).toBe('john.doe@fitnessplatform.com');
    });

    it('Web dashboard auth flow: clientType="web" suppresses token strings in JSON payload and relies on HttpOnly cookies', async () => {
      const webLogin = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'john.doe@fitnessplatform.com',
          password: 'NewUserPassword123!',
          clientType: 'web',
        },
      });
      expect(webLogin.statusCode).toBe(200);
      const json = webLogin.json();
      expect(json.success).toBe(true);
      expect(json.data.user).toBeDefined();
      expect(json.data.accessToken).toBeUndefined(); // Token suppressed from browser JS response payload
      expect(json.data.refreshToken).toBeUndefined(); // Token suppressed from browser JS response payload
      expect(webLogin.headers['set-cookie']).toBeDefined();
      const csrfToken = json.data.csrfToken;
      expect(csrfToken).toBeDefined();

      // Web refresh flow suppresses tokens as well
      const setCookies = Array.isArray(webLogin.headers['set-cookie'])
        ? webLogin.headers['set-cookie']
        : [webLogin.headers['set-cookie'] as string];
      const webRefreshToken = setCookies.find(c => c?.startsWith('refresh_token='))?.split(';')[0]?.replace('refresh_token=', '') || userRefreshToken;

      const webRefresh = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        payload: { clientType: 'web' },
        headers: {
          'x-csrf-token': csrfToken,
        },
        cookies: {
          refresh_token: webRefreshToken,
          csrf_token: csrfToken,
        },
      });
      expect(webRefresh.statusCode).toBe(200);
      const refreshJson = webRefresh.json();
      expect(refreshJson.success).toBe(true);
      expect(refreshJson.data.accessToken).toBeUndefined(); // Token suppressed from browser JS response payload
      expect(refreshJson.data.refreshToken).toBeUndefined(); // Token suppressed from browser JS response payload
      expect(refreshJson.data.csrfToken).toBeDefined();
      expect(webRefresh.headers['set-cookie']).toBeDefined();

      const refreshCookies = Array.isArray(webRefresh.headers['set-cookie'])
        ? webRefresh.headers['set-cookie']
        : [webRefresh.headers['set-cookie'] as string];
      const webRotatedRefreshToken = refreshCookies.find(c => c?.startsWith('refresh_token='))?.split(';')[0]?.replace('refresh_token=', '') || webRefreshToken;

      // Cookie logout clears all cookies
      const webLogout = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/logout',
        headers: {
          'x-csrf-token': refreshJson.data.csrfToken,
        },
        cookies: {
          refresh_token: webRotatedRefreshToken,
          csrf_token: refreshJson.data.csrfToken,
        },
      });
      expect(webLogout.statusCode).toBe(200);
      expect(webLogout.headers['set-cookie']).toBeDefined();

      // Ensure active mobile userToken is freshly authenticated for downstream tests
      const mobileRelogin = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'john.doe@fitnessplatform.com',
          password: 'NewUserPassword123!',
          deviceName: 'Flutter Mobile Pixel 8',
        },
      });
      expect(mobileRelogin.statusCode).toBe(200);
      userToken = mobileRelogin.json().data.accessToken;
      userRefreshToken = mobileRelogin.json().data.refreshToken;
    });

    it('CSRF Protection: Cookie-authenticated mutating requests must provide matching X-CSRF-Token header', async () => {
      // 1. Missing CSRF header rejected with 403
      const missingCsrf = await app.inject({
        method: 'POST',
        url: '/api/v1/me/water',
        payload: { amountMl: 250 },
        cookies: {
          access_token: userToken,
          csrf_token: 'valid-csrf-token-12345',
        },
      });
      expect(missingCsrf.statusCode).toBe(403);
      expect(missingCsrf.json().error.code).toBe('CSRF_TOKEN_MISSING');

      // 2. Mismatched CSRF header rejected with 403
      const invalidCsrf = await app.inject({
        method: 'POST',
        url: '/api/v1/me/water',
        payload: { amountMl: 250 },
        headers: {
          'x-csrf-token': 'wrong-token',
        },
        cookies: {
          access_token: userToken,
          csrf_token: 'valid-csrf-token-12345',
        },
      });
      expect(invalidCsrf.statusCode).toBe(403);
      expect(invalidCsrf.json().error.code).toBe('CSRF_TOKEN_INVALID');

      // 3. Valid CSRF header succeeds
      const validCsrf = await app.inject({
        method: 'POST',
        url: '/api/v1/me/water',
        payload: { amountMl: 250 },
        headers: {
          'x-csrf-token': 'valid-csrf-token-12345',
          'idempotency-key': 'csrf-test-water-1',
        },
        cookies: {
          access_token: userToken,
          csrf_token: 'valid-csrf-token-12345',
        },
      });
      expect(validCsrf.statusCode).toBe(201);
      expect(validCsrf.json().success).toBe(true);
    });

    it('Password reset error handling: failure in email delivery rolls back and removes created reset token', async () => {
      const db = getDatabasePool();
      // Count existing tokens
      const beforeCount = await db.queryOne<{ cnt: number }>('SELECT COUNT(*) as cnt FROM password_reset_tokens');
      
      // Temporarily mock emailService to throw
      const { emailService } = await import('../src/shared/services/email.service.js');
      const originalSend = emailService.sendPasswordResetEmail;
      emailService.sendPasswordResetEmail = async () => {
        throw new Error('SMTP Connection Timeout');
      };

      try {
        const { AuthService } = await import('../src/modules/auth/auth.service.js');
        const authService = new AuthService();
        await expect(authService.requestPasswordReset('john.doe@fitnessplatform.com')).rejects.toThrow('SMTP Connection Timeout');
        
        // Ensure no leftover token exists in DB
        const afterCount = await db.queryOne<{ cnt: number }>('SELECT COUNT(*) as cnt FROM password_reset_tokens');
        expect(afterCount?.cnt).toBe(beforeCount?.cnt);
      } finally {
        emailService.sendPasswordResetEmail = originalSend;
      }
    });

    it('POST /api/v1/auth/forgot-password (alias) requests password reset token', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/forgot-password',
        payload: { email: 'john.doe@fitnessplatform.com' },
      });
      expect(res.statusCode).toBe(202);
      expect(res.json().success).toBe(true);
    });
  });

  describe('3. Users, Authorization & Status Re-Check', () => {
    it('GET /api/v1/me should return authenticated user profile', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/me',
        headers: { authorization: `Bearer ${userToken}` },
      });
      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.success).toBe(true);
      expect(json.data.email).toBe('john.doe@fitnessplatform.com');
      expect(json.data.first_name).toBe('John');
    });

    it('Regular user accessing /admin/users should be rejected (403 Forbidden)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/users',
        headers: { authorization: `Bearer ${userToken}` },
      });
      expect(res.statusCode).toBe(403);
    });

    it('Admin can create a second user (Jane Doe)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/users',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          firstName: 'Jane',
          lastName: 'Doe',
          email: 'jane.doe@fitnessplatform.com',
          password: 'JanePassword123!',
          timezone: 'America/New_York',
        },
      });
      expect(res.statusCode).toBe(201);
      const json = res.json();
      expect(json.data.email).toBe('jane.doe@fitnessplatform.com');

      // Obtain Jane's JWT
      const loginJane = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'jane.doe@fitnessplatform.com',
          password: 'JanePassword123!',
        },
      });
      expect(loginJane.statusCode).toBe(200);
      janeToken = loginJane.json().data.accessToken;
    });

    it('Disabling a user account immediately revokes access for valid JWTs (403 ACCOUNT_DISABLED)', async () => {
      // 1. Admin disables John Doe (User ID 2)
      const disableRes = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/users/2/disable',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(disableRes.statusCode).toBe(200);

      // 2. John Doe makes request with previously valid JWT -> Rejected immediately
      const meRes = await app.inject({
        method: 'GET',
        url: '/api/v1/me',
        headers: { authorization: `Bearer ${userToken}` },
      });
      expect(meRes.statusCode).toBe(403);
      expect(meRes.json().error.code).toBe('ACCOUNT_DISABLED');

      // 3. Admin re-enables John Doe
      const enableRes = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/users/2/enable',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(enableRes.statusCode).toBe(200);

      // 4. John Doe can access /me again
      const restoreRes = await app.inject({
        method: 'GET',
        url: '/api/v1/me',
        headers: { authorization: `Bearer ${userToken}` },
      });
      expect(restoreRes.statusCode).toBe(200);
    });
  });

  describe('4. Exercise Library Module', () => {
    it('GET /api/v1/admin/exercises should support search and categorization', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/exercises?search=Squat',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.success).toBe(true);
      expect(json.data.some((e: any) => e.name.includes('Squat'))).toBe(true);
    });

    it('POST /api/v1/admin/exercises should create a new exercise', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/exercises',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          name: 'Hammer Strength Incline Chest Press',
          primaryMuscleGroupId: 1,
          equipmentTypeId: 4,
          trackingType: 'weight_reps',
          instructions: 'Adjust seat height so handles align with mid-to-upper chest.',
        },
      });
      expect(res.statusCode).toBe(201);
      const json = res.json();
      expect(json.data.name).toBe('Hammer Strength Incline Chest Press');
    });
  });

  describe('5. Workout & Diet Plans Immutability & Overlap Rules', () => {
    it('Published workout version cannot be edited (PLAN_VERSION_IMMUTABLE)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/workout-versions/1/days',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          weekdayNumber: 1,
          name: 'Should not allow adding day to published version',
        },
      });
      expect(res.statusCode).toBe(409);
      expect(res.json().error.code).toBe('PLAN_VERSION_IMMUTABLE');
    });

    it('Published diet version cannot be edited (PLAN_VERSION_IMMUTABLE)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/diet-versions/1/meals',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          name: 'Late Night Snack',
          scheduledTime: '22:00',
        },
      });
      expect(res.statusCode).toBe(409);
      expect(res.json().error.code).toBe('PLAN_VERSION_IMMUTABLE');
    });

    let draftWorkoutVerId: number;
    let draftDietVerId: number;

    it('Admin can create a new version draft cloned from version 1', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/workout-plans/1/versions',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          fromVersionId: 1,
        },
      });
      expect(res.statusCode).toBe(201);
      const json = res.json();
      expect(json.data.version_number).toBe(2);
      expect(json.data.status).toBe('draft');
      expect(json.data.days.length).toBe(7);
      draftWorkoutVerId = json.data.id;
    });

    it('Assigning a draft workout version to a user must be rejected (PLAN_VERSION_NOT_PUBLISHED)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/users/2/workout-assignments',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          workoutPlanVersionId: draftWorkoutVerId,
          effectiveFrom: '2026-09-01',
        },
      });
      expect(res.statusCode).toBe(409);
      expect(res.json().error.code).toBe('PLAN_VERSION_NOT_PUBLISHED');
    });

    it('Admin can create a new diet version draft cloned from version 1', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/diet-plans/1/versions',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          fromVersionId: 1,
        },
      });
      expect(res.statusCode).toBe(201);
      const json = res.json();
      expect(json.data.version_number).toBe(2);
      expect(json.data.status).toBe('draft');
      expect(json.data.meals.length).toBeGreaterThanOrEqual(1);
      draftDietVerId = json.data.id;
    });

    it('Assigning a draft diet version to a user must be rejected (PLAN_VERSION_NOT_PUBLISHED)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/users/2/diet-assignments',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          dietPlanVersionId: draftDietVerId,
          effectiveFrom: '2026-09-01',
        },
      });
      expect(res.statusCode).toBe(409);
      expect(res.json().error.code).toBe('PLAN_VERSION_NOT_PUBLISHED');
    });

    it('Overlapping active plan assignment date ranges must be rejected (409 ASSIGNMENT_OVERLAP)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/users/2/workout-assignments',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          workoutPlanVersionId: 1,
          effectiveFrom: '2026-01-01',
        },
      });
      expect(res.statusCode).toBe(409);
      expect(res.json().error.code).toBe('ASSIGNMENT_OVERLAP');
    });
  });

  describe('6. Daily Plan Engine (/me/today)', () => {
    it('GET /api/v1/me/today should resolve agenda, workout, meals, targets, and tasks', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/me/today',
        headers: { authorization: `Bearer ${userToken}` },
      });
      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.success).toBe(true);
      expect(json.data.date).toBeDefined();
      expect(json.data.weight).toBeDefined();
      expect(json.data.water).toBeDefined();
      expect(json.data.diet).toBeDefined();
      expect(json.data.tasks.length).toBeGreaterThanOrEqual(1);
    });

    it('GET /api/v1/me/today accurately resolves nested diet meals, option groups, options, and per-meal log status', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/me/today',
        headers: { authorization: `Bearer ${userToken}` },
      });
      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.success).toBe(true);

      const meals = json.data.diet?.meals;
      expect(Array.isArray(meals)).toBe(true);
      expect(meals.length).toBeGreaterThanOrEqual(1);

      // Verify nested meal structure, ordering, and option group options
      for (const meal of meals) {
        expect(meal.id).toBeDefined();
        expect(meal.name).toBeDefined();
        expect(meal.order_index).toBeDefined();
        expect(Array.isArray(meal.optionGroups)).toBe(true);

        for (const group of meal.optionGroups) {
          expect(group.id).toBeDefined();
          expect(group.name).toBeDefined();
          expect(group.order_index).toBeDefined();
          expect(Array.isArray(group.options)).toBe(true);

          for (const opt of group.options) {
            expect(opt.id).toBeDefined();
            expect(opt.food_name).toBeDefined();
            expect(opt.calories).toBeDefined();
            expect(opt.protein_g).toBeDefined();
            expect(opt.carbs_g).toBeDefined();
            expect(opt.fat_g).toBeDefined();
          }
        }
      }
    });

    it('GET /api/v1/me/today handles users with no active diet assignment gracefully (empty meals array)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/me/today',
        headers: { authorization: `Bearer ${janeToken}` },
      });
      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.success).toBe(true);
      expect(json.data.diet).toEqual({ meals: [] });
    });
  });

  describe('7. Daily Tracking, User Isolation & Idempotency', () => {
    let createdSessionId: number;

    it('POST /api/v1/me/weight should log body weight and update rolling average', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/me/weight',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          weightKg: 82.5,
          notes: 'Morning weigh in fasted',
        },
      });
      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.data.weightKg).toBe(82.5);
      expect(json.data.rollingAverageKg).toBeDefined();
    });

    it('PUT /api/v1/me/weight should update/upsert body weight entry', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/v1/me/weight',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          weightKg: 82.2,
          notes: 'Updated weigh in',
        },
      });
      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.data.weightKg).toBe(82.2);
    });

    it('POST /api/v1/me/water with Idempotency-Key should log water and deduplicate retries', async () => {
      waterIdempotencyKey = `water-op-${Date.now()}`;
      const firstRes = await app.inject({
        method: 'POST',
        url: '/api/v1/me/water',
        headers: {
          authorization: `Bearer ${userToken}`,
          'Idempotency-Key': waterIdempotencyKey,
        },
        payload: { amountMl: 500 },
      });
      expect(firstRes.statusCode).toBe(201);
      const initialTotal = firstRes.json().data.dailyTotalMl;

      // Replaying identical request returns cached 201 without incrementing total
      const replayRes = await app.inject({
        method: 'POST',
        url: '/api/v1/me/water',
        headers: {
          authorization: `Bearer ${userToken}`,
          'Idempotency-Key': waterIdempotencyKey,
        },
        payload: { amountMl: 500 },
      });
      expect(replayRes.statusCode).toBe(201);
      expect(replayRes.json().data.dailyTotalMl).toBe(initialTotal);

      // Replaying with different payload returns 409 IDEMPOTENCY_KEY_REUSED
      const changedPayload = await app.inject({
        method: 'POST',
        url: '/api/v1/me/water',
        headers: {
          authorization: `Bearer ${userToken}`,
          'Idempotency-Key': waterIdempotencyKey,
        },
        payload: { amountMl: 112 },
      });
      expect(changedPayload.statusCode).toBe(409);
      expect(changedPayload.json().error.code).toBe('IDEMPOTENCY_KEY_REUSED');
    });

    it('GET /api/v1/me/water/history should return historical daily intake list and reject malformed limit', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/me/water/history',
        headers: { authorization: `Bearer ${userToken}` },
      });
      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
      expect(json.data.length).toBeGreaterThanOrEqual(1);
      const first = json.data[0];
      expect(first.intake_date).toBeDefined();
      expect(first.total_ml).toBeGreaterThanOrEqual(500);
      expect(first.amount_ml).toBeGreaterThanOrEqual(500);
      expect(first.entry_count).toBeGreaterThanOrEqual(1);

      // Regression check: malformed limit returns 400 VALIDATION_ERROR instead of 500
      const badLimitRes = await app.inject({
        method: 'GET',
        url: '/api/v1/me/water/history?limit=abc',
        headers: { authorization: `Bearer ${userToken}` },
      });
      expect(badLimitRes.statusCode).toBe(400);
      expect(badLimitRes.json().error.code).toBe('VALIDATION_ERROR');

      // Regression check: malformed delete entryId returns 400 VALIDATION_ERROR
      const badDeleteRes = await app.inject({
        method: 'DELETE',
        url: '/api/v1/me/water/abc',
        headers: { authorization: `Bearer ${userToken}` },
      });
      expect(badDeleteRes.statusCode).toBe(400);
      expect(badDeleteRes.json().error.code).toBe('VALIDATION_ERROR');

      // Regression check: malformed intakeDate returns 400 VALIDATION_ERROR
      const badLogDateRes = await app.inject({
        method: 'POST',
        url: '/api/v1/me/water',
        headers: { authorization: `Bearer ${userToken}` },
        payload: { amountMl: 250, intakeDate: 'invalid-date' },
      });
      expect(badLogDateRes.statusCode).toBe(400);
      expect(badLogDateRes.json().error.code).toBe('VALIDATION_ERROR');

      // Regression check: malformed date query on meals returns 400 VALIDATION_ERROR
      const badMealDateRes = await app.inject({
        method: 'GET',
        url: '/api/v1/me/meals/today?date=not-a-date',
        headers: { authorization: `Bearer ${userToken}` },
      });
      expect(badMealDateRes.statusCode).toBe(400);
      expect(badMealDateRes.json().error.code).toBe('VALIDATION_ERROR');

      // Regression check: malformed date path on /me/days/:date returns 400 VALIDATION_ERROR
      const badDayDateRes = await app.inject({
        method: 'GET',
        url: '/api/v1/me/days/not-a-date',
        headers: { authorization: `Bearer ${userToken}` },
      });
      expect(badDayDateRes.statusCode).toBe(400);
      expect(badDayDateRes.json().error.code).toBe('VALIDATION_ERROR');
    });

    it('PUT /api/v1/me/meals/1/log should log breakfast with selected food choices', async () => {
      // Regression check: malformed mealId in path returns 400 VALIDATION_ERROR
      const badMealIdRes = await app.inject({
        method: 'PUT',
        url: '/api/v1/me/meals/abc/log',
        headers: { authorization: `Bearer ${userToken}` },
        payload: { status: 'completed' },
      });
      expect(badMealIdRes.statusCode).toBe(400);
      expect(badMealIdRes.json().error.code).toBe('VALIDATION_ERROR');

      const res = await app.inject({
        method: 'PUT',
        url: '/api/v1/me/meals/1/log',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          status: 'completed',
          selections: [
            { optionGroupId: 1, optionId: 1 },
            { optionGroupId: 2, optionId: 3 },
          ],
          notes: 'Scrambled eggs and oatmeal with cinnamon',
        },
      });
      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.success).toBe(true);
      expect(json.data.status).toBe('completed');
    });

    it('PUT /api/v1/me/meals/1/log should reject options from another meal group', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/v1/me/meals/1/log',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          status: 'completed',
          selections: [{ optionGroupId: 1, optionId: 3 }],
        },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe('VALIDATION_ERROR');
    });

    it('POST /api/v1/me/workouts/start and log sets should manage live workout session', async () => {
      const startRes = await app.inject({
        method: 'POST',
        url: '/api/v1/me/workouts/start',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          workoutPlanDayId: 1,
        },
      });
      expect(startRes.statusCode).toBe(201);
      const startJson = startRes.json();
      createdSessionId = startJson.data.id;
      const firstSessionDate = startJson.data.workout_date || startJson.data.session_date;
      const firstExercise = startJson.data.exercises[0];

      // Log set 1
      const setRes = await app.inject({
        method: 'POST',
        url: `/api/v1/me/workouts/${createdSessionId}/sets`,
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          sessionExerciseId: firstExercise.id,
          setNumber: 1,
          setType: 'working',
          weightKg: 85.0,
          reps: 8,
          rir: 2,
        },
      });
      expect(setRes.statusCode).toBe(200);

      // Complete session
      const completeRes = await app.inject({
        method: 'POST',
        url: `/api/v1/me/workouts/${createdSessionId}/complete`,
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          notes: 'Great pump, felt strong on bench press',
          rating: 5,
        },
      });
      expect(completeRes.statusCode).toBe(200);
      expect(completeRes.json().data.status).toBe('completed');

      // A separate scheduled day must reject empty completion and invalid
      // tracking payloads, then accept a valid duration set.
      const durationStartRes = await app.inject({
        method: 'POST',
        url: '/api/v1/me/workouts/start',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          workoutPlanDayId: 2,
          sessionDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        },
      });
      expect(durationStartRes.statusCode).toBe(201);
      const durationSession = durationStartRes.json().data;
      const durationExercise = durationSession.exercises.find(
        (exercise: any) => exercise.tracking_type === 'duration',
      );
      expect(durationExercise).toBeDefined();

      const invalidDurationSetRes = await app.inject({
        method: 'POST',
        url: `/api/v1/me/workouts/${durationSession.id}/sets`,
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          sessionExerciseId: durationExercise.id,
          setNumber: 1,
        },
      });
      expect(invalidDurationSetRes.statusCode).toBe(400);

      const emptyCompleteRes = await app.inject({
        method: 'POST',
        url: `/api/v1/me/workouts/${durationSession.id}/complete`,
        headers: { authorization: `Bearer ${userToken}` },
        payload: {},
      });
      expect(emptyCompleteRes.statusCode).toBe(400);

      const validDurationSetRes = await app.inject({
        method: 'POST',
        url: `/api/v1/me/workouts/${durationSession.id}/sets`,
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          sessionExerciseId: durationExercise.id,
          setNumber: 1,
          durationSeconds: 60,
        },
      });
      expect(validDurationSetRes.statusCode).toBe(200);

      const durationCompleteRes = await app.inject({
        method: 'POST',
        url: `/api/v1/me/workouts/${durationSession.id}/complete`,
        headers: { authorization: `Bearer ${userToken}` },
        payload: {},
      });
      expect(durationCompleteRes.statusCode).toBe(200);

      // Calling start again on the same day returns existing session (200) rather than creating duplicate
      const resumeRes = await app.inject({
        method: 'POST',
        url: '/api/v1/me/workouts/start',
        headers: { authorization: `Bearer ${userToken}` },
        payload: { workoutPlanDayId: 1 },
      });
      expect(resumeRes.statusCode).toBe(200);
      expect(resumeRes.json().data.id).toBe(createdSessionId);

      // Verify in DB that only 1 session exists for John today
      const db = getDatabasePool();
      const countRow = await db.queryOne<{ cnt: number }>(
        'SELECT COUNT(*) as cnt FROM workout_sessions WHERE user_id = 2 AND workout_date = ?',
        [firstSessionDate],
      );
      expect(countRow?.cnt).toBe(1);
    });

    it('User Isolation: Jane Doe cannot access or modify John Does workout session', async () => {
      // Jane attempts to view John's session -> Must be 404 (isolated)
      const viewRes = await app.inject({
        method: 'GET',
        url: `/api/v1/me/workouts/${createdSessionId}`,
        headers: { authorization: `Bearer ${janeToken}` },
      });
      expect(viewRes.statusCode).toBe(404);

      // Jane attempts to log set on John's session -> Must be 404
      const setRes = await app.inject({
        method: 'POST',
        url: `/api/v1/me/workouts/${createdSessionId}/sets`,
        headers: { authorization: `Bearer ${janeToken}` },
        payload: {
          sessionExerciseId: 1,
          setNumber: 2,
          weightKg: 100,
          reps: 5,
        },
      });
      expect(setRes.statusCode).toBe(404);
    });

    it('GET /api/v1/me/exercises/1/previous-performance should return recent workout history', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/me/exercises/1/previous-performance',
        headers: { authorization: `Bearer ${userToken}` },
      });
      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.success).toBe(true);
      expect(json.data.maxWeightKg).toBe(85);
      expect(json.data.highestCompletedReps).toBe(8);
      expect(json.data.lastWorkoutDate).toBeTruthy();
      expect(json.data.recentSets.length).toBeGreaterThanOrEqual(1);
    });

    it('POST /api/v1/me/cardio should log cardio session with dynamic weekday targets', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/me/cardio',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          cardioActivityId: 2,
          durationMinutes: 30,
          distanceKm: 12.5,
          caloriesBurned: 240,
        },
      });
      expect(res.statusCode).toBe(201);
      const json = res.json();
      expect(json.data.durationMinutes).toBe(30);
    });

    it('POST /api/v1/me/cardio should deduplicate retries with the same idempotency key', async () => {
      const operationId = `cardio-op-${Date.now()}`;
      const payload = {
        cardioActivityId: 2,
        durationMinutes: 18,
        distanceKm: 6.2,
        clientOperationId: operationId,
      };

      const first = await app.inject({
        method: 'POST',
        url: '/api/v1/me/cardio',
        headers: { authorization: `Bearer ${userToken}`, 'Idempotency-Key': operationId },
        payload,
      });
      const second = await app.inject({
        method: 'POST',
        url: '/api/v1/me/cardio',
        headers: { authorization: `Bearer ${userToken}`, 'Idempotency-Key': operationId },
        payload,
      });

      expect(first.statusCode).toBe(201);
      expect(second.statusCode).toBe(201);
      expect(second.json()).toEqual(first.json());

      const count = await getDatabasePool().queryOne<{ count: number }>(
        'SELECT COUNT(*) as count FROM cardio_logs WHERE user_id = ? AND duration_minutes = ? AND distance_km = ?',
        [2, 18, 6.2],
      );
      expect(count?.count).toBe(1);
    });

    it('GET /api/v1/me/meals/today should return today configured meals', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/me/meals/today',
        headers: { authorization: `Bearer ${userToken}` },
      });
      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data.meals)).toBe(true);
    });

    it('GET /api/v1/me/cardio/activities should return list of available cardio activities', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/me/cardio/activities',
        headers: { authorization: `Bearer ${userToken}` },
      });
      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.success).toBe(true);
      expect(json.data.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('8. Progress, Admin Analytics & Background Reminders', () => {
    it('GET /api/v1/me/progress should compute adherence, weight and workout volume', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/me/progress',
        headers: { authorization: `Bearer ${userToken}` },
      });
      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.success).toBe(true);
      expect(json.data.workouts.completedSessions).toBeGreaterThanOrEqual(1);
      expect(json.data.cardio.totalMinutes).toBeGreaterThanOrEqual(30);
    });

    it('GET /api/v1/admin/analytics/overview should return platform-wide metrics', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/analytics/overview',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.success).toBe(true);
      expect(json.data.totalUsers).toBeGreaterThanOrEqual(1);
      expect(json.data.completedWorkouts).toBeGreaterThanOrEqual(1);
    });

    it('POST /api/v1/admin/reminders/process should evaluate active reminder rules and create notifications', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/reminders/process',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.success).toBe(true);
      expect(json.data.processedRules).toBeGreaterThanOrEqual(1);
    });

    it('GET /api/v1/admin/audit-logs should return recorded audit event entries', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/audit-logs',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.success).toBe(true);
      expect(json.data.length).toBeGreaterThanOrEqual(1);
    });

    it('ReminderWorker daemon processOnce() evaluates rules and executes without unhandled errors', async () => {
      const worker = new ReminderWorker();
      const summary = await worker.processOnce();
      expect(summary).toBeDefined();
      expect(summary.rulesEvaluated).toBeGreaterThanOrEqual(1);
      expect(summary.errorsCount).toBe(0);
      expect(summary.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('Concurrent ReminderWorker instances: distributed database lease lock prevents duplicate executions', async () => {
      const db = getDatabasePool();
      // Manually set lock for reminder_worker with future timestamp by another instance
      const future = new Date(Date.now() + 60000).toISOString().slice(0, 19).replace('T', ' ');
      await db.execute(
        "UPDATE worker_locks SET locked_until = ?, locked_by = 'external_instance_999' WHERE worker_name = 'reminder_worker'",
        [future]
      );

      const worker = new ReminderWorker();
      const summary = await worker.processOnce();
      // Since external instance holds lease, this instance must skip execution cleanly
      expect(summary.rulesEvaluated).toBe(0);
      expect(summary.notificationsDispatched).toBe(0);
      expect(summary.errorsCount).toBe(0);

      // Release external lock
      await db.execute(
        "UPDATE worker_locks SET locked_until = '1970-01-01 00:00:00' WHERE worker_name = 'reminder_worker'"
      );
    });

    it('Admin can perform full CRUD lifecycle on reminder rules', async () => {
      // 1. Create
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/reminders',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          title: 'Evening Hydration Check',
          category: 'water',
          mode: 'fixed_time',
          fixedTime: '20:00:00',
          isActive: true,
        },
      });
      expect(createRes.statusCode).toBe(201);
      const ruleId = createRes.json().data.id;

      // 2. Read single
      const getRes = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/reminders/${ruleId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(getRes.statusCode).toBe(200);
      expect(getRes.json().data.title).toBe('Evening Hydration Check');

      // 3. Update
      const updateRes = await app.inject({
        method: 'PUT',
        url: `/api/v1/admin/reminders/${ruleId}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          title: 'Night Hydration Target',
          category: 'water',
          mode: 'fixed_time',
          fixedTime: '21:00:00',
          isActive: false,
        },
      });
      expect(updateRes.statusCode).toBe(200);

      // 4. Toggle
      const toggleRes = await app.inject({
        method: 'PATCH',
        url: `/api/v1/admin/reminders/${ruleId}/toggle`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { isActive: true },
      });
      expect(toggleRes.statusCode).toBe(200);
      expect(toggleRes.json().data.isActive).toBe(true);

      // 5. Delete
      const deleteRes = await app.inject({
        method: 'DELETE',
        url: `/api/v1/admin/reminders/${ruleId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(deleteRes.statusCode).toBe(200);
    });

    it('User can mark all notifications read and dismiss single notifications', async () => {
      // Create a test notification
      const db = getDatabasePool();
      const notifRes = await db.execute(
        `INSERT INTO notifications (user_id, category, notification_type, title, message, status)
         VALUES (2, 'workout', 'reminder', 'Time to train', 'Log your workout today', 'unread')`
      );
      const notifId = notifRes.insertId;

      // Mark all read
      const markAllRes = await app.inject({
        method: 'POST',
        url: '/api/v1/me/notifications/read-all',
        headers: { authorization: `Bearer ${userToken}` },
      });
      expect(markAllRes.statusCode).toBe(200);

      // Dismiss
      const dismissRes = await app.inject({
        method: 'POST',
        url: `/api/v1/me/notifications/${notifId}/dismiss`,
        headers: { authorization: `Bearer ${userToken}` },
      });
      expect(dismissRes.statusCode).toBe(200);

      // Get my notifications - should exclude dismissed
      const getRes = await app.inject({
        method: 'GET',
        url: '/api/v1/me/notifications',
        headers: { authorization: `Bearer ${userToken}` },
      });
      expect(getRes.statusCode).toBe(200);
      const notifs = getRes.json().data;
      expect(notifs.some((n: any) => n.id === notifId)).toBe(false);
    });

    it('Admin can list, inspect delivery details, and dispatch manual notifications', async () => {
      // 1. Dispatch manual notification to user 2
      const sendRes = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/notifications',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          userId: 2,
          category: 'system',
          title: 'Special Motivation',
          message: 'Keep crushing your goals this week!',
        },
      });
      expect(sendRes.statusCode).toBe(201);

      // 2. List notifications
      const listRes = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/notifications?userId=2',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(listRes.statusCode).toBe(200);
      const notifs = listRes.json().data.notifications;
      expect(notifs.length).toBeGreaterThanOrEqual(1);
      const createdNotif = notifs[0];

      // 3. Inspect detail + deliveries
      const detailRes = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/notifications/${createdNotif.id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(detailRes.statusCode).toBe(200);
      const detailData = detailRes.json().data;
      expect(detailData.deliveries).toBeDefined();
      expect(detailData.deliveries.length).toBeGreaterThanOrEqual(1);

      // Regression check: malformed pagination returns 400 VALIDATION_ERROR instead of 500
      const badQueryRes = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/notifications?page=abc&limit=abc',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(badQueryRes.statusCode).toBe(400);
      expect(badQueryRes.json().error.code).toBe('VALIDATION_ERROR');
    });

    it('Admin can retrieve comprehensive User Monitoring Dossier with todayWorkout filtered by localDate', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/users/2/monitoring',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.success).toBe(true);
      expect(json.data.user.id).toBe(2);
      expect(json.data.assignments).toBeDefined();
      expect(json.data.goals).toBeDefined();
      expect(json.data.today).toBeDefined();
      expect(json.data.adherence).toBeDefined();
      expect(json.data.localDate).toBeDefined();
      if (json.data.today.workout) {
        expect(json.data.today.workout.session_date).toBe(json.data.localDate);
      }
    });

    it('Admin can inspect single audit log entry and update settings', async () => {
      // 1. Audit log detail
      const listRes = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/audit-logs',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(listRes.statusCode).toBe(200);
      const firstLog = listRes.json().data[0];

      const detailRes = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/audit-logs/${firstLog.id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(detailRes.statusCode).toBe(200);
      expect(detailRes.json().data.id).toBe(firstLog.id);

      // 2. Settings list
      const getSettingsRes = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/settings',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(getSettingsRes.statusCode).toBe(200);
      expect(getSettingsRes.json().data.systemSettings).toBeDefined();

      // 3. Settings update
      const updateSettingsRes = await app.inject({
        method: 'PUT',
        url: '/api/v1/admin/settings',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          settings: [
            { table: 'system_settings', key: 'platform_maintenance_mode', value: '0' },
            { table: 'app_settings', key: 'min_app_version', value: '1.2.0' },
          ],
        },
      });
      expect(updateSettingsRes.statusCode).toBe(200);

      // 4. Admin foods catalog pagination & validation
      const foodsRes = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/foods?page=1&limit=10',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(foodsRes.statusCode).toBe(200);
      expect(foodsRes.json().pagination.page).toBe(1);
      expect(foodsRes.json().pagination.limit).toBe(10);

      const badFoodsRes = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/foods?page=abc&limit=abc',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(badFoodsRes.statusCode).toBe(400);
      expect(badFoodsRes.json().error.code).toBe('VALIDATION_ERROR');

      // 5. Admin exercises catalog pagination & numeric filters validation
      const exercisesRes = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/exercises?page=1&limit=10&muscleGroupId=1&equipmentTypeId=1',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(exercisesRes.statusCode).toBe(200);
      expect(exercisesRes.json().pagination.page).toBe(1);
      expect(exercisesRes.json().pagination.limit).toBe(10);

      const badExercisesRes = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/exercises?page=abc&limit=abc',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(badExercisesRes.statusCode).toBe(400);
      expect(badExercisesRes.json().error.code).toBe('VALIDATION_ERROR');

      const badMuscleRes = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/exercises?muscleGroupId=abc',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(badMuscleRes.statusCode).toBe(400);
      expect(badMuscleRes.json().error.code).toBe('VALIDATION_ERROR');

      const badEquipRes = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/exercises?equipmentTypeId=xyz',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(badEquipRes.statusCode).toBe(400);
      expect(badEquipRes.json().error.code).toBe('VALIDATION_ERROR');

      // 6. Admin numeric ID validation across endpoints (users, audit-logs, assignments, goals)
      const badUserIdRes = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/users/abc',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(badUserIdRes.statusCode).toBe(400);
      expect(badUserIdRes.json().error.code).toBe('VALIDATION_ERROR');

      const badDossierUserIdRes = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/users/abc/monitoring',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(badDossierUserIdRes.statusCode).toBe(400);
      expect(badDossierUserIdRes.json().error.code).toBe('VALIDATION_ERROR');

      const badAuditIdRes = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/audit-logs/abc',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(badAuditIdRes.statusCode).toBe(400);
      expect(badAuditIdRes.json().error.code).toBe('VALIDATION_ERROR');

      const badWorkoutAssignRes = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/users/abc/workout-assignments',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(badWorkoutAssignRes.statusCode).toBe(400);
      expect(badWorkoutAssignRes.json().error.code).toBe('VALIDATION_ERROR');

      const badDietAssignRes = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/users/abc/diet-assignments',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(badDietAssignRes.statusCode).toBe(400);
      expect(badDietAssignRes.json().error.code).toBe('VALIDATION_ERROR');

      const badGoalUserIdRes = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/users/abc/weight-goals',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(badGoalUserIdRes.statusCode).toBe(400);
      expect(badGoalUserIdRes.json().error.code).toBe('VALIDATION_ERROR');
    });

    it('Workout session resume, history, and discard endpoints operate accurately', async () => {
      // 1. Check active workout initially (or start one)
      const startRes = await app.inject({
        method: 'POST',
        url: '/api/v1/me/workouts/start',
        headers: { authorization: `Bearer ${userToken}` },
        payload: { workoutPlanDayId: 1, sessionDate: '2026-08-31' },
      });
      expect(startRes.statusCode).toBe(201);
      const sessionId = startRes.json().data.id;

      // 2. Query active workout
      const activeRes = await app.inject({
        method: 'GET',
        url: '/api/v1/me/workouts/active',
        headers: { authorization: `Bearer ${userToken}` },
      });
      expect(activeRes.statusCode).toBe(200);
      expect(activeRes.json().data.id).toBe(sessionId);

      // 3. Discard active session
      const discardRes = await app.inject({
        method: 'POST',
        url: `/api/v1/me/workouts/${sessionId}/discard`,
        headers: { authorization: `Bearer ${userToken}` },
      });
      expect(discardRes.statusCode).toBe(200);

      // 4. Query history
      const historyRes = await app.inject({
        method: 'GET',
        url: '/api/v1/me/workouts/history',
        headers: { authorization: `Bearer ${userToken}` },
      });
      expect(historyRes.statusCode).toBe(200);
      expect(Array.isArray(historyRes.json().data)).toBe(true);
    });

    it('Admin food library lifecycle: measurement units, creation, update, archive, and restore', async () => {
      // 1. Get measurement units
      const unitsRes = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/foods/measurement-units',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(unitsRes.statusCode).toBe(200);
      expect(Array.isArray(unitsRes.json().data)).toBe(true);

      // 2. Create food
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/foods',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          name: 'Greek Yogurt 0%',
          brand: 'Chobani',
          defaultServingAmount: 170,
          measurementUnitId: 1,
          calories: 100,
          proteinG: 18,
          carbsG: 6,
          fatG: 0,
          fiberG: 0,
          notes: 'High protein snack',
        },
      });
      expect(createRes.statusCode).toBe(201);
      const foodId = createRes.json().data.id;
      expect(foodId).toBeDefined();

      // 3. Update food
      const updateRes = await app.inject({
        method: 'PATCH',
        url: `/api/v1/admin/foods/${foodId}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          calories: 110,
          proteinG: 19,
        },
      });
      expect(updateRes.statusCode).toBe(200);
      expect(updateRes.json().data.calories).toBe(110);
      expect(updateRes.json().data.protein_g).toBe(19);

      // 4. Archive food
      const archiveRes = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/foods/${foodId}/archive`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(archiveRes.statusCode).toBe(200);

      // 5. Restore food
      const restoreRes = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/foods/${foodId}/restore`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(restoreRes.statusCode).toBe(200);
    });

    it('Admin diet plan builder lifecycle: meals, option groups, options, metadata updates, and immutability', async () => {
      // 1. Create plan with daily calories target
      const createPlanRes = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/diet-plans',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          name: 'High Protein Cutting Protocol',
          description: '2200 kcal cutting diet',
          dailyCaloriesTarget: 2200,
        },
      });
      expect(createPlanRes.statusCode).toBe(201);
      const plan = createPlanRes.json().data;
      expect(plan.id).toBeDefined();
      const versionId = plan.versions[0].id;
      expect(versionId).toBeDefined();

      // 2. Update version metadata
      const updateVersionRes = await app.inject({
        method: 'PATCH',
        url: `/api/v1/admin/diet-versions/${versionId}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          dailyCaloriesTarget: 2300,
          dailyProteinTargetG: 180,
          dailyCarbsTargetG: 220,
          dailyFatTargetG: 60,
          changeSummary: 'Updated target macros',
        },
      });
      expect(updateVersionRes.statusCode).toBe(200);
      expect(updateVersionRes.json().data.daily_calories_target).toBe(2300);

      // 3. Add meal
      const addMealRes = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/diet-versions/${versionId}/meals`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          name: 'Breakfast',
          scheduledTime: '08:00',
          orderIndex: 1,
          notes: 'Within 1 hour of waking',
        },
      });
      expect(addMealRes.statusCode).toBe(201);
      const meals = addMealRes.json().data.meals;
      expect(meals.length).toBe(1);
      const mealId = meals[0].id;

      // 4. Update meal
      const updateMealRes = await app.inject({
        method: 'PATCH',
        url: `/api/v1/admin/diet-meals/${mealId}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          name: 'Power Breakfast',
          scheduledTime: '08:30',
        },
      });
      expect(updateMealRes.statusCode).toBe(200);
      expect(updateMealRes.json().data.meals[0].name).toBe('Power Breakfast');

      // 5. Add option group
      const addGroupRes = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/diet-meals/${mealId}/groups`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          name: 'Protein Source',
          isRequired: true,
          minSelections: 1,
          maxSelections: 1,
          orderIndex: 1,
        },
      });
      expect(addGroupRes.statusCode).toBe(201);
      const groupId = addGroupRes.json().data.id;

      // 6. Update option group
      const updateGroupRes = await app.inject({
        method: 'PATCH',
        url: `/api/v1/admin/diet-option-groups/${groupId}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          name: 'Primary Protein Source',
          maxSelections: 2,
        },
      });
      expect(updateGroupRes.statusCode).toBe(200);

      // 7. Add option
      const addOptionRes = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/diet-option-groups/${groupId}/options`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          foodId: 1,
          customLabel: '4 Whole Eggs',
          servingQuantity: 200,
          calories: 280,
          proteinG: 24,
          carbsG: 2,
          fatG: 20,
          isDefault: true,
          orderIndex: 1,
        },
      });
      expect(addOptionRes.statusCode).toBe(201);
      const optionId = addOptionRes.json().data.id;

      // 8. Update option
      const updateOptionRes = await app.inject({
        method: 'PATCH',
        url: `/api/v1/admin/diet-options/${optionId}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          customLabel: '4 Large Free-Range Eggs',
          calories: 290,
        },
      });
      expect(updateOptionRes.statusCode).toBe(200);

      // 9. Publish version
      const publishRes = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/diet-versions/${versionId}/publish`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(publishRes.statusCode).toBe(200);
      expect(publishRes.json().data.status).toBe('published');

      // 10. Immutability: Attempting to edit published version must fail closed with 409
      const immutableEditRes = await app.inject({
        method: 'PATCH',
        url: `/api/v1/admin/diet-meals/${mealId}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { name: 'Illegal Mutation' },
      });
      expect(immutableEditRes.statusCode).toBe(409);
      expect(immutableEditRes.json().error.code).toBe('PLAN_VERSION_IMMUTABLE');
    });

    it('executes transaction-safe atomic order swapping for meals, option groups, and food options in draft versions', async () => {
      // 1. Create a diet plan and draft version
      const planRes = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/diet-plans',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { name: 'Reorder Test Protocol' },
      });
      expect(planRes.statusCode).toBe(201);
      const versionId = planRes.json().data.versions[0].id;
      expect(versionId).toBeDefined();

      // 2. Add Meal 1 (Breakfast) and Meal 2 (Dinner)
      const meal1Res = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/diet-versions/${versionId}/meals`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { name: 'Breakfast', orderIndex: 1 },
      });
      expect(meal1Res.statusCode).toBe(201);

      const meal2Res = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/diet-versions/${versionId}/meals`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { name: 'Dinner', orderIndex: 2 },
      });
      expect(meal2Res.statusCode).toBe(201);
      const mealsBefore = meal2Res.json().data.meals;
      const meal1Id = mealsBefore.find((m: any) => m.name === 'Breakfast').id;
      const meal2Id = mealsBefore.find((m: any) => m.name === 'Dinner').id;

      // 3. Swap meals: Move Meal 2 (Dinner) to orderIndex 1
      const swapMealRes = await app.inject({
        method: 'PATCH',
        url: `/api/v1/admin/diet-meals/${meal2Id}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { orderIndex: 1 },
      });
      expect(swapMealRes.statusCode).toBe(200);
      const mealsAfter = swapMealRes.json().data.meals;
      const reorderedMeal1 = mealsAfter.find((m: any) => m.id === meal1Id);
      const reorderedMeal2 = mealsAfter.find((m: any) => m.id === meal2Id);
      expect(reorderedMeal2.order_index).toBe(1);
      expect(reorderedMeal1.order_index).toBe(2);

      // 4. Add Option Group 1 (Carbs) and Option Group 2 (Protein) to Meal 2
      const group1Res = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/diet-meals/${meal2Id}/groups`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { name: 'Carbs', orderIndex: 1 },
      });
      expect(group1Res.statusCode).toBe(201);
      const group1Id = group1Res.json().data.id;

      const group2Res = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/diet-meals/${meal2Id}/groups`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { name: 'Protein', orderIndex: 2 },
      });
      expect(group2Res.statusCode).toBe(201);
      const group2Id = group2Res.json().data.id;

      // 5. Swap Option Groups: Move Group 2 (Protein) to orderIndex 1
      const swapGroupRes = await app.inject({
        method: 'PATCH',
        url: `/api/v1/admin/diet-option-groups/${group2Id}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { orderIndex: 1 },
      });
      expect(swapGroupRes.statusCode).toBe(200);

      // 6. Add Food Option 1 and Food Option 2 to Group 2 (foodId: 1 from seeded foods)
      const opt1Res = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/diet-option-groups/${group2Id}/options`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { foodId: 1, customLabel: 'Chicken', servingQuantity: 150, orderIndex: 1 },
      });
      expect(opt1Res.statusCode).toBe(201);
      const opt1Id = opt1Res.json().data.id;

      const opt2Res = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/diet-option-groups/${group2Id}/options`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { foodId: 1, customLabel: 'Salmon', servingQuantity: 200, orderIndex: 2 },
      });
      expect(opt2Res.statusCode).toBe(201);
      const opt2Id = opt2Res.json().data.id;

      // 7. Swap Food Options: Move Option 2 (Salmon) to orderIndex 1
      const swapOptRes = await app.inject({
        method: 'PATCH',
        url: `/api/v1/admin/diet-options/${opt2Id}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { orderIndex: 1 },
      });
      expect(swapOptRes.statusCode).toBe(200);

      // 8. Add food option to Group 1 and Meal 1 so version satisfies publish requirements
      await app.inject({
        method: 'POST',
        url: `/api/v1/admin/diet-option-groups/${group1Id}/options`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { foodId: 1, customLabel: 'Rice', servingQuantity: 100 },
      });

      const m1gRes = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/diet-meals/${meal1Id}/groups`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { name: 'M1 Group', orderIndex: 1 },
      });
      const m1gId = m1gRes.json().data.id;
      await app.inject({
        method: 'POST',
        url: `/api/v1/admin/diet-option-groups/${m1gId}/options`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { foodId: 1, customLabel: 'Eggs', servingQuantity: 100 },
      });

      // 9. Verify complete reordered hierarchy via getVersion
      const versionRes = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/diet-versions/${versionId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(versionRes.statusCode).toBe(200);
      const verData = versionRes.json().data;
      expect(verData.meals[0].name).toBe('Dinner');
      expect(verData.meals[0].order_index).toBe(1);
      expect(verData.meals[1].name).toBe('Breakfast');
      expect(verData.meals[1].order_index).toBe(2);

      const dinnerGroups = verData.meals[0].optionGroups;
      expect(dinnerGroups[0].name).toBe('Protein');
      expect(dinnerGroups[0].order_index).toBe(1);
      expect(dinnerGroups[1].name).toBe('Carbs');
      expect(dinnerGroups[1].order_index).toBe(2);

      const proteinOpts = dinnerGroups[0].options;
      expect(proteinOpts[0].custom_label).toBe('Salmon');
      expect(proteinOpts[0].order_index).toBe(1);
      expect(proteinOpts[1].custom_label).toBe('Chicken');
      expect(proteinOpts[1].order_index).toBe(2);

      // 10. Publish version and verify draft immutability on reorder
      await app.inject({
        method: 'POST',
        url: `/api/v1/admin/diet-versions/${versionId}/publish`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      const publishedReorderRes = await app.inject({
        method: 'PATCH',
        url: `/api/v1/admin/diet-meals/${meal1Id}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { orderIndex: 1 },
      });
      expect(publishedReorderRes.statusCode).toBe(409);
      expect(publishedReorderRes.json().error.code).toBe('PLAN_VERSION_IMMUTABLE');
    });
  });
});
