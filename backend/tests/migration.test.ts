import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';
import { runMigrations } from '../src/database/migrate.js';
import { getDatabasePool, resetDatabasePool, closeDatabasePool } from '../src/database/pool.js';

describe('Legacy Schema Migration & Data Backfill Test Suite', () => {
  const testDbDir = path.resolve(process.cwd(), 'tests/.tmp');
  const testDbPath = path.resolve(testDbDir, `migration_legacy_test_${Date.now()}.db`);

  beforeEach(async () => {
    if (!fs.existsSync(testDbDir)) {
      fs.mkdirSync(testDbDir, { recursive: true });
    }
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    process.env.SQLITE_DB_PATH = testDbPath;
    process.env.DB_CLIENT = 'sqlite';
    resetDatabasePool();
  });

  afterEach(async () => {
    await closeDatabasePool();
    resetDatabasePool();
    if (fs.existsSync(testDbPath)) {
      try {
        fs.unlinkSync(testDbPath);
      } catch {}
    }
  });

  it('safely migrates existing legacy SQLite tables and backfills data into canonical columns idempotently', async () => {
    // 1. Setup a legacy SQLite database with legacy column names and sample data
    const legacyDb = new sqlite3.Database(testDbPath);
    await new Promise<void>((resolve, reject) => {
      legacyDb.serialize(() => {
        // Legacy workout_sessions with session_date
        legacyDb.run(`
          CREATE TABLE workout_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            session_date DATE NOT NULL,
            workout_plan_day_id INTEGER NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'in_progress',
            started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            completed_at DATETIME NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
          )
        `);

        // Legacy diet_meals with meal_order
        legacyDb.run(`
          CREATE TABLE diet_meals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            diet_plan_version_id INTEGER NOT NULL,
            day_number INTEGER NOT NULL DEFAULT 1,
            meal_order INTEGER NOT NULL DEFAULT 1,
            name VARCHAR(100) NOT NULL,
            scheduled_time TIME NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
          )
        `);

        // Legacy daily_tasks with title and scheduled_time
        legacyDb.run(`
          CREATE TABLE daily_tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            task_date DATE NOT NULL,
            task_key VARCHAR(100) NOT NULL,
            task_type VARCHAR(30) NOT NULL,
            title VARCHAR(150) NOT NULL,
            description VARCHAR(255) NULL,
            scheduled_time TIME NULL,
            due_at DATETIME NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'pending',
            is_required INTEGER NOT NULL DEFAULT 1,
            completed_at DATETIME NULL,
            missed_at DATETIME NULL,
            source_entity_type VARCHAR(50) NULL,
            source_entity_id INTEGER NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
          )
        `);

        // Legacy user_notification_settings with allow_push
        legacyDb.run(`
          CREATE TABLE user_notification_settings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL UNIQUE,
            allow_push INTEGER NOT NULL DEFAULT 1,
            allow_in_app INTEGER NOT NULL DEFAULT 1,
            allow_reminders INTEGER NOT NULL DEFAULT 1,
            allow_missed_task_alerts INTEGER NOT NULL DEFAULT 1,
            quiet_hours_enabled INTEGER NOT NULL DEFAULT 0,
            quiet_hours_start TIME NULL,
            quiet_hours_end TIME NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
          )
        `);

        // Legacy notifications with body and is_read
        legacyDb.run(`
          CREATE TABLE notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            category VARCHAR(30) NOT NULL,
            notification_type VARCHAR(50) NOT NULL,
            title VARCHAR(150) NOT NULL,
            body TEXT NOT NULL,
            data_payload TEXT NULL,
            dedup_key VARCHAR(191) NULL UNIQUE,
            is_read INTEGER NOT NULL DEFAULT 0,
            read_at DATETIME NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
          )
        `);

        // Legacy workout tables containing the removed RIR fields. The
        // migration must drop only those fields and preserve the row.
        legacyDb.run(`
          CREATE TABLE workout_plan_exercises (
            id INTEGER PRIMARY KEY,
            target_sets INTEGER NOT NULL,
            rir_target INTEGER NULL
          )
        `);
        legacyDb.run(`
          CREATE TABLE workout_plan_exercise_sets (
            id INTEGER PRIMARY KEY,
            set_number INTEGER NOT NULL,
            rir_target INTEGER NULL
          )
        `);
        legacyDb.run(`
          CREATE TABLE workout_session_exercises (
            id INTEGER PRIMARY KEY,
            exercise_id INTEGER NOT NULL,
            planned_rir_snapshot INTEGER NULL
          )
        `);
        legacyDb.run(`
          CREATE TABLE workout_sets (
            id INTEGER PRIMARY KEY,
            set_number INTEGER NOT NULL,
            weight_kg REAL NULL,
            rir INTEGER NULL
          )
        `);

        // Insert legacy test fixtures
        legacyDb.run(`
          INSERT INTO workout_sessions (id, user_id, session_date, status)
          VALUES (1, 10, '2026-08-15', 'completed')
        `);

        legacyDb.run(`
          INSERT INTO diet_meals (id, diet_plan_version_id, day_number, meal_order, name)
          VALUES (1, 5, 1, 2, 'Breakfast Scramble')
        `);

        legacyDb.run(`
          INSERT INTO daily_tasks (id, user_id, task_date, task_key, task_type, title, scheduled_time, status)
          VALUES (1, 10, '2026-08-15', 'meal:1', 'meal', 'Eat Breakfast', '08:30:00', 'completed')
        `);

        legacyDb.run(`
          INSERT INTO user_notification_settings (id, user_id, allow_push, allow_in_app, allow_reminders)
          VALUES (1, 10, 1, 0, 1)
        `);

        legacyDb.run(`
          INSERT INTO notifications (id, user_id, category, notification_type, title, body, is_read)
          VALUES (1, 10, 'system', 'reminder', 'Drink Water', 'Time to hydrate athlete!', 1)
        `);
        legacyDb.run(`INSERT INTO workout_plan_exercises (id, target_sets, rir_target) VALUES (1, 3, 2)`);
        legacyDb.run(`INSERT INTO workout_plan_exercise_sets (id, set_number, rir_target) VALUES (1, 1, 2)`);
        legacyDb.run(`INSERT INTO workout_session_exercises (id, exercise_id, planned_rir_snapshot) VALUES (1, 9, 2)`);
        legacyDb.run(`INSERT INTO workout_sets (id, set_number, weight_kg, rir) VALUES (1, 1, 80, 2)`, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    });

    await new Promise<void>((resolve, reject) => {
      legacyDb.close((err) => (err ? reject(err) : resolve()));
    });

    // 2. Run migrations on the legacy database
    const pool = getDatabasePool(testDbPath);
    await runMigrations(pool);

    // 3. Inspect the migrated database and verify canonical columns and backfilled values
    const verifyDb = new sqlite3.Database(testDbPath);
    const queryOne = (sql: string): Promise<any> => {
      return new Promise((resolve, reject) => {
        verifyDb.get(sql, (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });
    };

    // Verify workout_sessions backfill: workout_date populated from session_date
    const session = await queryOne('SELECT * FROM workout_sessions WHERE id = 1');
    expect(session).toBeDefined();
    expect(session.session_date).toBe('2026-08-15');
    expect(session.workout_date).toBe('2026-08-15');

    // Verify diet_meals backfill: order_index populated from meal_order
    const meal = await queryOne('SELECT * FROM diet_meals WHERE id = 1');
    expect(meal).toBeDefined();
    expect(meal.meal_order).toBe(2);
    expect(meal.order_index).toBe(2);

    // Verify daily_tasks backfill: title_snapshot from title, scheduled_at from scheduled_time
    const task = await queryOne('SELECT * FROM daily_tasks WHERE id = 1');
    expect(task).toBeDefined();
    expect(task.title).toBe('Eat Breakfast');
    expect(task.title_snapshot).toBe('Eat Breakfast');
    expect(task.scheduled_at).toBe('2026-08-15 08:30:00');

    // Verify user_notification_settings backfill: push_enabled from allow_push
    const notifSettings = await queryOne('SELECT * FROM user_notification_settings WHERE user_id = 10');
    expect(notifSettings).toBeDefined();
    expect(notifSettings.push_enabled).toBe(1);
    expect(notifSettings.in_app_enabled).toBe(0);
    expect(notifSettings.local_notifications_enabled).toBe(1);

    // Verify notifications backfill: message from body, status from is_read
    const notif = await queryOne('SELECT * FROM notifications WHERE id = 1');
    expect(notif).toBeDefined();
    expect(notif.message).toBe('Time to hydrate athlete!');
    expect(notif.status).toBe('read');

    const rirColumns = await queryOne(`
      SELECT COUNT(*) as count FROM pragma_table_info('workout_plan_exercises') WHERE name = 'rir_target'
    `);
    expect(rirColumns.count).toBe(0);
    const preservedExercise = await queryOne('SELECT target_sets FROM workout_plan_exercises WHERE id = 1');
    expect(preservedExercise.target_sets).toBe(3);
    const setRirColumns = await queryOne(`
      SELECT COUNT(*) as count FROM pragma_table_info('workout_sets') WHERE name = 'rir'
    `);
    expect(setRirColumns.count).toBe(0);

    await new Promise<void>((resolve, reject) => {
      verifyDb.close((err) => (err ? reject(err) : resolve()));
    });

    // 4. Test idempotency: Run migrations a second time and ensure no errors or data corruption
    await runMigrations(pool);

    const verifyDb2 = new sqlite3.Database(testDbPath);
    const queryOne2 = (sql: string): Promise<any> => {
      return new Promise((resolve, reject) => {
        verifyDb2.get(sql, (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });
    };

    const session2 = await queryOne2('SELECT * FROM workout_sessions WHERE id = 1');
    expect(session2.workout_date).toBe('2026-08-15');

    const notif2 = await queryOne2('SELECT * FROM notifications WHERE id = 1');
    expect(notif2.message).toBe('Time to hydrate athlete!');
    expect(notif2.status).toBe('read');

    await new Promise<void>((resolve, reject) => {
      verifyDb2.close((err) => (err ? reject(err) : resolve()));
    });
  });
});
