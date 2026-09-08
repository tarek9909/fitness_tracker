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
const testDbPath = path.resolve(testDbDir, `crud_lifecycle_${process.pid}_${Date.now()}.db`);

describe('Workout & Diet Plans Dedicated Lifecycle, Ownership & Transactional Rollback Suite', () => {
  let app: FastifyInstance;
  let johnToken: string;
  let janeToken: string;
  let johnId: number;
  let janeId: number;
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

    const bcryptModule = await import('bcryptjs');
    const bcrypt = bcryptModule.default || bcryptModule;
    const userHash = await bcrypt.hash('User123!', 10);
    const db = getDatabasePool();

    await db.execute('UPDATE users SET password_hash = ? WHERE email = ?', [userHash, 'john.doe@fitnessplatform.com']);
    await db.execute(
      `INSERT INTO users (role_id, first_name, last_name, email, password_hash, status)
       VALUES (3, 'Jane', 'Smith', 'jane.lifecycle@fitnessplatform.com', ?, 'active')`,
      [userHash]
    );

    const users = await db.query<any>('SELECT id, email FROM users');
    johnId = users.find(u => u.email === 'john.doe@fitnessplatform.com').id;
    janeId = users.find(u => u.email === 'jane.lifecycle@fitnessplatform.com').id;

    app = await buildApp();
    await app.ready();

    // Login John
    const johnRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'john.doe@fitnessplatform.com', password: 'User123!' },
    });
    johnToken = johnRes.json().data.accessToken;

    // Login Jane
    const janeRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'jane.lifecycle@fitnessplatform.com', password: 'User123!' },
    });
    janeToken = janeRes.json().data.accessToken;
  });

  afterAll(async () => {
    if (app) await app.close();
    await closeDatabasePool();
    env.dbClient = origDbClient;
    resetDatabasePool();
    if (fs.existsSync(testDbPath)) {
      try { fs.unlinkSync(testDbPath); } catch {}
    }
  });

  describe('1. Workout Plan Full Field CRUD, Ordering, and Structural Validation', () => {
    let workoutPlanId: number;
    let versionId: number;
    let day1Id: number;
    let day2Id: number;
    let ex1Id: number;
    let ex2Id: number;

    it('creates a private workout plan with complete metadata fields', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/me/workout-plans',
        headers: { authorization: `Bearer ${johnToken}` },
        payload: {
          name: 'Advanced Strength Protocol',
          description: 'Periodized compound strength routine',
          goalCategory: 'strength',
        },
      });
      expect(res.statusCode).toBe(201);
      const plan = res.json().data;
      expect(plan.id).toBeDefined();
      expect(plan.owner_user_id).toBe(johnId);
      expect(plan.name).toBe('Advanced Strength Protocol');
      expect(plan.goal_category).toBe('strength');
      workoutPlanId = plan.id;
      versionId = plan.versions[0].id;
    });

    it('updates workout plan metadata', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: `/api/v1/me/workout-plans/${workoutPlanId}`,
        headers: { authorization: `Bearer ${johnToken}` },
        payload: {
          name: 'Elite Powerlifting Protocol',
          description: 'Updated periodized powerlifting routine',
          goalCategory: 'powerlifting',
        },
      });
      expect(res.statusCode).toBe(200);
      const plan = res.json().data;
      expect(plan.name).toBe('Elite Powerlifting Protocol');
    });

    it('adds and updates days with full fields (weekdayNumber, name, isRestDay, notes, orderIndex)', async () => {
      // Day 1: Heavy Bench Day
      const day1Res = await app.inject({
        method: 'POST',
        url: `/api/v1/me/workout-plans/${workoutPlanId}/versions/${versionId}/days`,
        headers: { authorization: `Bearer ${johnToken}` },
        payload: {
          weekdayNumber: 1,
          name: 'Heavy Bench Press',
          isRestDay: false,
          notes: 'Warm up shoulders thoroughly',
          orderIndex: 1,
        },
      });
      expect(day1Res.statusCode).toBe(201);
      day1Id = day1Res.json().data.id;

      // Day 2: Rest & Mobility
      const day2Res = await app.inject({
        method: 'POST',
        url: `/api/v1/me/workout-plans/${workoutPlanId}/versions/${versionId}/days`,
        headers: { authorization: `Bearer ${johnToken}` },
        payload: {
          weekdayNumber: 2,
          name: 'Active Rest Day',
          isRestDay: true,
          notes: '30 min brisk walk and foam roll',
          orderIndex: 2,
        },
      });
      expect(day2Res.statusCode).toBe(201);
      day2Id = day2Res.json().data.id;

      // Update Day 1 metadata
      const updateDayRes = await app.inject({
        method: 'PUT',
        url: `/api/v1/me/workout-plans/${workoutPlanId}/days/${day1Id}`,
        headers: { authorization: `Bearer ${johnToken}` },
        payload: {
          name: 'Heavy Bench & Accessory Day',
          notes: 'Use chalk and wrist wraps',
        },
      });
      expect(updateDayRes.statusCode).toBe(200);
    });

    it('adds and updates exercises with all optional and target configuration fields', async () => {
      // Exercise 1: Barbell Bench Press
      const ex1Res = await app.inject({
        method: 'POST',
        url: `/api/v1/me/workout-plans/${workoutPlanId}/days/${day1Id}/exercises`,
        headers: { authorization: `Bearer ${johnToken}` },
        payload: {
          exerciseId: 1,
          targetSets: 5,
          repsMin: 5,
          repsMax: 5,
          targetWeightKg: 100,
          restSeconds: 180,
          notes: 'RPE 8-9 on working sets',
          orderIndex: 1,
        },
      });
      expect(ex1Res.statusCode).toBe(201);
      ex1Id = ex1Res.json().data.id;

      // Exercise 2: Triceps Pushdown
      const ex2Res = await app.inject({
        method: 'POST',
        url: `/api/v1/me/workout-plans/${workoutPlanId}/days/${day1Id}/exercises`,
        headers: { authorization: `Bearer ${johnToken}` },
        payload: {
          exerciseId: 2,
          targetSets: 3,
          repsMin: 10,
          repsMax: 15,
          restSeconds: 90,
          notes: 'Controlled eccentric tempo',
          orderIndex: 2,
        },
      });
      expect(ex2Res.statusCode).toBe(201);
      ex2Id = ex2Res.json().data.id;

      // Update Exercise 1
      const updateExRes = await app.inject({
        method: 'PUT',
        url: `/api/v1/me/workout-plans/${workoutPlanId}/exercises/${ex1Id}`,
        headers: { authorization: `Bearer ${johnToken}` },
        payload: {
          targetSets: 4,
          repsMin: 6,
          repsMax: 8,
          notes: 'Deload week: RPE 7',
        },
      });
      // Verify sets were generated in workout_plan_exercise_sets table
      const pool = getDatabasePool();
      const createdSets = await pool.query(
        'SELECT * FROM workout_plan_exercise_sets WHERE workout_plan_exercise_id = ? ORDER BY set_number ASC',
        [ex1Id],
      );
      expect(createdSets.length).toBe(4);

      // Verify repository replaceExerciseSets fallback handling for legacy schema
      const { WorkoutPlanRepository } = await import('../src/modules/workout-plans/workout-plan.repository.js');
      const repo = new WorkoutPlanRepository(pool);
      const executedSqls: string[] = [];
      const mockConn: any = {
        execute: async (sql: string, params?: any[]) => {
          executedSqls.push(sql);
          if (sql.includes('target_reps_min')) {
            const err: any = new Error("Unknown column 'target_reps_min' in 'field list'");
            err.code = 'ER_BAD_FIELD_ERROR';
            throw err;
          }
          return { affectedRows: 1 };
        },
      };
      await repo.replaceExerciseSets(ex1Id, [
        { setNumber: 1, targetRepsMin: 8, targetRepsMax: 12, targetWeightKg: 50, restSeconds: 60, notes: 'legacy set' },
      ], mockConn);
      expect(executedSqls.some((s) => s.includes('target_reps'))).toBe(true);
    });

    it('enforces strict ownership checks on workout plan access and modifications', async () => {
      // Jane tries to view John's plan
      const getRes = await app.inject({
        method: 'GET',
        url: `/api/v1/me/workout-plans/${workoutPlanId}`,
        headers: { authorization: `Bearer ${janeToken}` },
      });
      expect(getRes.statusCode).toBe(403);

      // Jane tries to update John's plan
      const putRes = await app.inject({
        method: 'PUT',
        url: `/api/v1/me/workout-plans/${workoutPlanId}`,
        headers: { authorization: `Bearer ${janeToken}` },
        payload: { name: 'Jane Hijacked Plan' },
      });
      expect(putRes.statusCode).toBe(403);

      // Jane tries to add exercise to John's day
      const addExRes = await app.inject({
        method: 'POST',
        url: `/api/v1/me/workout-plans/${workoutPlanId}/days/${day1Id}/exercises`,
        headers: { authorization: `Bearer ${janeToken}` },
        payload: { exerciseId: 1, targetSets: 3 },
      });
      expect(addExRes.statusCode).toBe(403);

      // Jane tries to publish John's version
      const pubRes = await app.inject({
        method: 'POST',
        url: `/api/v1/me/workout-plans/${workoutPlanId}/versions/${versionId}/publish`,
        headers: { authorization: `Bearer ${janeToken}` },
      });
      expect(pubRes.statusCode).toBe(403);
    });

    it('publishes the plan and supports authorized in-place edits', async () => {
      const pubRes = await app.inject({
        method: 'POST',
        url: `/api/v1/me/workout-plans/${workoutPlanId}/versions/${versionId}/publish`,
        headers: { authorization: `Bearer ${johnToken}` },
      });
      expect(pubRes.statusCode).toBe(200);
      expect(pubRes.json().data.status).toBe('published');

      // Authorized in-place update on published day
      const editDayRes = await app.inject({
        method: 'PUT',
        url: `/api/v1/me/workout-plans/${workoutPlanId}/days/${day1Id}`,
        headers: { authorization: `Bearer ${johnToken}` },
        payload: { name: 'Published Bench Session' },
      });
      expect(editDayRes.statusCode).toBe(200);

      // Authorized in-place addition of exercise to published day
      const addPublishedExRes = await app.inject({
        method: 'POST',
        url: `/api/v1/me/workout-plans/${workoutPlanId}/days/${day1Id}/exercises`,
        headers: { authorization: `Bearer ${johnToken}` },
        payload: {
          exerciseId: 1,
          targetSets: 3,
          repsMin: 12,
          repsMax: 15,
        },
      });
      expect(addPublishedExRes.statusCode).toBe(201);
    });

    it('rolls back transaction on structural integrity violation in published workout plan', async () => {
      // Attempting to add an exercise with invalid rep range (repsMax < repsMin)
      const invalidExRes = await app.inject({
        method: 'POST',
        url: `/api/v1/me/workout-plans/${workoutPlanId}/days/${day1Id}/exercises`,
        headers: { authorization: `Bearer ${johnToken}` },
        payload: {
          exerciseId: 1,
          targetSets: 3,
          repsMin: 20,
          repsMax: 10, // Invalid: max < min
        },
      });
      expect(invalidExRes.statusCode).toBe(400);
      expect(invalidExRes.json().error.code).toBe('VALIDATION_ERROR');

      // Verify transaction rolled back: the invalid exercise was not persisted
      const db = getDatabasePool();
      const invalidEx = await db.queryOne<any>(
        'SELECT id FROM workout_plan_exercises WHERE workout_plan_day_id = ? AND target_reps_min = 20 AND target_reps_max = 10',
        [day1Id]
      );
      expect(invalidEx).toBeNull();
    });

    it('activates the published plan and confirms reflection on /me/today', async () => {
      const actRes = await app.inject({
        method: 'POST',
        url: `/api/v1/me/workout-plans/${workoutPlanId}/activate`,
        headers: { authorization: `Bearer ${johnToken}` },
      });
      expect(actRes.statusCode).toBe(200);
      expect(actRes.json().data.workoutPlanId).toBe(workoutPlanId);

      const todayRes = await app.inject({
        method: 'GET',
        url: '/api/v1/me/today',
        headers: { authorization: `Bearer ${johnToken}` },
      });
      expect(todayRes.statusCode).toBe(200);
      expect(todayRes.json().data.activeWorkoutAssignment.workout_plan_version_id).toBe(versionId);
    });

    it('executes a workout session from the activated plan (start -> log set -> complete -> verify history)', async () => {
      // 1. Start workout session
      const startRes = await app.inject({
        method: 'POST',
        url: '/api/v1/me/workouts/start',
        headers: { authorization: `Bearer ${johnToken}` },
        payload: { workoutPlanDayId: day1Id },
      });
      expect(startRes.statusCode).toBe(201);
      const sessionData = startRes.json().data;
      expect(sessionData.id).toBeDefined();
      expect(sessionData.status).toBe('in_progress');
      expect(sessionData.exercises.length).toBeGreaterThan(0);
      const sessionId = sessionData.id;
      const sessionExId = sessionData.exercises[0].id;

      // 2. Log a set
      const setRes = await app.inject({
        method: 'POST',
        url: `/api/v1/me/workouts/${sessionId}/sets`,
        headers: { authorization: `Bearer ${johnToken}` },
        payload: {
          sessionExerciseId: sessionExId,
          setNumber: 1,
          weightKg: 100,
          reps: 5,
          completed: true,
        },
      });
      expect(setRes.statusCode).toBe(200);

      // 3. Complete workout
      const completeRes = await app.inject({
        method: 'POST',
        url: `/api/v1/me/workouts/${sessionId}/complete`,
        headers: { authorization: `Bearer ${johnToken}` },
        payload: {
          notes: 'Strong bench press session completed',
          rating: 5,
        },
      });
      expect(completeRes.statusCode).toBe(200);
      expect(completeRes.json().data.status).toBe('completed');

      // 4. Verify in history
      const historyRes = await app.inject({
        method: 'GET',
        url: '/api/v1/me/workouts/history',
        headers: { authorization: `Bearer ${johnToken}` },
      });
      expect(historyRes.statusCode).toBe(200);
      const history = historyRes.json().data;
      expect(history.some((s: any) => s.id === sessionId && s.status === 'completed')).toBe(true);
    });
  });

  describe('2. Diet Plan Full Field CRUD, Ordering, Nutrition Calculations, and Structural Validation', () => {
    let dietPlanId: number;
    let dietVersionId: number;
    let meal1Id: number;
    let group1Id: number;
    let opt1Id: number;
    let opt2Id: number;

    it('creates a private diet plan with complete metadata fields', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/me/diet-plans',
        headers: { authorization: `Bearer ${johnToken}` },
        payload: {
          name: 'Lean Bulk Protocol',
          description: 'Controlled caloric surplus with high micronutrient density',
          dailyCaloriesTarget: 2900,
        },
      });
      expect(res.statusCode).toBe(201);
      const plan = res.json().data;
      expect(plan.id).toBeDefined();
      expect(plan.owner_user_id).toBe(johnId);
      expect(plan.name).toBe('Lean Bulk Protocol');
      expect(plan.daily_calories_target).toBe(2900);
      dietPlanId = plan.id;
      dietVersionId = plan.versions[0].id;
    });

    it('adds meals, option groups, and food options with complete fields and calculated nutrition', async () => {
      // 1. Add Breakfast Meal
      const mealRes = await app.inject({
        method: 'POST',
        url: `/api/v1/me/diet-plans/${dietPlanId}/versions/${dietVersionId}/meals`,
        headers: { authorization: `Bearer ${johnToken}` },
        payload: {
          name: 'Power Breakfast',
          scheduledTime: '07:30',
          isRequired: true,
          orderIndex: 1,
          notes: 'Have with 500ml water',
        },
      });
      expect(mealRes.statusCode).toBe(201);
      const meals = mealRes.json().data.meals;
      meal1Id = meals.find((m: any) => m.name === 'Power Breakfast').id;

      // 2. Add Option Group: Main Protein
      const groupRes = await app.inject({
        method: 'POST',
        url: `/api/v1/me/diet-plans/${dietPlanId}/meals/${meal1Id}/option-groups`,
        headers: { authorization: `Bearer ${johnToken}` },
        payload: {
          name: 'Main Protein Source',
          isRequired: true,
          minSelections: 1,
          maxSelections: 1,
          orderIndex: 1,
          notes: 'Choose one primary lean protein',
        },
      });
      expect(groupRes.statusCode).toBe(201);
      group1Id = groupRes.json().data.id;

      // 3. Add Option 1: Whole Eggs
      const opt1Res = await app.inject({
        method: 'POST',
        url: `/api/v1/me/diet-plans/${dietPlanId}/option-groups/${group1Id}/options`,
        headers: { authorization: `Bearer ${johnToken}` },
        payload: {
          foodId: 1,
          customLabel: 'Organic Pastured Eggs',
          servingQuantity: 200,
          servingUnitId: 1,
          isDefault: true,
          orderIndex: 1,
          notes: 'Poached or scrambled in olive oil',
        },
      });
      expect(opt1Res.statusCode).toBe(201);
      opt1Id = opt1Res.json().data.id;
      expect(opt1Id).toBeDefined();

      const db = getDatabasePool();
      const optRow = await db.queryOne<any>('SELECT * FROM diet_meal_options WHERE id = ?', [opt1Id]);
      expect(optRow.label ?? optRow.custom_label).toBe('Organic Pastured Eggs');
      expect(optRow.calories_snapshot ?? optRow.calories).toBeGreaterThan(0);
      expect(optRow.protein_g_snapshot ?? optRow.protein_g).toBeGreaterThan(0);

      // 4. Add Option 2: Greek Yogurt Alternative
      const opt2Res = await app.inject({
        method: 'POST',
        url: `/api/v1/me/diet-plans/${dietPlanId}/option-groups/${group1Id}/options`,
        headers: { authorization: `Bearer ${johnToken}` },
        payload: {
          foodId: 1,
          customLabel: 'Plain Greek Yogurt',
          servingQuantity: 250,
          servingUnitId: 1,
          isDefault: false,
          orderIndex: 2,
          notes: 'Non-fat strained yogurt',
        },
      });
      expect(opt2Res.statusCode).toBe(201);
      opt2Id = opt2Res.json().data.id;
    });

    it('enforces ownership boundary on diet plans', async () => {
      // Jane tries to view John's diet plan
      const getRes = await app.inject({
        method: 'GET',
        url: `/api/v1/me/diet-plans/${dietPlanId}`,
        headers: { authorization: `Bearer ${janeToken}` },
      });
      expect(getRes.statusCode).toBe(403);

      // Jane tries to add a meal to John's diet plan
      const addMealRes = await app.inject({
        method: 'POST',
        url: `/api/v1/me/diet-plans/${dietPlanId}/versions/${dietVersionId}/meals`,
        headers: { authorization: `Bearer ${janeToken}` },
        payload: { name: 'Jane Midnight Feast' },
      });
      expect(addMealRes.statusCode).toBe(403);
    });

    it('publishes the diet plan and allows authorized in-place mutations', async () => {
      const pubRes = await app.inject({
        method: 'POST',
        url: `/api/v1/me/diet-plans/${dietPlanId}/versions/${dietVersionId}/publish`,
        headers: { authorization: `Bearer ${johnToken}` },
      });
      expect(pubRes.statusCode).toBe(200);
      expect(pubRes.json().data.status).toBe('published');

      // Authorized in-place update of meal details
      const updateMealRes = await app.inject({
        method: 'PATCH',
        url: `/api/v1/me/diet-plans/${dietPlanId}/meals/${meal1Id}`,
        headers: { authorization: `Bearer ${johnToken}` },
        payload: { name: 'Champion Power Breakfast', scheduledTime: '07:00' },
      });
      expect(updateMealRes.statusCode).toBe(200);
    });

    it('rolls back transaction on structural integrity violation in published diet plan', async () => {
      // Attempting to add an option group with invalid selection limits (max < min)
      const invalidGroupRes = await app.inject({
        method: 'POST',
        url: `/api/v1/me/diet-plans/${dietPlanId}/meals/${meal1Id}/option-groups`,
        headers: { authorization: `Bearer ${johnToken}` },
        payload: {
          name: 'Invalid Group Bounds',
          minSelections: 3,
          maxSelections: 1, // Invalid: max < min
        },
      });
      expect(invalidGroupRes.statusCode).toBe(400);
      expect(invalidGroupRes.json().error.code).toBe('VALIDATION_ERROR');

      // Verify transaction rolled back: group was not persisted
      const db = getDatabasePool();
      const invalidGroup = await db.queryOne<any>(
        'SELECT id FROM diet_meal_option_groups WHERE diet_meal_id = ? AND name = "Invalid Group Bounds"',
        [meal1Id]
      );
      expect(invalidGroup).toBeNull();
    });

    it('activates the published diet plan and verifies reflection on /me/today', async () => {
      const actRes = await app.inject({
        method: 'POST',
        url: `/api/v1/me/diet-plans/${dietPlanId}/activate`,
        headers: { authorization: `Bearer ${johnToken}` },
      });
      expect(actRes.statusCode).toBe(200);
      expect(actRes.json().data.dietPlanId).toBe(dietPlanId);

      const todayRes = await app.inject({
        method: 'GET',
        url: '/api/v1/me/today',
        headers: { authorization: `Bearer ${johnToken}` },
      });
      expect(todayRes.statusCode).toBe(200);
      expect(todayRes.json().data.activeDietAssignment.diet_plan_version_id).toBe(dietVersionId);
    });

    it('logs meal intake and adherence against the activated diet plan (log meal -> verify /me/meals/today -> verify history)', async () => {
      // 1. Log meal adherence and food intake
      const logRes = await app.inject({
        method: 'PUT',
        url: `/api/v1/me/meals/${meal1Id}/log`,
        headers: { authorization: `Bearer ${johnToken}` },
        payload: {
          status: 'completed',
          notes: 'Consumed full breakfast as planned',
          selections: [
            {
              optionGroupId: group1Id,
              optionId: opt1Id,
              quantity: 200,
            },
          ],
        },
      });
      expect(logRes.statusCode).toBe(200);
      expect(logRes.json().data.status).toBe('completed');

      // 2. Verify /me/meals/today
      const mealsTodayRes = await app.inject({
        method: 'GET',
        url: '/api/v1/me/meals/today',
        headers: { authorization: `Bearer ${johnToken}` },
      });
      expect(mealsTodayRes.statusCode).toBe(200);
      const todayMeals = mealsTodayRes.json().data.meals;
      const loggedMeal = todayMeals.find((m: any) => m.id === meal1Id);
      expect(loggedMeal).toBeDefined();
      expect(loggedMeal.log).toBeDefined();
      expect(loggedMeal.log.status).toBe('completed');

      // 3. Verify /me/meals/history
      const historyRes = await app.inject({
        method: 'GET',
        url: '/api/v1/me/meals/history',
        headers: { authorization: `Bearer ${johnToken}` },
      });
      expect(historyRes.statusCode).toBe(200);
      const history = historyRes.json().data;
      expect(history.some((l: any) => l.diet_meal_id === meal1Id && l.status === 'completed')).toBe(true);
    });
  });
});
