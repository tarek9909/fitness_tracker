import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../src/app/app.js';
import { runMigrations } from '../src/database/migrate.js';
import { seedDatabase } from '../src/database/seed.js';
import { getDatabasePool, closeDatabasePool, resetDatabasePool } from '../src/database/pool.js';
import { FastifyInstance } from 'fastify';
import { env } from '../src/config/env.js';
import { DailyPlanService } from '../src/modules/daily-plan/daily-plan.routes.js';

const testDbDir = path.resolve(process.cwd(), 'tests', '.tmp');
const testDbPath = path.resolve(testDbDir, `daily_plan_batch_${process.pid}_${Date.now()}.db`);

describe('Daily Plan Batch Querying & Set-Based Diet Resolution', () => {
  let app: FastifyInstance;
  let userToken: string;
  let adminToken: string;
  let userId: number;
  let planVersionId: number;

  beforeAll(async () => {
    if (!fs.existsSync(testDbDir)) {
      fs.mkdirSync(testDbDir, { recursive: true });
    }

    process.env.SQLITE_DB_PATH = testDbPath;
    env.sqliteDbPath = testDbPath;
    resetDatabasePool();

    await runMigrations();
    await seedDatabase();

    const bcryptModule = await import('bcryptjs');
    const bcrypt = bcryptModule.default || bcryptModule;
    const userHash = await bcrypt.hash('User123!', 10);
    const db = getDatabasePool();
    await db.execute('UPDATE users SET password_hash = ? WHERE email = ?', [userHash, 'john.doe@fitnessplatform.com']);

    app = await buildApp();
    await app.ready();

    // Login user
    const userLogin = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'john.doe@fitnessplatform.com',
        password: 'User123!',
      },
    });
    userToken = userLogin.json().data.accessToken;
    userId = userLogin.json().data.user.id;

    // Login admin
    const adminLogin = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'admin@fitnessplatform.com',
        password: 'Admin123!',
      },
    });
    adminToken = adminLogin.json().data.accessToken;

    // Find active diet version for user
    const assignRow = await db.queryOne<any>(
      'SELECT diet_plan_version_id FROM user_diet_assignments WHERE user_id = ? AND status = "active" LIMIT 1',
      [userId]
    );
    planVersionId = assignRow?.diet_plan_version_id || 1;
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    await closeDatabasePool();

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
    } catch {
      // Ignore cleanup errors
    }
  });

  it('resolves diet meals, groups, options, and logs in O(1) set-based queries regardless of meal count', async () => {
    const db = getDatabasePool();

    // Insert additional meals and option groups into the published version for the test
    // To ensure there are at least 3 meals with multiple option groups and multiple options
    // Version 1 already has 4 seeded meals (orders 1-4). Add meals 5 and 6 to test multiple meals
    const meal5 = await db.execute(
      `INSERT INTO diet_meals (diet_plan_version_id, name, meal_order, scheduled_time, default_grace_minutes, description)
       VALUES (?, 'Afternoon Power Snack', 5, '15:00:00', 60, 'High protein snack')`,
      [planVersionId]
    );
    const meal6 = await db.execute(
      `INSERT INTO diet_meals (diet_plan_version_id, name, meal_order, scheduled_time, default_grace_minutes, description)
       VALUES (?, 'Late Night Casein', 6, '22:00:00', 60, 'Evening recovery')`,
      [planVersionId]
    );

    const group5 = await db.execute(
      `INSERT INTO diet_meal_option_groups (diet_meal_id, name, group_order, min_selection_count, max_selection_count)
       VALUES (?, 'Protein Source', 1, 1, 1)`,
      [meal5.insertId]
    );
    const group6 = await db.execute(
      `INSERT INTO diet_meal_option_groups (diet_meal_id, name, group_order, min_selection_count, max_selection_count)
       VALUES (?, 'Night Base', 1, 1, 1)`,
      [meal6.insertId]
    );

    await db.execute(
      `INSERT INTO diet_meal_options (diet_meal_option_group_id, food_id, option_order, label, quantity, calories_snapshot, protein_g_snapshot, carbs_g_snapshot, fat_g_snapshot)
       VALUES (?, 1, 1, 'Chicken Breast', 200, 330, 62, 0, 7)`,
      [group5.insertId]
    );
    await db.execute(
      `INSERT INTO diet_meal_options (diet_meal_option_group_id, food_id, option_order, label, quantity, calories_snapshot, protein_g_snapshot, carbs_g_snapshot, fat_g_snapshot)
       VALUES (?, 2, 1, 'Greek Yogurt', 250, 150, 25, 10, 0)`,
      [group6.insertId]
    );

    // Spy on db.query calls during resolveDailyPlan
    const originalQuery = db.query.bind(db);
    const interceptedQueries: string[] = [];

    db.query = async <T = any>(sql: string, params?: any[]): Promise<T[]> => {
      interceptedQueries.push(sql.trim());
      return originalQuery(sql, params);
    };

    try {
      const service = new DailyPlanService();
      const plan = await service.resolveDailyPlan(userId);

      // Verify that diet meals were loaded with exactly 1 meals query, 1 groups query, 1 options query, and 1 logs query
      const mealQueries = interceptedQueries.filter(q => q.includes('FROM diet_meals'));
      const groupQueries = interceptedQueries.filter(q => q.includes('FROM diet_meal_option_groups'));
      const optionQueries = interceptedQueries.filter(q => q.includes('FROM diet_meal_options'));
      const logQueries = interceptedQueries.filter(q => q.includes('FROM meal_logs'));

      expect(mealQueries.length).toBe(1);
      expect(groupQueries.length).toBe(1);
      expect(optionQueries.length).toBe(1);
      expect(logQueries.length).toBe(1);

      // Verify that groups query joins diet_meals to filter by version ID directly
      expect(groupQueries[0]).toMatch(/JOIN diet_meals/i);
      expect(groupQueries[0]).toMatch(/diet_plan_version_id = \?/i);

      // Verify that options query joins diet_meal_option_groups and diet_meals to filter by version ID directly
      expect(optionQueries[0]).toMatch(/JOIN diet_meal_option_groups/i);
      expect(optionQueries[0]).toMatch(/JOIN diet_meals/i);
      expect(optionQueries[0]).toMatch(/diet_plan_version_id = \?/i);

      // Verify response structure and hierarchy
      expect(plan.diet.meals.length).toBeGreaterThanOrEqual(3);
      for (const meal of plan.diet.meals) {
        expect(meal.id).toBeDefined();
        expect(meal.name).toBeDefined();
        expect(meal.order_index).toBeDefined();
        expect(Array.isArray(meal.optionGroups)).toBe(true);

        for (const group of meal.optionGroups) {
          expect(group.id).toBeDefined();
          expect(group.diet_meal_id).toBe(meal.id);
          expect(group.order_index).toBeDefined();
          expect(group.min_selections).toBeDefined();
          expect(group.max_selections).toBeDefined();
          expect(Array.isArray(group.options)).toBe(true);
          expect(group.options.length).toBeGreaterThanOrEqual(1);

          for (const opt of group.options) {
            expect(opt.id).toBeDefined();
            expect(opt.diet_meal_option_group_id).toBe(group.id);
            expect(opt.calories).toBeDefined();
            expect(opt.protein_g).toBeDefined();
          }
        }
      }
    } finally {
      db.query = originalQuery;
    }
  });

  it('GET /api/v1/me/today returns expected payload contract with batched diet hierarchy', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/me/today',
      headers: { authorization: `Bearer ${userToken}` },
    });

    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(json.success).toBe(true);
    expect(json.data.diet).toBeDefined();
    expect(Array.isArray(json.data.diet.meals)).toBe(true);
    expect(json.data.diet.meals.length).toBeGreaterThanOrEqual(3);

    // Verify task materialization includes meal tasks
    const mealTasks = json.data.tasks.filter((t: any) => t.taskType === 'meal');
    expect(mealTasks.length).toBe(json.data.diet.meals.length);
  });
});
