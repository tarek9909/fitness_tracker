import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../src/app/app.js';
import { runMigrations } from '../src/database/migrate.js';
import { seedDatabase } from '../src/database/seed.js';
import { closeDatabasePool, resetDatabasePool, getDatabasePool } from '../src/database/pool.js';
import bcrypt from 'bcryptjs';
import { FastifyInstance } from 'fastify';
import { env } from '../src/config/env.js';

const testDbDir = path.resolve(process.cwd(), 'tests', '.tmp');
const testDbPath = path.resolve(testDbDir, `fitness_test_analytics_${process.pid}_${Date.now()}.db`);

describe('Admin Fitness Analytics Suite', () => {
  let app: FastifyInstance;
  let adminToken: string;
  let userToken: string;
  const testUserId = 2; // Seeded athlete user

  const origDbClient = env.dbClient;

  beforeAll(async () => {
    if (!fs.existsSync(testDbDir)) {
      fs.mkdirSync(testDbDir, { recursive: true });
    }

    process.env.SQLITE_DB_PATH = testDbPath;
    env.sqliteDbPath = testDbPath;
    env.dbClient = 'sqlite';
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
        deviceName: 'Admin Analytics Test Console',
      },
    });
    expect(adminLoginRes.statusCode).toBe(200);
    adminToken = adminLoginRes.json().data.accessToken;

    // Login as normal user
    const userLoginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'john.doe@fitnessplatform.com',
        password: 'User123!',
        deviceName: 'User Mobile Test',
      },
    });
    expect(userLoginRes.statusCode).toBe(200);
    userToken = userLoginRes.json().data.accessToken;
  });

  afterAll(async () => {
    if (app) await app.close();
    await closeDatabasePool();
    env.dbClient = origDbClient;
    resetDatabasePool();

    try {
      const filesToDelete = [testDbPath, `${testDbPath}-wal`, `${testDbPath}-shm`];
      for (const file of filesToDelete) {
        if (fs.existsSync(file)) fs.unlinkSync(file);
      }
    } catch {
      // Best-effort cleanup
    }
  });

  describe('1. Platform Overview & Global KPIs (Req #58, #92)', () => {
    it('rejects unauthenticated requests to /admin/analytics/overview', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/analytics/overview',
      });
      expect(res.statusCode).toBe(401);
    });

    it('rejects regular athlete requests to /admin/analytics/overview with 403 Forbidden', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/analytics/overview',
        headers: { Authorization: `Bearer ${userToken}` },
      });
      expect(res.statusCode).toBe(403);
    });

    it('returns authoritative global KPIs, adherence breakdown, and daily trends for admin', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/analytics/overview?days=30',
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.success).toBe(true);

      const { data } = json;
      expect(data.totalUsers).toBeGreaterThanOrEqual(1);
      expect(data.activeUsers).toBeGreaterThanOrEqual(1);
      expect(data.completedWorkouts).toBeDefined();
      expect(data.adherenceBreakdown).toBeDefined();
      expect(data.adherenceBreakdown.workout).toBeDefined();
      expect(data.adherenceBreakdown.diet).toBeDefined();
      expect(data.adherenceBreakdown.water).toBeDefined();
      expect(data.adherenceBreakdown.cardio).toBeDefined();
      expect(data.adherenceBreakdown.weight).toBeDefined();
      expect(Array.isArray(data.dailyTrends)).toBe(true);
      expect(Array.isArray(data.recentActivity)).toBe(true);
    });
  });

  describe('2. Athletes Summary Analytics (Req #61)', () => {
    it('rejects unauthenticated requests to /admin/analytics/users with 401 Unauthorized', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/analytics/users',
      });
      expect(res.statusCode).toBe(401);
    });

    it('rejects regular athlete requests to /admin/analytics/users with 403 Forbidden', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/analytics/users',
        headers: { Authorization: `Bearer ${userToken}` },
      });
      expect(res.statusCode).toBe(403);
    });

    it('returns a summary list of athlete users with workouts and adherence indicators', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/analytics/users',
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
      expect(json.data.length).toBeGreaterThanOrEqual(1);
      expect(json.pagination.page).toBe(1);
      expect(json.pagination.limit).toBe(50);
      expect(json.pagination.total).toBeGreaterThanOrEqual(json.data.length);

      const athlete = json.data.find((u: any) => u.id === testUserId);
      expect(athlete).toBeDefined();
      expect(athlete.email).toBeDefined();
      expect(athlete.status).toBeDefined();
      expect(athlete.adherencePct).toBeDefined();
    });

    it('accurately aggregates workouts, latest weight, adherence, and last active date in bulk aggregate query', async () => {
      const db = getDatabasePool();
      const passwordHash = await bcrypt.hash('AggPass123!', 10);
      const userRes = await db.execute(
        `INSERT INTO users (email, password_hash, first_name, last_name, role_id, status)
         VALUES ('user_agg_test@test.com', ?, 'AggFirst', 'AggLast', 3, 'active')`,
        [passwordHash]
      );
      const aggUserId = userRes.insertId;

      const today = new Date().toISOString().slice(0, 10);
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

      // Insert 2 completed workouts
      await db.execute(
        `INSERT INTO workout_sessions (user_id, workout_date, workout_name_snapshot, status, completed_at)
         VALUES (?, ?, 'Workout 1', 'completed', CURRENT_TIMESTAMP),
                (?, ?, 'Workout 2', 'completed', CURRENT_TIMESTAMP)`,
        [aggUserId, yesterday, aggUserId, today]
      );

      // Insert 2 body weight entries (older = 80.0, latest = 78.5)
      await db.execute(
        `INSERT INTO body_weight_entries (user_id, measurement_date, weight_kg)
         VALUES (?, ?, 80.0),
                (?, ?, 78.5)`,
        [aggUserId, yesterday, aggUserId, today]
      );

      // Insert 4 daily tasks (3 completed, 1 missed => 75% adherence)
      await db.execute(
        `INSERT INTO daily_tasks (user_id, task_date, task_key, task_type, title_snapshot, scheduled_at, due_at, status)
         VALUES (?, ?, 'task:1', 'workout', 'Workout', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'completed'),
                (?, ?, 'task:2', 'diet', 'Meal 1', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'completed'),
                (?, ?, 'task:3', 'water', 'Water', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'completed'),
                (?, ?, 'task:4', 'cardio', 'Cardio', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'missed')`,
        [aggUserId, today, aggUserId, today, aggUserId, today, aggUserId, today]
      );

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/analytics/users',
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.success).toBe(true);

      const found = json.data.find((u: any) => u.id === aggUserId);
      expect(found).toBeDefined();
      expect(found.completedWorkouts).toBe(2);
      expect(found.latestWeightKg).toBe(78.5);
      expect(found.adherencePct).toBe(75);
      expect(found.lastActiveDate).toBe(today);
    });

    it('correctly resolves latestWeightKg when a newer insertion has an older backdated measurement date', async () => {
      const db = getDatabasePool();
      const passwordHash = await bcrypt.hash('BackdatePass123!', 10);
      const userRes = await db.execute(
        `INSERT INTO users (email, password_hash, first_name, last_name, role_id, status)
         VALUES ('user_backdate_weight@test.com', ?, 'Backdate', 'User', 3, 'active')`,
        [passwordHash]
      );
      const testUser = userRes.insertId;

      // 1. Insert entry for 2026-03-05 (weight = 75.0, id = N)
      await db.execute(
        `INSERT INTO body_weight_entries (user_id, measurement_date, weight_kg)
         VALUES (?, '2026-03-05', 75.0)`,
        [testUser]
      );

      // 2. Insert backdated entry for 2026-03-01 (weight = 80.0, higher id = N+1)
      await db.execute(
        `INSERT INTO body_weight_entries (user_id, measurement_date, weight_kg)
         VALUES (?, '2026-03-01', 80.0)`,
        [testUser]
      );

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/analytics/users',
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      const athlete = json.data.find((u: any) => u.id === testUser);
      expect(athlete).toBeDefined();
      // Must return 75.0 (greatest measurement_date '2026-03-05'), NOT 80.0 (backdated date '2026-03-01' with higher id)
      expect(athlete.latestWeightKg).toBe(75.0);
    });
  });

  describe('3. Per-User Deep Dive Fitness Analytics (Req #92-95)', () => {
    it('returns 404 for non-existent userId', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/analytics/users/999999',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(404);
    });

    it('returns comprehensive fitness progression across weight, workouts, exercise 1RM, nutrition, water, and cardio', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/analytics/users/${testUserId}?days=60`,
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.success).toBe(true);

      const { data } = json;
      expect(data.user.id).toBe(testUserId);

      // Adherence
      expect(data.adherence).toBeDefined();
      expect(data.adherence.overallPct).toBeDefined();
      expect(data.adherence.byType).toBeDefined();

      // Weight Progression
      expect(data.weight).toBeDefined();
      expect(Array.isArray(data.weight.history)).toBe(true);

      // Workouts & Volume
      expect(data.workouts).toBeDefined();
      expect(data.workouts.totalVolumeKg).toBeDefined();
      expect(Array.isArray(data.workouts.recentSessions)).toBe(true);

      // Exercise 1RM Progression
      expect(Array.isArray(data.exerciseProgression)).toBe(true);

      // Nutrition
      expect(data.nutrition).toBeDefined();
      expect(data.nutrition.compliancePct).toBeDefined();
      expect(Array.isArray(data.nutrition.recentMealLogs)).toBe(true);

      // Water Hydration
      expect(data.water).toBeDefined();
      expect(data.water.dailyAverageMl).toBeDefined();
      expect(Array.isArray(data.water.dailyHistory)).toBe(true);

      // Cardio
      expect(data.cardio).toBeDefined();
      expect(data.cardio.totalMinutes).toBeDefined();
      expect(Array.isArray(data.cardio.activitiesBreakdown)).toBe(true);
    });

    it('returns null compliance and adherence for a user with zero logged meals or tasks (no fake 100%)', async () => {
      // User 1 is admin/coach without athlete task/meal logs
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/analytics/users/1?days=30`,
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      expect(res.statusCode).toBe(200);
      const { data } = res.json();
      expect(data.nutrition.totalMealsLogged).toBe(0);
      expect(data.nutrition.compliancePct).toBeNull();
      expect(data.adherence.overallPct).toBeNull();
      expect(data.adherence.byType.diet.ratePct).toBeNull();
      expect(data.adherence.byType.workout.ratePct).toBeNull();
    });

    it('returns neutral null water targets and omits water task when no user target is configured (no fake 3000ml goal)', async () => {
      const db = getDatabasePool();
      const passwordHash = await bcrypt.hash('NeutralPass123!', 10);
      const userRes = await db.execute(
        `INSERT INTO users (email, password_hash, first_name, last_name, role_id, status)
         VALUES ('user_nowater_target@test.com', ?, 'NoWater', 'Target', 3, 'active')`,
        [passwordHash]
      );
      const noWaterUserId = userRes.insertId;

      // Login as this user
      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'user_nowater_target@test.com',
          password: 'NeutralPass123!',
          deviceName: 'Phone',
        },
      });
      expect(loginRes.statusCode).toBe(200);
      const neutralUserToken = loginRes.json().data.accessToken;

      // 1. GET /api/v1/me/today returns null water target and does NOT invent a water task
      const todayRes = await app.inject({
        method: 'GET',
        url: '/api/v1/me/today',
        headers: { authorization: `Bearer ${neutralUserToken}` },
      });
      expect(todayRes.statusCode).toBe(200);
      const todayData = todayRes.json().data;
      expect(todayData.water.targetMl).toBeNull();
      expect(todayData.water.remainingMl).toBeNull();
      expect(todayData.water.completionPercent).toBeNull();
      expect(todayData.tasks.some((t: any) => t.taskType === 'water' || t.taskKey === 'water')).toBe(false);

      // 2. GET /api/v1/me/water/today returns null target
      const waterTodayRes = await app.inject({
        method: 'GET',
        url: '/api/v1/me/water/today',
        headers: { authorization: `Bearer ${neutralUserToken}` },
      });
      expect(waterTodayRes.statusCode).toBe(200);
      const waterData = waterTodayRes.json().data;
      expect(waterData.targetMl).toBeNull();
      expect(waterData.remainingMl).toBeNull();
      expect(waterData.completionPercent).toBeNull();

      // 3. Admin user analytics GET /api/v1/admin/analytics/users/:userId returns null target
      const adminUserRes = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/analytics/users/${noWaterUserId}?days=30`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(adminUserRes.statusCode).toBe(200);
      const adminUserData = adminUserRes.json().data;
      expect(adminUserData.water.targetMl).toBeNull();
    });

    it('computes weighted adherence with custom user adherence configs and renormalizes missing components', async () => {
      const db = getDatabasePool();
      const passwordHash = await bcrypt.hash('AdherencePass123!', 10);
      const userRes = await db.execute(
        `INSERT INTO users (email, password_hash, first_name, last_name, role_id, status)
         VALUES ('user_custom_adherence@test.com', ?, 'Custom', 'Adherence', 3, 'active')`,
        [passwordHash]
      );
      const customUserId = userRes.insertId;

      // 1. Configure custom weights: Diet 60%, Workout 40%, Cardio 0%, Water 0%, Weight 0%
      const configRes = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/users/${customUserId}/adherence-config`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          dietWeightPct: 60,
          workoutWeightPct: 40,
          cardioWeightPct: 0,
          waterWeightPct: 0,
          weightLoggingWeightPct: 0,
        },
      });
      expect(configRes.statusCode).toBe(200);

      const today = new Date().toISOString().slice(0, 10);

      // Insert 2 diet tasks (1 completed, 1 pending => 50% diet) and 1 workout task (1 completed => 100% workout)
      await db.execute(
        `INSERT INTO daily_tasks (user_id, task_date, task_key, task_type, title_snapshot, scheduled_at, due_at, status)
         VALUES (?, ?, 'meal:1', 'diet', 'Breakfast', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'completed'),
                (?, ?, 'meal:2', 'diet', 'Lunch', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'pending'),
                (?, ?, 'workout:1', 'workout', 'Leg Day', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'completed')`,
        [customUserId, today, customUserId, today, customUserId, today]
      );

      // Weighted calculation:
      // Active weights: Diet (60) + Workout (40) = 100
      // Weighted sum: (0.50 * 60) + (1.00 * 40) = 30 + 40 = 70%
      // (Unweighted task completion would have been 2/3 = 67%)
      const userAnalyticsRes = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/analytics/users/${customUserId}?days=30`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(userAnalyticsRes.statusCode).toBe(200);
      const data = userAnalyticsRes.json().data;

      expect(data.adherence.byType.diet.ratePct).toBe(50);
      expect(data.adherence.byType.workout.ratePct).toBe(100);
      expect(data.adherence.byType.cardio.ratePct).toBeNull();
      expect(data.adherence.overallPct).toBe(70);

      // 2. Test missing component renormalization:
      // Delete the workout task so only Diet (50%) exists.
      // Active weight is only Diet (60).
      // Adherence must renormalize to 50% (instead of 30% if unrenormalized).
      await db.execute(
        `DELETE FROM daily_tasks WHERE user_id = ? AND task_key = 'workout:1'`,
        [customUserId]
      );

      const renormalizedRes = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/analytics/users/${customUserId}?days=30`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(renormalizedRes.statusCode).toBe(200);
      const renormalizedData = renormalizedRes.json().data;
      expect(renormalizedData.adherence.byType.diet.ratePct).toBe(50);
      expect(renormalizedData.adherence.byType.workout.ratePct).toBeNull();
      expect(renormalizedData.adherence.overallPct).toBe(50);
    });
  });
});
