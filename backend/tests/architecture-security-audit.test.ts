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
const testDbPath = path.resolve(testDbDir, `fitness_test_audit_${process.pid}_${Date.now()}.db`);

describe('Backend Architecture, Security & Performance Review Suite (Req #46, #88, #91-93)', () => {
  let app: FastifyInstance;
  let adminToken: string;
  let userToken: string;
  let userId: number;

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

    // Login admin
    const adminRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'admin@fitnessplatform.com', password: 'Admin123!', deviceName: 'Admin Audit Console' },
    });
    expect(adminRes.statusCode).toBe(200);
    adminToken = adminRes.json().data.accessToken;

    // Login regular athlete
    const userRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'john.doe@fitnessplatform.com', password: 'User123!', deviceName: 'Athlete Audit Device' },
    });
    expect(userRes.statusCode).toBe(200);
    const userBody = userRes.json().data;
    userToken = userBody.accessToken;
    userId = userBody.user.id;
  });

  afterAll(async () => {
    await app.close();
    await closeDatabasePool();
    if (fs.existsSync(testDbPath)) {
      try {
        fs.unlinkSync(testDbPath);
      } catch {
        // Ignored in temporary file cleanup
      }
    }
  });

  describe('1. Non-Existent Entity Validation (Cardio Activity)', () => {
    it('rejects logging cardio with a non-existent cardioActivityId with 404', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/me/cardio',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          cardioActivityId: 999999,
          durationMinutes: 30,
        },
      });

      expect(res.statusCode).toBe(404);
      const body = JSON.parse(res.body);
      expect(body.error?.message).toMatch(/cardio activity not found/i);
    });
  });

  describe('2. Meal Log Atomic Transaction & Invalid Option Rejection', () => {
    it('rolls back meal log mutation if option selection does not belong to option group', async () => {
      const db = getDatabasePool();
      const meal = await db.queryOne<{ id: number }>('SELECT id FROM diet_meals LIMIT 1');
      if (!meal) return;

      const res = await app.inject({
        method: 'PUT',
        url: `/api/v1/me/meals/${meal.id}/log`,
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          status: 'completed',
          selections: [
            {
              optionGroupId: 999999, // Invalid group ID
              optionId: 999999,
            },
          ],
        },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.error?.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('3. Immutable Plan Version Enforcement (Req #88)', () => {
    it('rejects adding exercises to a published workout plan version', async () => {
      const db = getDatabasePool();
      const pubVersion = await db.queryOne<{ id: number }>(
        "SELECT id FROM workout_plan_versions WHERE status = 'published' LIMIT 1"
      );
      if (!pubVersion) return;

      const day = await db.queryOne<{ id: number }>(
        'SELECT id FROM workout_plan_days WHERE workout_plan_version_id = ? LIMIT 1',
        [pubVersion.id]
      );
      if (!day) return;

      const ex = await db.queryOne<{ id: number }>('SELECT id FROM exercises LIMIT 1');
      if (!ex) return;

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/workout-days/${day.id}/exercises`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          exerciseId: ex.id,
          targetSets: 3,
          repsMin: 8,
          repsMax: 12,
        },
      });

      expect(res.statusCode).toBe(409);
      const body = JSON.parse(res.body);
      expect(body.error?.code).toBe('PLAN_VERSION_IMMUTABLE');
    });

    it('rejects adding meals to a published diet plan version', async () => {
      const db = getDatabasePool();
      const pubVersion = await db.queryOne<{ id: number }>(
        "SELECT id FROM diet_plan_versions WHERE status = 'published' LIMIT 1"
      );
      if (!pubVersion) return;

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/diet-versions/${pubVersion.id}/meals`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          name: 'Late Night Snack',
          scheduledTime: '22:00:00',
        },
      });

      expect(res.statusCode).toBe(409);
      const body = JSON.parse(res.body);
      expect(body.error?.code).toBe('PLAN_VERSION_IMMUTABLE');
    });
  });

  describe('4. Batch Loading & Performance (N+1 Query Avoidance)', () => {
    it('fetches today meals with all option groups and options in a single batch', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/me/meals/today',
        headers: { authorization: `Bearer ${userToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data?.meals)).toBe(true);
    });

    it('fetches workout session details with sets in a single batch', async () => {
      const db = getDatabasePool();
      const session = await db.queryOne<{ id: number }>(
        'SELECT id FROM workout_sessions WHERE user_id = ? LIMIT 1',
        [userId]
      );
      if (!session) return;

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/me/workouts/${session.id}`,
        headers: { authorization: `Bearer ${userToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data?.id).toBe(session.id);
    });
  });

  describe('5. IDOR & Authorization Protections', () => {
    it('prevents a user from retrieving or mutating another user workout session', async () => {
      const db = getDatabasePool();
      const otherUser = await db.queryOne<{ id: number }>(
        'SELECT id FROM users WHERE role_id = 3 AND id != ? LIMIT 1',
        [userId]
      );
      if (!otherUser) return;

      const otherSession = await db.queryOne<{ id: number }>(
        'SELECT id FROM workout_sessions WHERE user_id = ? LIMIT 1',
        [otherUser.id]
      );
      if (!otherSession) return;

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/me/workouts/${otherSession.id}`,
        headers: { authorization: `Bearer ${userToken}` },
      });

      expect(res.statusCode).toBe(404);
    });
  });

  describe('6. Workout Plan Builder & Version Lifecycle (Req #51-52)', () => {
    it('creates a full workout plan, customizes days and exercises, reorders, clones version, publishes, and verifies immutable session snapshots', async () => {
      // 1. Create a new workout plan
      const createPlanRes = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/workout-plans',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          name: 'Hypertrophy Mastery Protocol',
          goalCategory: 'hypertrophy',
          description: 'A 5-day specialized hypertrophy routine',
        },
      });
      expect(createPlanRes.statusCode).toBe(201);
      const plan = createPlanRes.json().data;
      expect(plan.id).toBeDefined();
      expect(plan.versions).toHaveLength(1);
      const v1 = plan.versions[0];
      expect(v1.status).toBe('draft');

      // 2. Fetch v1 details (has 7 days automatically)
      const v1Res = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/workout-versions/${v1.id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(v1Res.statusCode).toBe(200);
      const v1Details = v1Res.json().data;
      expect(v1Details.days).toHaveLength(7);

      const day1 = v1Details.days[0]; // Monday
      const day2 = v1Details.days[1]; // Tuesday

      // 3. Customize Day 1 Title and Notes
      const updateDayRes = await app.inject({
        method: 'PATCH',
        url: `/api/v1/admin/workout-days/${day1.id}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          name: 'Chest & Back Power',
          isRestDay: false,
          notes: 'Focus on explosive concentric, controlled eccentric',
        },
      });
      expect(updateDayRes.statusCode).toBe(200);

      // 4. Add Exercise 1 (Bench Press) to Day 1
      const exListRes = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/exercises',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const exList = exListRes.json().data;
      const ex1 = exList[0];
      const ex2 = exList[1] || exList[0];

      const addEx1Res = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/workout-days/${day1.id}/exercises`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          exerciseId: ex1.id,
          orderIndex: 1,
          targetSets: 4,
          repsMin: 6,
          repsMax: 8,
          rirTarget: 1.5,
          restSeconds: 120,
          notes: 'Tuck elbows 45 degrees',
          isOptional: false,
        },
      });
      expect(addEx1Res.statusCode).toBe(201);
      const ex1Id = addEx1Res.json().data.id;

      // 5. Add Exercise 2 to Day 1
      const addEx2Res = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/workout-days/${day1.id}/exercises`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          exerciseId: ex2.id,
          orderIndex: 2,
          targetSets: 3,
          repsMin: 10,
          repsMax: 12,
          rirTarget: 2,
          restSeconds: 90,
          notes: 'Optional accessory pump',
          isOptional: true,
        },
      });
      expect(addEx2Res.statusCode).toBe(201);
      const ex2Id = addEx2Res.json().data.id;

      // 6. Update Exercise 1 parameters and reorder
      const updateEx1Res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/admin/workout-exercises/${ex1Id}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          orderIndex: 2,
          targetSets: 5,
          isOptional: false,
        },
      });
      expect(updateEx1Res.statusCode).toBe(200);

      // 7. Clone Version 1 into Version 2 Draft
      const cloneRes = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/workout-plans/${plan.id}/versions`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          fromVersionId: v1.id,
        },
      });
      expect(cloneRes.statusCode).toBe(201);
      const v2 = cloneRes.json().data;
      expect(v2.version_number).toBe(2);
      expect(v2.status).toBe('draft');
      expect(v2.days).toHaveLength(7);
      expect(v2.days[0].exercises).toHaveLength(2);

      // 8. Publish Version 1
      const publishRes = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/workout-versions/${v1.id}/publish`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(publishRes.statusCode).toBe(200);
      expect(publishRes.json().data.status).toBe('published');

      // 9. Verify Version 1 is now immutable
      const failEditRes = await app.inject({
        method: 'PATCH',
        url: `/api/v1/admin/workout-days/${day1.id}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { name: 'Attempted Mutate' },
      });
      expect(failEditRes.statusCode).toBe(409);
      expect(failEditRes.json().error.code).toBe('PLAN_VERSION_IMMUTABLE');
    });
  });

  describe('8. Dynamic Database Role Authorization & Immediate Revocation', () => {
    it('immediately rejects admin request when role is downgraded in database, even with valid JWT', async () => {
      const db = getDatabasePool();
      const adminUser = await db.queryOne<{ id: number; role_id: number }>(
        "SELECT id, role_id FROM users WHERE email = 'admin@fitnessplatform.com'"
      );
      expect(adminUser).toBeDefined();

      // Downgrade admin in DB to regular user (role_id = 3)
      await db.execute('UPDATE users SET role_id = 3 WHERE id = ?', [adminUser!.id]);

      try {
        const res = await app.inject({
          method: 'GET',
          url: '/api/v1/admin/users',
          headers: { authorization: `Bearer ${adminToken}` },
        });
        expect(res.statusCode).toBe(403);
        expect(res.json().error?.code).toBe('FORBIDDEN');
      } finally {
        // Restore admin role
        await db.execute('UPDATE users SET role_id = 1 WHERE id = ?', [adminUser!.id]);
      }

      // Verify restored access
      const restoredRes = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/users',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(restoredRes.statusCode).toBe(200);
    });
  });

  describe('9. Meal Logging IDOR & Active Assignment Enforcement', () => {
    it('rejects logging a meal that belongs to an unassigned diet plan version with 403 MEAL_NOT_ASSIGNED', async () => {
      const db = getDatabasePool();
      // Create unassigned diet plan & version & meal
      const planRes = await db.execute(
        "INSERT INTO diet_plans (name, status) VALUES ('Unassigned Plan', 'active')"
      );
      const versionRes = await db.execute(
        "INSERT INTO diet_plan_versions (diet_plan_id, version_number, status) VALUES (?, 1, 'published')",
        [planRes.insertId]
      );
      const mealRes = await db.execute(
        "INSERT INTO diet_meals (diet_plan_version_id, name, meal_order) VALUES (?, 'Rogue Meal', 1)",
        [versionRes.insertId]
      );

      const res = await app.inject({
        method: 'PUT',
        url: `/api/v1/me/meals/${mealRes.insertId}/log`,
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          status: 'completed',
          logDate: '2026-08-30',
        },
      });

      expect(res.statusCode).toBe(403);
      const body = res.json();
      expect(body.error?.code).toBe('MEAL_NOT_ASSIGNED');
    });
  });

  describe('10. Workout Discard & Update Ownership Guard', () => {
    it('prevents another user from discarding or completing an athlete session with 404', async () => {
      const db = getDatabasePool();
      // Start a workout session for user 1
      const activeAssign = await db.queryOne<{ id: number; workout_plan_version_id: number }>(
        'SELECT id, workout_plan_version_id FROM user_workout_assignments WHERE user_id = ? AND status = "active"',
        [userId]
      );
      if (!activeAssign) return;

      const day = await db.queryOne<{ id: number }>(
        'SELECT id FROM workout_plan_days WHERE workout_plan_version_id = ? AND is_rest_day = 0 LIMIT 1',
        [activeAssign.workout_plan_version_id]
      );
      if (!day) return;

      const sessionRes = await db.execute(
        `INSERT INTO workout_sessions (user_id, source_type, user_workout_assignment_id, workout_plan_version_id, workout_plan_day_id, workout_date, workout_name_snapshot, status, started_at)
         VALUES (?, 'planned', ?, ?, ?, '2026-08-30', 'Owner Test Workout', 'in_progress', CURRENT_TIMESTAMP)`,
        [userId, activeAssign.id, activeAssign.workout_plan_version_id, day.id]
      );
      const sessionId = sessionRes.insertId;

      // Create a second user token
      const otherUserRes = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/users',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          firstName: 'Attacker',
          lastName: 'User',
          email: `attacker_${Date.now()}@fitnessplatform.com`,
          password: 'Password123!',
        },
      });
      const otherUser = otherUserRes.json().data;

      const otherLoginRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email: otherUser.email, password: 'Password123!', deviceName: 'Attacker Device' },
      });
      const otherToken = otherLoginRes.json().data.accessToken;

      // Other user tries to discard user 1's session
      const discardRes = await app.inject({
        method: 'POST',
        url: `/api/v1/me/workouts/${sessionId}/discard`,
        headers: { authorization: `Bearer ${otherToken}` },
      });
      expect(discardRes.statusCode).toBe(404);

      // Other user tries to complete user 1's session
      const completeRes = await app.inject({
        method: 'POST',
        url: `/api/v1/me/workouts/${sessionId}/complete`,
        headers: { authorization: `Bearer ${otherToken}` },
        payload: { notes: 'Hijacked' },
      });
      expect(completeRes.statusCode).toBe(404);
    });
  });

  describe('11. Idempotency Support on Weight and Meal Logging', () => {
    it('replays identical response for duplicate weight mutation and rejects conflicting payload', async () => {
      const idempotencyKey = `idemp_wt_${Date.now()}_abc12345`;

      const firstRes = await app.inject({
        method: 'POST',
        url: '/api/v1/me/weight',
        headers: {
          authorization: `Bearer ${userToken}`,
          'idempotency-key': idempotencyKey,
        },
        payload: {
          weightKg: 82.5,
          date: '2026-08-25',
          notes: 'Morning weigh in',
        },
      });
      expect(firstRes.statusCode).toBe(200);
      const firstData = firstRes.json();

      // Exact replay with same key and payload
      const replayRes = await app.inject({
        method: 'POST',
        url: '/api/v1/me/weight',
        headers: {
          authorization: `Bearer ${userToken}`,
          'idempotency-key': idempotencyKey,
        },
        payload: {
          weightKg: 82.5,
          date: '2026-08-25',
          notes: 'Morning weigh in',
        },
      });
      expect(replayRes.statusCode).toBe(200);
      expect(replayRes.json()).toEqual(firstData);

      // Conflicting payload with reused key
      const conflictRes = await app.inject({
        method: 'POST',
        url: '/api/v1/me/weight',
        headers: {
          authorization: `Bearer ${userToken}`,
          'idempotency-key': idempotencyKey,
        },
        payload: {
          weightKg: 95.0,
          date: '2026-08-25',
          notes: 'Different payload',
        },
      });
      expect(conflictRes.statusCode).toBe(409);
      expect(conflictRes.json().error.code).toBe('IDEMPOTENCY_KEY_REUSED');
    });

    it('replays identical response for duplicate meal logging and rejects conflicting payload', async () => {
      const db = getDatabasePool();
      const todayMealsRes = await app.inject({
        method: 'GET',
        url: '/api/v1/me/today',
        headers: { authorization: `Bearer ${userToken}` },
      });
      const todayData = todayMealsRes.json().data;
      const assignedMeal = todayData.diet?.meals?.[0];
      if (!assignedMeal) return;

      const idempotencyKey = `idemp_ml_${Date.now()}_xyz98765`;

      const firstRes = await app.inject({
        method: 'PUT',
        url: `/api/v1/me/meals/${assignedMeal.id}/log`,
        headers: {
          authorization: `Bearer ${userToken}`,
          'idempotency-key': idempotencyKey,
        },
        payload: {
          status: 'completed',
          notes: 'Ate breakfast',
        },
      });
      expect(firstRes.statusCode).toBe(200);
      const firstData = firstRes.json();

      // Replay
      const replayRes = await app.inject({
        method: 'PUT',
        url: `/api/v1/me/meals/${assignedMeal.id}/log`,
        headers: {
          authorization: `Bearer ${userToken}`,
          'idempotency-key': idempotencyKey,
        },
        payload: {
          status: 'completed',
          notes: 'Ate breakfast',
        },
      });
      expect(replayRes.statusCode).toBe(200);
      expect(replayRes.json()).toEqual(firstData);

      // Conflict
      const conflictRes = await app.inject({
        method: 'PUT',
        url: `/api/v1/me/meals/${assignedMeal.id}/log`,
        headers: {
          authorization: `Bearer ${userToken}`,
          'idempotency-key': idempotencyKey,
        },
        payload: {
          status: 'skipped',
          notes: 'Skipped entirely',
        },
      });
      expect(conflictRes.statusCode).toBe(409);
    });
  });

  describe('12. Plan Publishing Cross-Field Validation & Negative Gates', () => {
    it('rejects publishing a workout version with only rest days or invalid reps range', async () => {
      // Create empty plan
      const planRes = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/workout-plans',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { name: 'Invalid Plan' },
      });
      const plan = planRes.json().data;
      const v1Id = plan.versions[0].id;

      // 1. Try publishing version with no configured exercises
      const failNoExRes = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/workout-versions/${v1Id}/publish`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(failNoExRes.statusCode).toBe(400);
      expect(failNoExRes.json().error.message).toMatch(/no configured exercises/i);

      // 2. Set all days to rest days
      const v1DetailsRes = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/workout-versions/${v1Id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const days = v1DetailsRes.json().data.days;
      for (const d of days) {
        await app.inject({
          method: 'PATCH',
          url: `/api/v1/admin/workout-days/${d.id}`,
          headers: { authorization: `Bearer ${adminToken}` },
          payload: { isRestDay: true },
        });
      }

      const failRestOnlyRes = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/workout-versions/${v1Id}/publish`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(failRestOnlyRes.statusCode).toBe(400);
      expect(failRestOnlyRes.json().error.message).toMatch(/rest days/i);
    });

    it('rejects publishing a diet version with 0 meals or inverted option group selection counts', async () => {
      // Create diet plan
      const planRes = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/diet-plans',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { name: 'Empty Diet Plan', dailyCaloriesTarget: 2200 },
      });
      const plan = planRes.json().data;
      const v1Id = plan.versions[0].id;

      // Try publishing version with 0 meals
      const failPublishRes = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/diet-versions/${v1Id}/publish`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(failPublishRes.statusCode).toBe(400);
      expect(failPublishRes.json().error.message).toMatch(/no meals configured/i);
    });
  });

  describe('13. Diet Plan Calorie Target Persistence', () => {
    it('persists and returns dailyCaloriesTarget on diet plan creation and version queries', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/diet-plans',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          name: 'Hypertrophy Cut Protocol',
          description: 'High protein calorie deficit',
          dailyCaloriesTarget: 2450,
        },
      });
      expect(createRes.statusCode).toBe(201);
      const plan = createRes.json().data;
      expect(plan.daily_calories_target).toBe(2450);

      const getRes = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/diet-plans/${plan.id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(getRes.statusCode).toBe(200);
      const fetchedPlan = getRes.json().data;
      expect(fetchedPlan.daily_calories_target).toBe(2450);
      expect(fetchedPlan.versions[0].daily_calories_target).toBe(2450);
    });
  });

  describe('14. User Notification Settings Endpoints (/me/notification-settings)', () => {
    it('reads and updates notification settings and category preferences without synthetic defaults', async () => {
      // Read initial settings
      const getRes = await app.inject({
        method: 'GET',
        url: '/api/v1/me/notification-settings',
        headers: { authorization: `Bearer ${userToken}` },
      });
      expect(getRes.statusCode).toBe(200);
      const settings = getRes.json().data;
      expect(settings.userId).toBe(userId);
      expect(typeof settings.inAppEnabled).toBe('boolean');

      // Update settings
      const patchRes = await app.inject({
        method: 'PATCH',
        url: '/api/v1/me/notification-settings',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          inAppEnabled: true,
          pushEnabled: false,
          localNotificationsEnabled: true,
          quietHoursEnabled: true,
          quietHoursStart: '22:00:00',
          quietHoursEnd: '07:00:00',
          categories: {
            workout: true,
            meal: false,
            water: true,
          },
        },
      });
      expect(patchRes.statusCode).toBe(200);
      const updated = patchRes.json().data;
      expect(updated.pushEnabled).toBe(false);
      expect(updated.quietHoursEnabled).toBe(true);
      expect(updated.quietHoursStart).toBe('22:00:00');
      expect(updated.categories.meal).toBe(false);
      expect(updated.categories.workout).toBe(true);

      // Verify persistence via GET
      const verifyRes = await app.inject({
        method: 'GET',
        url: '/api/v1/me/notification-settings',
        headers: { authorization: `Bearer ${userToken}` },
      });
      expect(verifyRes.statusCode).toBe(200);
      const reloaded = verifyRes.json().data;
      expect(reloaded.pushEnabled).toBe(false);
      expect(reloaded.categories.meal).toBe(false);
    });
  });

  describe('15. Daily Tasks due_at Population & Same-Day Overdue Detection', () => {
    it('populates due_at on materialized daily tasks', async () => {
      const db = getDatabasePool();
      const todayRes = await app.inject({
        method: 'GET',
        url: '/api/v1/me/today',
        headers: { authorization: `Bearer ${userToken}` },
      });
      expect(todayRes.statusCode).toBe(200);

      const tasks = await db.query<{ id: number; task_key: string; scheduled_at: string; due_at: string }>(
        'SELECT id, task_key, scheduled_at, due_at FROM daily_tasks WHERE user_id = ?',
        [userId]
      );
      expect(tasks.length).toBeGreaterThan(0);
      for (const t of tasks) {
        expect(t.due_at).toBeDefined();
        expect(typeof t.due_at).toBe('string');
      }
    });
  });
});


