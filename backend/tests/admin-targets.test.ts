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
const testDbPath = path.resolve(testDbDir, `fitness_test_targets_${process.pid}_${Date.now()}.db`);

describe('Admin User Targets & Adherence Configuration Suite', () => {
  let app: FastifyInstance;
  let adminToken: string;
  const testUserId = 2; // Seeded athlete user

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
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'admin@fitnessplatform.com',
        password: 'Admin123!',
        deviceName: 'Admin Test Console',
      },
    });

    expect(loginRes.statusCode).toBe(200);
    const json = loginRes.json();
    adminToken = json.data.accessToken;
  });

  afterAll(async () => {
    if (app) await app.close();
    await closeDatabasePool();

    try {
      const filesToDelete = [testDbPath, `${testDbPath}-wal`, `${testDbPath}-shm`];
      for (const file of filesToDelete) {
        if (fs.existsSync(file)) fs.unlinkSync(file);
      }
    } catch {
      // Ignore cleanup error
    }
  });

  describe('1. Cardio Target Configuration (Req #60)', () => {
    let createdTargetId: number;

    it('creates a complete cardio target with all supported fields and weekday mapping', async () => {
      const payload = {
        cardioActivityId: 1, // Treadmill Running
        minDurationMinutes: 25,
        maxDurationMinutes: 45,
        targetSpeedMinKmh: 8.5,
        targetSpeedMaxKmh: 11.0,
        targetInclineMin: 1.0,
        targetInclineMax: 3.5,
        targetDistanceMinKm: 3.0,
        targetDistanceMaxKm: 6.0,
        weekdays: [1, 3, 5], // Mon, Wed, Fri
        effectiveFrom: '2026-09-01',
        effectiveUntil: '2026-12-31',
        notes: 'High incline progression on alternate days',
      };

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/users/${testUserId}/cardio-targets`,
        headers: { Authorization: `Bearer ${adminToken}` },
        payload,
      });

      expect(res.statusCode).toBe(201);
      const json = res.json();
      expect(json.success).toBe(true);
      expect(json.data.id).toBeDefined();
      createdTargetId = json.data.id;
    });

    it('retrieves user cardio targets with populated weekdays array and activity metadata', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/users/${testUserId}/cardio-targets`,
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);

      const target = json.data.find((t: any) => t.id === createdTargetId);
      expect(target).toBeDefined();
      expect(target.min_duration_minutes).toBe(25);
      expect(target.max_duration_minutes).toBe(45);
      expect(target.target_speed_min_kmh).toBe(8.5);
      expect(target.weekdays).toEqual([1, 3, 5]);
      expect(target.activity_name).toBeDefined();
    });

    it('allows admin to list cardio activities metadata', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/cardio/activities',
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.success).toBe(true);
      expect(json.data.length).toBeGreaterThan(0);
      expect(json.data[0].name).toBeDefined();
    });

    it('deletes/deactivates a cardio target', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/v1/admin/users/${testUserId}/cardio-targets/${createdTargetId}`,
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.success).toBe(true);
    });
  });

  describe('2. Water Quick-Add Configuration (Req #59)', () => {
    it('retrieves water quick-add presets for a user', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/users/${testUserId}/water-quick-add`,
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
    });

    it('updates water quick-add presets with custom validated values and display order', async () => {
      const newPresets = [
        { amountMl: 250, displayOrder: 1, isActive: true },
        { amountMl: 500, displayOrder: 2, isActive: true },
        { amountMl: 750, displayOrder: 3, isActive: true },
        { amountMl: 1000, displayOrder: 4, isActive: true },
      ];

      const res = await app.inject({
        method: 'PUT',
        url: `/api/v1/admin/users/${testUserId}/water-quick-add`,
        headers: { Authorization: `Bearer ${adminToken}` },
        payload: { options: newPresets },
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.success).toBe(true);
      expect(json.data.length).toBe(4);
      expect(json.data.map((o: any) => o.amount_ml)).toEqual([250, 500, 750, 1000]);
    });

    it('rejects out-of-range water quick add presets (< 50ml or > 5000ml)', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: `/api/v1/admin/users/${testUserId}/water-quick-add`,
        headers: { Authorization: `Bearer ${adminToken}` },
        payload: { options: [10, 500] },
      });

      expect(res.statusCode).toBe(400);
    });

    it('returns empty array without synthetic 250/500/750ml defaults in daily plan when user has no configured options', async () => {
      const db = getDatabasePool();
      const passwordHash = await bcrypt.hash('NoQuickAdd123!', 10);
      const userRes = await db.execute(
        `INSERT INTO users (email, password_hash, first_name, last_name, role_id, status)
         VALUES ('user_no_quick_add@test.com', ?, 'NoQuick', 'Add', 3, 'active')`,
        [passwordHash]
      );
      const newUserId = userRes.insertId;

      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'user_no_quick_add@test.com',
          password: 'NoQuickAdd123!',
          deviceName: 'Phone',
        },
      });
      expect(loginRes.statusCode).toBe(200);
      const userToken = loginRes.json().data.accessToken;

      const todayRes = await app.inject({
        method: 'GET',
        url: '/api/v1/me/today',
        headers: { Authorization: `Bearer ${userToken}` },
      });
      expect(todayRes.statusCode).toBe(200);
      const data = todayRes.json().data;
      expect(Array.isArray(data.water.quickAdds)).toBe(true);
      expect(data.water.quickAdds).toEqual([]);
    });

    it('returns real configured quick-add options and excludes inactive presets in daily plan', async () => {
      const db = getDatabasePool();
      const passwordHash = await bcrypt.hash('ConfigQuickAdd123!', 10);
      const userRes = await db.execute(
        `INSERT INTO users (email, password_hash, first_name, last_name, role_id, status)
         VALUES ('user_custom_quick_add@test.com', ?, 'CustomQuick', 'Add', 3, 'active')`,
        [passwordHash]
      );
      const newUserId = userRes.insertId;

      // Configure custom presets: 350ml (active), 700ml (active), 1500ml (inactive)
      await db.execute(
        `INSERT INTO user_water_quick_add_options (user_id, amount_ml, display_order, is_active)
         VALUES (?, 350, 1, 1), (?, 700, 2, 1), (?, 1500, 3, 0)`,
        [newUserId, newUserId, newUserId]
      );

      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'user_custom_quick_add@test.com',
          password: 'ConfigQuickAdd123!',
          deviceName: 'Phone',
        },
      });
      expect(loginRes.statusCode).toBe(200);
      const userToken = loginRes.json().data.accessToken;

      const todayRes = await app.inject({
        method: 'GET',
        url: '/api/v1/me/today',
        headers: { Authorization: `Bearer ${userToken}` },
      });
      expect(todayRes.statusCode).toBe(200);
      const data = todayRes.json().data;
      expect(data.water.quickAdds.length).toBe(2);
      expect(data.water.quickAdds.map((q: any) => q.amount_ml)).toEqual([350, 700]);
    });
  });

  describe('3. Per-User Adherence Configuration & 100% Validation (Req #61)', () => {
    it('retrieves default or active adherence configuration', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/users/${testUserId}/adherence-config`,
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.success).toBe(true);
      expect(json.data.diet_weight_pct).toBeDefined();
      expect(json.data.workout_weight_pct).toBeDefined();
      expect(json.data.cardio_weight_pct).toBeDefined();
      expect(json.data.water_weight_pct).toBeDefined();
      expect(json.data.weight_logging_weight_pct).toBeDefined();
    });

    it('rejects adherence configuration when total is not exactly 100%', async () => {
      const invalidPayload = {
        dietWeightPct: 40,
        workoutWeightPct: 30,
        cardioWeightPct: 20,
        waterWeightPct: 10,
        weightLoggingWeightPct: 5, // Sum = 105%
      };

      const res = await app.inject({
        method: 'PUT',
        url: `/api/v1/admin/users/${testUserId}/adherence-config`,
        headers: { Authorization: `Bearer ${adminToken}` },
        payload: invalidPayload,
      });

      expect(res.statusCode).toBe(400);
      const json = res.json();
      expect(json.message || json.error?.message).toMatch(/100%/);
    });

    it('accepts and persists valid adherence configuration with total = 100%', async () => {
      const validPayload = {
        dietWeightPct: 40,
        workoutWeightPct: 30,
        cardioWeightPct: 15,
        waterWeightPct: 10,
        weightLoggingWeightPct: 5, // Sum = 100%
      };

      const res = await app.inject({
        method: 'PUT',
        url: `/api/v1/admin/users/${testUserId}/adherence-config`,
        headers: { Authorization: `Bearer ${adminToken}` },
        payload: validPayload,
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.success).toBe(true);
      expect(json.data.diet_weight_pct).toBe(40);
      expect(json.data.workout_weight_pct).toBe(30);
      expect(json.data.cardio_weight_pct).toBe(15);
      expect(json.data.water_weight_pct).toBe(10);
      expect(json.data.weight_logging_weight_pct).toBe(5);
    });
  });

  describe('4. Comprehensive User Monitoring Dossier Verification', () => {
    it('returns cardio targets with weekdays, water quick adds, and adherence config in dossier', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/users/${testUserId}/monitoring`,
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.success).toBe(true);
      const { goals } = json.data;
      expect(goals.water).toBeDefined();
      expect(goals.weight).toBeDefined();
      expect(goals.cardio).toBeDefined();
      expect(goals.waterQuickAdd).toBeDefined();
      expect(goals.adherenceConfig).toBeDefined();
    });
  });

  describe('5. Effective-Date Bounded Targets & Adherence Configuration', () => {
    it('isolates future and expired water targets from today and resolves correct as-of date targets', async () => {
      const db = getDatabasePool();
      const passwordHash = await bcrypt.hash('EffectivePass123!', 10);
      const userRes = await db.execute(
        `INSERT INTO users (email, password_hash, first_name, last_name, role_id, status)
         VALUES ('user_effective_water@test.com', ?, 'EffWater', 'User', 3, 'active')`,
        [passwordHash]
      );
      const effUserId = userRes.insertId;

      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'user_effective_water@test.com',
          password: 'EffectivePass123!',
          deviceName: 'Phone',
        },
      });
      expect(loginRes.statusCode).toBe(200);
      const effUserToken = loginRes.json().data.accessToken;

      // 1. Create an expired water target (2020-01-01 to 2020-12-31, 4500 ml)
      await app.inject({
        method: 'POST',
        url: `/api/v1/admin/users/${effUserId}/water-targets`,
        headers: { Authorization: `Bearer ${adminToken}` },
        payload: {
          dailyTargetMl: 4500,
          effectiveFrom: '2020-01-01',
          effectiveUntil: '2020-12-31',
        },
      });

      // 2. Create a future water target (starting 2099-01-01, 5000 ml)
      await app.inject({
        method: 'POST',
        url: `/api/v1/admin/users/${effUserId}/water-targets`,
        headers: { Authorization: `Bearer ${adminToken}` },
        payload: {
          dailyTargetMl: 5000,
          effectiveFrom: '2099-01-01',
        },
      });

      // 3. For today: user has NO active water target (neither expired nor future applies)
      const todayRes = await app.inject({
        method: 'GET',
        url: '/api/v1/me/today',
        headers: { Authorization: `Bearer ${effUserToken}` },
      });
      expect(todayRes.statusCode).toBe(200);
      expect(todayRes.json().data.water.targetMl).toBeNull();

      const goalsRes = await app.inject({
        method: 'GET',
        url: '/api/v1/me/goals',
        headers: { Authorization: `Bearer ${effUserToken}` },
      });
      expect(goalsRes.statusCode).toBe(200);
      expect(goalsRes.json().data.waterTarget).toBeNull();

      // 4. For historical date (2020-06-15): resolves expired 4500 ml target
      const pastDayRes = await app.inject({
        method: 'GET',
        url: '/api/v1/me/days/2020-06-15',
        headers: { Authorization: `Bearer ${effUserToken}` },
      });
      expect(pastDayRes.statusCode).toBe(200);
      expect(pastDayRes.json().data.water.targetMl).toBe(4500);

      // 5. For future date (2099-01-05): resolves future 5000 ml target
      const futureDayRes = await app.inject({
        method: 'GET',
        url: '/api/v1/me/days/2099-01-05',
        headers: { Authorization: `Bearer ${effUserToken}` },
      });
      expect(futureDayRes.statusCode).toBe(200);
      expect(futureDayRes.json().data.water.targetMl).toBe(5000);
    });

    it('isolates future adherence weights from current adherence and historical analytics', async () => {
      const db = getDatabasePool();
      const passwordHash = await bcrypt.hash('EffectiveAdh123!', 10);
      const userRes = await db.execute(
        `INSERT INTO users (email, password_hash, first_name, last_name, role_id, status)
         VALUES ('user_effective_adh@test.com', ?, 'EffAdh', 'User', 3, 'active')`,
        [passwordHash]
      );
      const effUserId = userRes.insertId;

      const today = new Date().toISOString().slice(0, 10);

      // 1. Set current active adherence config: 50% diet, 50% workout, 0% cardio, 0% water, 0% weight (effective today)
      await app.inject({
        method: 'POST',
        url: `/api/v1/admin/users/${effUserId}/adherence-config`,
        headers: { Authorization: `Bearer ${adminToken}` },
        payload: {
          dietWeightPct: 50,
          workoutWeightPct: 50,
          cardioWeightPct: 0,
          waterWeightPct: 0,
          weightLoggingWeightPct: 0,
          effectiveFrom: '2020-01-01',
        },
      });

      // 2. Set future adherence config: 100% water, 0% others (effective 2099-01-01)
      await app.inject({
        method: 'POST',
        url: `/api/v1/admin/users/${effUserId}/adherence-config`,
        headers: { Authorization: `Bearer ${adminToken}` },
        payload: {
          dietWeightPct: 0,
          workoutWeightPct: 0,
          cardioWeightPct: 0,
          waterWeightPct: 100,
          weightLoggingWeightPct: 0,
          effectiveFrom: '2099-01-01',
        },
      });

      // 3. Admin query without date query param resolves current active config (50/50)
      const currentConfigRes = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/users/${effUserId}/adherence-config`,
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      expect(currentConfigRes.statusCode).toBe(200);
      expect(currentConfigRes.json().data.diet_weight_pct).toBe(50);
      expect(currentConfigRes.json().data.workout_weight_pct).toBe(50);
      expect(currentConfigRes.json().data.water_weight_pct).toBe(0);

      // 4. Admin query with ?date=2099-02-01 resolves future config (100% water)
      const futureConfigRes = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/users/${effUserId}/adherence-config?date=2099-02-01`,
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      expect(futureConfigRes.statusCode).toBe(200);
      expect(futureConfigRes.json().data.water_weight_pct).toBe(100);
      expect(futureConfigRes.json().data.diet_weight_pct).toBe(0);

      // 5. Insert today task: 1 diet task completed (100% diet) and 1 workout task pending (0% workout)
      // Under current 50/50 config: overall = (1.0 * 50 + 0 * 50) = 50%
      // Under future 100% water config: (water = null, diet/workout = 0 weight => 0% or null)
      await db.execute(
        `INSERT INTO daily_tasks (user_id, task_date, task_key, task_type, title_snapshot, scheduled_at, due_at, status)
         VALUES (?, ?, 'meal:1', 'diet', 'Breakfast', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'completed'),
                (?, ?, 'workout:1', 'workout', 'Legs', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'pending')`,
        [effUserId, today, effUserId, today]
      );

      const analyticsRes = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/analytics/users/${effUserId}?days=30`,
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      expect(analyticsRes.statusCode).toBe(200);
      const data = analyticsRes.json().data;
      expect(data.adherence.overallPct).toBe(50); // Correctly evaluated under 50/50 current weights
    });
  });
});
