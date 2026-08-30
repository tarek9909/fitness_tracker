import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../src/app/app.js';
import { runMigrations } from '../src/database/migrate.js';
import { seedDatabase } from '../src/database/seed.js';
import { closeDatabasePool, resetDatabasePool, getDatabasePool } from '../src/database/pool.js';
import { FastifyInstance } from 'fastify';
import { env } from '../src/config/env.js';

const testDbDir = path.resolve(process.cwd(), 'tests', '.tmp');
const testDbPath = path.resolve(testDbDir, `fitness_test_hardening_${process.pid}_${Date.now()}.db`);

describe('Backend Production Hardening Suite', () => {
  let app: FastifyInstance;
  let adminToken: string;
  let userToken: string;
  const testUserId = 2;

  beforeAll(async () => {
    if (!fs.existsSync(testDbDir)) {
      fs.mkdirSync(testDbDir, { recursive: true });
    }

    process.env.SQLITE_DB_PATH = testDbPath;
    env.sqliteDbPath = testDbPath;
    resetDatabasePool();

    await runMigrations();
    await seedDatabase();

    app = await buildApp();
    await app.ready();

    // Login as admin
    const adminLoginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'admin@fitnessplatform.com',
        password: 'Admin123!',
        deviceName: 'Admin Hardening Test Console',
      },
    });
    expect(adminLoginRes.statusCode).toBe(200);
    adminToken = adminLoginRes.json().data.accessToken;

    // Login as athlete user
    const userLoginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'john.doe@fitnessplatform.com',
        password: 'User123!',
        deviceName: 'Athlete Hardening Test Device',
      },
    });
    expect(userLoginRes.statusCode).toBe(200);
    userToken = userLoginRes.json().data.accessToken;
  });

  afterAll(async () => {
    await app.close();
    await closeDatabasePool();
    if (fs.existsSync(testDbPath)) {
      try { fs.unlinkSync(testDbPath); } catch {}
    }
  });

  describe('1. Published Workout Plan Child Immutability & Race Safety', () => {
    let planId: number;
    let versionId: number;
    let dayId: number;
    let exerciseId: number;

    it('creates draft workout plan, days, and exercises then publishes the version', async () => {
      const planRes = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/workout-plans',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          name: 'Hardening Hypertrophy Split',
          goalCategory: 'hypertrophy',
          description: 'Testing concurrency & immutability guards',
        },
      });
      expect(planRes.statusCode).toBe(201);
      planId = planRes.json().data.id;
      versionId = planRes.json().data.versions[0].id;

      // Add exercise to Day 1
      const versionDetailsRes = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/workout-versions/${versionId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(versionDetailsRes.statusCode).toBe(200);
      dayId = versionDetailsRes.json().data.days[0].id;

      const addExRes = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/workout-days/${dayId}/exercises`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          exerciseId: 1, // Barbell Bench Press
          targetSets: 4,
          repsMin: 8,
          repsMax: 12,
          rirTarget: 2,
          restSeconds: 90,
        },
      });
      expect(addExRes.statusCode).toBe(201);
      exerciseId = addExRes.json().data.id;

      // Publish the version
      const pubRes = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/workout-versions/${versionId}/publish`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(pubRes.statusCode).toBe(200);
      expect(pubRes.json().data.status).toBe('published');
    });

    it('rejects adding new day to published workout version with 409 PLAN_VERSION_IMMUTABLE', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/workout-versions/${versionId}/days`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          weekdayNumber: 1,
          name: 'Extra Monday',
          isRestDay: false,
        },
      });
      expect(res.statusCode).toBe(409);
      expect(res.json().error.code).toBe('PLAN_VERSION_IMMUTABLE');
    });

    it('rejects updating day belonging to published workout version with 409 PLAN_VERSION_IMMUTABLE', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/admin/workout-days/${dayId}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          name: 'Modified Monday Chest Focus',
        },
      });
      expect(res.statusCode).toBe(409);
      expect(res.json().error.code).toBe('PLAN_VERSION_IMMUTABLE');
    });

    it('rejects deleting day belonging to published workout version with 409 PLAN_VERSION_IMMUTABLE', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/v1/admin/workout-days/${dayId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(409);
      expect(res.json().error.code).toBe('PLAN_VERSION_IMMUTABLE');
    });

    it('rejects adding exercise to day of published workout version with 409 PLAN_VERSION_IMMUTABLE', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/workout-days/${dayId}/exercises`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          exerciseId: 2,
          targetSets: 3,
          repsMin: 10,
          repsMax: 15,
        },
      });
      expect(res.statusCode).toBe(409);
      expect(res.json().error.code).toBe('PLAN_VERSION_IMMUTABLE');
    });

    it('rejects updating exercise of published workout version with 409 PLAN_VERSION_IMMUTABLE', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/admin/workout-exercises/${exerciseId}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          targetSets: 5,
        },
      });
      expect(res.statusCode).toBe(409);
      expect(res.json().error.code).toBe('PLAN_VERSION_IMMUTABLE');
    });

    it('rejects deleting exercise of published workout version with 409 PLAN_VERSION_IMMUTABLE', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/v1/admin/workout-exercises/${exerciseId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(409);
      expect(res.json().error.code).toBe('PLAN_VERSION_IMMUTABLE');
    });
  });

  describe('2. Published Diet Plan Child Immutability & Race Safety', () => {
    let dietPlanId: number;
    let dietVersionId: number;
    let mealId: number;
    let groupId: number;
    let optionId: number;

    it('creates draft diet plan, meals, option groups, and options then publishes', async () => {
      const planRes = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/diet-plans',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          name: 'Hardening Nutrition Template',
          description: 'Testing diet immutability boundary',
        },
      });
      expect(planRes.statusCode).toBe(201);
      dietPlanId = planRes.json().data.id;
      dietVersionId = planRes.json().data.versions[0].id;

      // Add meal
      const mealRes = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/diet-versions/${dietVersionId}/meals`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          name: 'Breakfast',
          scheduledTime: '08:30:00',
          orderIndex: 1,
        },
      });
      expect(mealRes.statusCode).toBe(201);
      const versionData = mealRes.json().data;
      mealId = versionData.meals[0].id;

      // Add option group
      const grpRes = await app.inject({
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
      expect(grpRes.statusCode).toBe(201);
      groupId = grpRes.json().data.id;

      // Add food option
      const optRes = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/diet-option-groups/${groupId}/options`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          foodId: 1,
          customLabel: 'Whole Eggs',
          servingQuantity: 150,
          calories: 215,
          proteinG: 19,
          carbsG: 1.5,
          fatG: 15,
          orderIndex: 1,
        },
      });
      expect(optRes.statusCode).toBe(201);
      optionId = optRes.json().data.id;

      // Publish diet version
      const pubRes = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/diet-versions/${dietVersionId}/publish`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(pubRes.statusCode).toBe(200);
      expect(pubRes.json().data.status).toBe('published');
    });

    it('rejects updating published diet version metadata with 409 PLAN_VERSION_IMMUTABLE', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/admin/diet-versions/${dietVersionId}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          title: 'Modified Title After Publish',
        },
      });
      expect(res.statusCode).toBe(409);
      expect(res.json().error.code).toBe('PLAN_VERSION_IMMUTABLE');
    });

    it('rejects adding meal to published diet version with 409 PLAN_VERSION_IMMUTABLE', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/diet-versions/${dietVersionId}/meals`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          name: 'Late Night Snack',
          orderIndex: 2,
        },
      });
      expect(res.statusCode).toBe(409);
      expect(res.json().error.code).toBe('PLAN_VERSION_IMMUTABLE');
    });

    it('rejects updating meal in published diet version with 409 PLAN_VERSION_IMMUTABLE', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/admin/diet-meals/${mealId}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          name: 'Early Morning Breakfast',
        },
      });
      expect(res.statusCode).toBe(409);
      expect(res.json().error.code).toBe('PLAN_VERSION_IMMUTABLE');
    });

    it('rejects deleting meal in published diet version with 409 PLAN_VERSION_IMMUTABLE', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/v1/admin/diet-meals/${mealId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(409);
      expect(res.json().error.code).toBe('PLAN_VERSION_IMMUTABLE');
    });

    it('rejects adding option group to meal of published diet version with 409 PLAN_VERSION_IMMUTABLE', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/diet-meals/${mealId}/groups`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          name: 'Carb Source',
        },
      });
      expect(res.statusCode).toBe(409);
      expect(res.json().error.code).toBe('PLAN_VERSION_IMMUTABLE');
    });

    it('rejects updating option group in published diet version with 409 PLAN_VERSION_IMMUTABLE', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/admin/diet-option-groups/${groupId}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          name: 'Updated Protein Source',
        },
      });
      expect(res.statusCode).toBe(409);
      expect(res.json().error.code).toBe('PLAN_VERSION_IMMUTABLE');
    });

    it('rejects deleting option group in published diet version with 409 PLAN_VERSION_IMMUTABLE', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/v1/admin/diet-option-groups/${groupId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(409);
      expect(res.json().error.code).toBe('PLAN_VERSION_IMMUTABLE');
    });

    it('rejects adding option in published diet version with 409 PLAN_VERSION_IMMUTABLE', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/diet-option-groups/${groupId}/options`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          foodId: 2,
          servingQuantity: 100,
        },
      });
      expect(res.statusCode).toBe(409);
      expect(res.json().error.code).toBe('PLAN_VERSION_IMMUTABLE');
    });

    it('rejects updating option in published diet version with 409 PLAN_VERSION_IMMUTABLE', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/admin/diet-options/${optionId}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          customLabel: 'Scrambled Eggs',
        },
      });
      expect(res.statusCode).toBe(409);
      expect(res.json().error.code).toBe('PLAN_VERSION_IMMUTABLE');
    });

    it('rejects deleting option in published diet version with 409 PLAN_VERSION_IMMUTABLE', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/v1/admin/diet-options/${optionId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(409);
      expect(res.json().error.code).toBe('PLAN_VERSION_IMMUTABLE');
    });
  });

  describe('3. Transactional Idempotency Reservation & Atomicity', () => {
    const opId = 'test-hardening-op-001';

    it('atomically records business mutation and idempotency completion record', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/me/water',
        headers: {
          authorization: `Bearer ${userToken}`,
          'idempotency-key': opId,
        },
        payload: {
          amountMl: 350,
          intakeDate: '2026-08-31',
        },
      });
      expect(res.statusCode).toBe(201);
      expect(res.json().success).toBe(true);

      // Verify idempotency record in db
      const db = getDatabasePool();
      const record = await db.queryOne<any>(
        'SELECT * FROM api_idempotency_keys WHERE user_id = ? AND client_operation_id = ?',
        [testUserId, opId]
      );
      expect(record).not.toBeNull();
      expect(record.response_status).toBe(201);
      expect(record.completed_at).not.toBeNull();
    });

    it('replays identical response status and body without re-inserting row', async () => {
      const db = getDatabasePool();
      const countBefore = await db.queryOne<{ count: number }>(
        'SELECT COUNT(*) as count FROM water_entries WHERE user_id = ? AND intake_date = ?',
        [testUserId, '2026-08-31']
      );

      const replayRes = await app.inject({
        method: 'POST',
        url: '/api/v1/me/water',
        headers: {
          authorization: `Bearer ${userToken}`,
          'idempotency-key': opId,
        },
        payload: {
          amountMl: 350,
          intakeDate: '2026-08-31',
        },
      });
      expect(replayRes.statusCode).toBe(201);
      expect(replayRes.json().success).toBe(true);

      const countAfter = await db.queryOne<{ count: number }>(
        'SELECT COUNT(*) as count FROM water_entries WHERE user_id = ? AND intake_date = ?',
        [testUserId, '2026-08-31']
      );
      expect(countAfter?.count).toBe(countBefore?.count);
    });

    it('rejects reusing idempotency key with differing payload', async () => {
      const conflictRes = await app.inject({
        method: 'POST',
        url: '/api/v1/me/water',
        headers: {
          authorization: `Bearer ${userToken}`,
          'idempotency-key': opId,
        },
        payload: {
          amountMl: 500, // Different amount!
          intakeDate: '2026-08-31',
        },
      });
      expect(conflictRes.statusCode).toBe(409);
      expect(conflictRes.json().error.code).toBe('IDEMPOTENCY_KEY_REUSED');
    });
  });

  describe('4. Bounded Transactional Task Materialization in /me/today', () => {
    it('materializes and synchronizes daily tasks without duplicating rows', async () => {
      const res1 = await app.inject({
        method: 'GET',
        url: '/api/v1/me/today',
        headers: { authorization: `Bearer ${userToken}` },
      });
      expect(res1.statusCode).toBe(200);
      const plan1 = res1.json().data;
      expect(plan1.tasks).toBeDefined();
      const initialTaskCount = plan1.tasks.length;

      // Second invocation on same day
      const res2 = await app.inject({
        method: 'GET',
        url: '/api/v1/me/today',
        headers: { authorization: `Bearer ${userToken}` },
      });
      expect(res2.statusCode).toBe(200);
      const plan2 = res2.json().data;
      expect(plan2.tasks.length).toBe(initialTaskCount);

      // Verify task keys are unique per user and day
      const taskKeys = plan2.tasks.map((t: any) => t.taskKey);
      const uniqueKeys = new Set(taskKeys);
      expect(uniqueKeys.size).toBe(taskKeys.length);
    });
  });
});
