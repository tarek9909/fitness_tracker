import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { getDatabasePool } from './pool.js';
import { DatabasePool } from './types.js';
import { SCHEMA_SQL } from './schema.js';
import { logger } from '../config/logger.js';
import { env } from '../config/env.js';

interface Migration {
  version: string;
  up: (db: DatabasePool) => Promise<void>;
}

function configuredDbClient(): 'sqlite' | 'mysql' {
  // Tests and one-off migration commands may set DB_CLIENT after this module
  // has been imported. Honor that explicit process value when present.
  return process.env.DB_CLIENT === 'sqlite' ? 'sqlite' : env.dbClient;
}

async function migrationSql(): Promise<string> {
  if (configuredDbClient() === 'sqlite') return SCHEMA_SQL;

  const candidates = [
    path.resolve(process.cwd(), 'src', 'database', 'fitness_tracker.sql'),
    path.resolve(process.cwd(), 'src', 'database', 'fitness_tracker.db'),
    path.resolve(process.cwd(), 'fitness_tracker.sql'),
    path.resolve(process.cwd(), 'fitness_tracker.db'),
    path.resolve(process.cwd(), '..', 'fitness_tracker.db'),
    path.resolve(process.cwd(), 'dist', 'database', 'fitness_tracker.sql'),
    path.resolve(process.cwd(), 'dist', 'database', 'fitness_tracker.db'),
  ];
  let sourcePath: string | undefined;
  for (const candidate of candidates) {
    try {
      await readFile(candidate, 'utf8');
      sourcePath = candidate;
      break;
    } catch {
      // Try the next workspace-relative location.
    }
  }
  if (!sourcePath) throw new Error('MySQL schema source fitness_tracker.db was not found');
  return readFile(sourcePath, 'utf8');
}

function splitStatements(sql: string): string[] {
  return sql
    .replace(/^\s*--.*$/gm, '')
    .split(';')
    .map(statement => statement.trim())
    .filter(statement => statement.length > 0)
    .filter(statement => !/^CREATE DATABASE\b/i.test(statement))
    .filter(statement => !/^USE\b/i.test(statement));
}

async function ensureColumnExists(
  db: DatabasePool,
  tableName: string,
  columnName: string,
  columnDef: string
): Promise<void> {
  if (configuredDbClient() === 'sqlite') {
    const tableExists = await db.queryOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name='${tableName}'`
    );
    if ((tableExists?.count || 0) === 0) return;

    const colInfo = await db.queryOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM pragma_table_info('${tableName}') WHERE name = '${columnName}'`
    );
    if ((colInfo?.count || 0) === 0) {
      try {
        await db.execute(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDef}`);
      } catch (err: any) {
        if (!err.message?.includes('duplicate column name')) {
          throw err;
        }
      }
    }
  } else {
    const colInfo = await db.queryOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [tableName, columnName]
    );
    if ((colInfo?.count || 0) === 0) {
      try {
        await db.execute(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDef}`);
      } catch (err: any) {
        if (!err.message?.includes('Duplicate column name')) {
          throw err;
        }
      }
    }
  }
}

async function mysqlColumnExists(db: DatabasePool, tableName: string, columnName: string): Promise<boolean> {
  const result = await db.queryOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [tableName, columnName]
  );
  return (result?.count || 0) > 0;
}

async function mysqlConstraintExists(db: DatabasePool, tableName: string, constraintName: string): Promise<boolean> {
  const result = await db.queryOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM information_schema.TABLE_CONSTRAINTS
     WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = ?`,
    [tableName, constraintName]
  );
  return (result?.count || 0) > 0;
}

export function getScheduledAtBackfillExpr(client: 'sqlite' | 'mysql' = configuredDbClient()): string {
  if (client === 'mysql') {
    return 'TIMESTAMP(task_date, scheduled_time)';
  }
  return "datetime(task_date || ' ' || scheduled_time)";
}

async function backfillColumnData(
  db: DatabasePool,
  tableName: string,
  targetCol: string,
  sourceExpr: string,
  sourceColNameToCheck: string,
  whereCondition?: string
): Promise<void> {
  if (configuredDbClient() === 'sqlite') {
    const tableExists = await db.queryOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name='${tableName}'`
    );
    if ((tableExists?.count || 0) === 0) return;

    const hasTarget = await db.queryOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM pragma_table_info('${tableName}') WHERE name = '${targetCol}'`
    );
    const hasSource = await db.queryOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM pragma_table_info('${tableName}') WHERE name = '${sourceColNameToCheck}'`
    );

    if ((hasTarget?.count || 0) > 0 && (hasSource?.count || 0) > 0) {
      const whereClause = whereCondition ? `WHERE ${whereCondition}` : `WHERE ${sourceColNameToCheck} IS NOT NULL`;
      await db.execute(`UPDATE ${tableName} SET ${targetCol} = ${sourceExpr} ${whereClause}`);
    }
  } else {
    const hasCols = await db.queryOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME IN (?, ?)`,
      [tableName, targetCol, sourceColNameToCheck]
    );
    if ((hasCols?.count || 0) >= 2) {
      const whereClause = whereCondition ? `WHERE ${whereCondition}` : `WHERE ${sourceColNameToCheck} IS NOT NULL`;
      await db.execute(`UPDATE ${tableName} SET ${targetCol} = ${sourceExpr} ${whereClause}`);
    }
  }
}

async function reconcileOrderingColumns(
  db: DatabasePool,
  tableName: string,
  canonicalCol: string,
  legacyCol: string
): Promise<void> {
  if (configuredDbClient() === 'sqlite') {
    const tableExists = await db.queryOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name='${tableName}'`
    );
    if ((tableExists?.count || 0) === 0) return;

    const hasCanonical = await db.queryOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM pragma_table_info('${tableName}') WHERE name = '${canonicalCol}'`
    );
    const hasLegacy = await db.queryOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM pragma_table_info('${tableName}') WHERE name = '${legacyCol}'`
    );
    if ((hasCanonical?.count || 0) === 0 || (hasLegacy?.count || 0) === 0) return;
  } else {
    const cols = await db.queryOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME IN (?, ?)`,
      [tableName, canonicalCol, legacyCol]
    );
    if ((cols?.count || 0) < 2) return;
  }

  const rowCount = await db.queryOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM ${tableName}`
  );
  if ((rowCount?.count || 0) === 0) return;

  const stats = await db.queryOne<{ distinctCanonical: number; distinctLegacy: number }>(
    `SELECT COUNT(DISTINCT ${canonicalCol}) as distinctCanonical, COUNT(DISTINCT ${legacyCol}) as distinctLegacy FROM ${tableName}`
  );

  const distinctCanonical = Number(stats?.distinctCanonical || 0);
  const distinctLegacy = Number(stats?.distinctLegacy || 0);

  if (distinctLegacy > 1 && distinctCanonical <= 1) {
    // Legacy column has distinct values while canonical has at most 1 distinct value:
    // canonical column was likely newly added with a default (e.g. 1). Backfill canonical from legacy.
    await db.execute(`UPDATE ${tableName} SET ${canonicalCol} = ${legacyCol} WHERE ${legacyCol} IS NOT NULL`);
  } else if (distinctCanonical > 0 && distinctLegacy <= 1) {
    // Canonical column has distinct values while legacy has at most 1 distinct value:
    // canonical column is already populated with actual ordering. Keep canonical and sync legacy.
    await db.execute(`UPDATE ${tableName} SET ${legacyCol} = ${canonicalCol} WHERE ${canonicalCol} IS NOT NULL`);
  }

  // Ensure any rows with NULL in one column inherit the other column's value
  try {
    await db.execute(`UPDATE ${tableName} SET ${canonicalCol} = ${legacyCol} WHERE ${canonicalCol} IS NULL AND ${legacyCol} IS NOT NULL`);
    await db.execute(`UPDATE ${tableName} SET ${legacyCol} = ${canonicalCol} WHERE ${legacyCol} IS NULL AND ${canonicalCol} IS NOT NULL`);
  } catch {
    // Columns might be NOT NULL with no NULL rows; safe to ignore
  }
}

const migrations: Migration[] = [
  {
    version: '001-initial-schema',
    up: async (db) => {
      const sourceSql = await migrationSql();
      const statements = splitStatements(sourceSql).map(statement => {
        if (configuredDbClient() === 'mysql' && /^CREATE TABLE\s+/i.test(statement)) {
          return statement.replace(/^CREATE TABLE\s+/i, 'CREATE TABLE IF NOT EXISTS ');
        }
        return statement;
      });

      for (const statement of statements) {
        try {
          await db.execute(statement);
        } catch (error) {
          logger.error({ error, statement }, 'Failed executing schema statement');
          throw error;
        }
      }
    },
  },
  {
    version: '002-workout-sessions-unique-user-date',
    up: async (db) => {
      logger.info('Running migration 002: deduplicating workout_sessions and applying UNIQUE (user_id, session_date)');
      
      // 1. Find and deduplicate any duplicate (user_id, workout_date) entries deterministically
      try {
        const hasSessionDate = configuredDbClient() === 'sqlite'
          ? await db.queryOne<{ count: number }>(`SELECT COUNT(*) as count FROM pragma_table_info('workout_sessions') WHERE name = 'session_date'`)
          : { count: 0 };
        const dateCol = (hasSessionDate?.count || 0) > 0 ? 'session_date' : 'workout_date';

        const duplicates = await db.query<any>(`
          SELECT user_id, ${dateCol} as s_date, COUNT(*) as cnt
          FROM workout_sessions
          GROUP BY user_id, ${dateCol}
          HAVING cnt > 1
        `);

        for (const dup of duplicates) {
          const sessions = await db.query<{ id: number; status: string }>(`
            SELECT id, status FROM workout_sessions
            WHERE user_id = ? AND ${dateCol} = ?
            ORDER BY (CASE WHEN status = 'completed' THEN 2 WHEN status = 'in_progress' THEN 1 ELSE 0 END) DESC, id DESC
          `, [dup.user_id, dup.s_date]);

          // Keep primary (first), remove redundant
          const redundantIds = sessions.slice(1).map((s: { id: number; status: string }) => s.id);
          for (const redId of redundantIds) {
            await db.execute(
              'DELETE FROM workout_sets WHERE workout_session_exercise_id IN (SELECT id FROM workout_session_exercises WHERE workout_session_id = ?)',
              [redId]
            );
            await db.execute('DELETE FROM workout_session_exercises WHERE workout_session_id = ?', [redId]);
            await db.execute('DELETE FROM workout_sessions WHERE id = ?', [redId]);
          }
        }
      } catch (err: any) {
        if (err?.message?.includes('no such table') || err?.code === 'SQLITE_ERROR' && err?.message?.includes('no such table')) {
          logger.info('workout_sessions table not yet present; skipping deduplication');
        } else {
          logger.error({ err }, 'Failed during workout_sessions deduplication cleanup');
          throw err;
        }
      }

      // 2. Create unique index
      if (configuredDbClient() === 'sqlite') {
        const hasSessionDate = await db.queryOne<{ count: number }>(`SELECT COUNT(*) as count FROM pragma_table_info('workout_sessions') WHERE name = 'session_date'`);
        const dateCol = (hasSessionDate?.count || 0) > 0 ? 'session_date' : 'workout_date';
        await db.execute(`
          CREATE UNIQUE INDEX IF NOT EXISTS uidx_workout_sessions_user_session_date
          ON workout_sessions (user_id, ${dateCol}, workout_plan_day_id)
        `);
      } else {
        try {
          await db.execute(`
            ALTER TABLE workout_sessions
            ADD CONSTRAINT uidx_workout_sessions_user_session_date
            UNIQUE (user_id, workout_date, workout_plan_day_id)
          `);
        } catch (err: any) {
          if (!err?.message?.includes('Duplicate key name') && !err?.code?.includes('ER_DUP_KEYNAME')) {
            throw err;
          }
        }
      }
    },
  },
  {
    version: '003-worker-locks-table',
    up: async (db) => {
      logger.info('Running migration 003: creating worker_locks table');
      await db.execute(`
        CREATE TABLE IF NOT EXISTS worker_locks (
          worker_name VARCHAR(100) PRIMARY KEY,
          locked_until TIMESTAMP NOT NULL,
          locked_by VARCHAR(100) NOT NULL,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);
    },
  },
  {
    version: '004-harmonize-schema-columns',
    up: async (db) => {
      logger.info('Running migration 004: ensuring canonical column structures for existing databases');

      // Slice 1: Catalog Foundation
      await ensureColumnExists(db, 'equipment_types', 'is_active', 'INTEGER NOT NULL DEFAULT 1');
      await ensureColumnExists(db, 'equipment_types', 'updated_at', 'DATETIME NULL');
      await ensureColumnExists(db, 'muscle_groups', 'is_active', 'INTEGER NOT NULL DEFAULT 1');
      await ensureColumnExists(db, 'muscle_groups', 'updated_at', 'DATETIME NULL');
      await ensureColumnExists(db, 'measurement_units', 'unit_type', "VARCHAR(20) NOT NULL DEFAULT 'weight'");
      await ensureColumnExists(db, 'measurement_units', 'base_unit', 'INTEGER NOT NULL DEFAULT 0');
      await ensureColumnExists(db, 'measurement_units', 'is_active', 'INTEGER NOT NULL DEFAULT 1');
      await ensureColumnExists(db, 'measurement_units', 'created_at', 'DATETIME NULL');
      await ensureColumnExists(db, 'measurement_units', 'updated_at', 'DATETIME NULL');
      await ensureColumnExists(db, 'app_settings', 'setting_type', "VARCHAR(20) NOT NULL DEFAULT 'string'");
      await ensureColumnExists(db, 'app_settings', 'is_public', 'INTEGER NOT NULL DEFAULT 0');
      await ensureColumnExists(db, 'system_settings', 'category', "VARCHAR(50) NOT NULL DEFAULT 'general'");
      await ensureColumnExists(db, 'system_settings', 'value_type', "VARCHAR(20) NOT NULL DEFAULT 'string'");
      await ensureColumnExists(db, 'system_settings', 'is_public', 'INTEGER NOT NULL DEFAULT 0');
      await ensureColumnExists(db, 'client_invitations', 'status', "VARCHAR(20) NOT NULL DEFAULT 'pending'");
      await ensureColumnExists(db, 'client_invitations', 'expires_at', 'DATETIME NULL');
      await ensureColumnExists(db, 'client_invitations', 'accepted_at', 'DATETIME NULL');
      await ensureColumnExists(db, 'coach_clients', 'status', "VARCHAR(20) NOT NULL DEFAULT 'active'");
      await ensureColumnExists(db, 'coach_clients', 'notes', 'TEXT NULL');
      await ensureColumnExists(db, 'coach_clients', 'assigned_at', 'DATETIME NULL');
      await ensureColumnExists(db, 'coach_clients', 'unassigned_at', 'DATETIME NULL');

      // Slice 2: Foods
      await ensureColumnExists(db, 'foods', 'serving_unit', 'VARCHAR(50) NULL');
      await ensureColumnExists(db, 'foods', 'serving_size', 'DECIMAL(8,2) NULL');
      await ensureColumnExists(db, 'foods', 'calories_per_serving', 'DECIMAL(8,2) NULL');
      await ensureColumnExists(db, 'foods', 'protein_grams', 'DECIMAL(6,2) NULL');
      await ensureColumnExists(db, 'foods', 'carbs_grams', 'DECIMAL(6,2) NULL');
      await ensureColumnExists(db, 'foods', 'fat_grams', 'DECIMAL(6,2) NULL');
      await ensureColumnExists(db, 'foods', 'fiber_grams', 'DECIMAL(6,2) NULL');
      await ensureColumnExists(db, 'foods', 'sugar_grams', 'DECIMAL(6,2) NULL');
      await ensureColumnExists(db, 'foods', 'is_system', 'INTEGER NOT NULL DEFAULT 0');
      await ensureColumnExists(db, 'foods', 'is_verified', 'INTEGER NOT NULL DEFAULT 0');

      // Slice 3: Exercises
      await ensureColumnExists(db, 'exercises', 'primary_muscle_group_id', 'INTEGER NULL');
      await ensureColumnExists(db, 'exercises', 'secondary_muscle_group_id', 'INTEGER NULL');
      await ensureColumnExists(db, 'exercises', 'equipment_type_id', 'INTEGER NULL');
      await ensureColumnExists(db, 'exercises', 'tracking_type', "VARCHAR(30) NOT NULL DEFAULT 'reps_weight'");
      await ensureColumnExists(db, 'exercises', 'is_custom', 'INTEGER NOT NULL DEFAULT 0');
      await ensureColumnExists(db, 'exercises', 'is_archived', 'INTEGER NOT NULL DEFAULT 0');

      // Slice 4: Weight & Water
      await ensureColumnExists(db, 'body_weight_entries', 'measurement_date', 'DATE NULL');
      await ensureColumnExists(db, 'body_weight_entries', 'measured_at', 'DATETIME NULL');
      await ensureColumnExists(db, 'body_weight_entries', 'source', "VARCHAR(20) NOT NULL DEFAULT 'manual'");
      await ensureColumnExists(db, 'body_weight_entries', 'notes', 'VARCHAR(500) NULL');
      await ensureColumnExists(db, 'water_entries', 'entry_date', 'DATE NULL');
      await ensureColumnExists(db, 'water_entries', 'logged_at', 'DATETIME NULL');

      // Slice 5: Cardio
      await ensureColumnExists(db, 'cardio_activities', 'met_value', 'DECIMAL(4,1) NULL');
      await ensureColumnExists(db, 'cardio_activities', 'is_system', 'INTEGER NOT NULL DEFAULT 1');
      await ensureColumnExists(db, 'cardio_activities', 'is_active', 'INTEGER NOT NULL DEFAULT 1');
      await ensureColumnExists(db, 'cardio_logs', 'cardio_activity_id', 'INTEGER NULL');
      await ensureColumnExists(db, 'cardio_logs', 'cardio_date', 'DATE NULL');
      await ensureColumnExists(db, 'cardio_logs', 'distance_meters', 'DECIMAL(8,2) NULL');
      await ensureColumnExists(db, 'cardio_logs', 'average_heart_rate', 'INTEGER NULL');
      await ensureColumnExists(db, 'cardio_logs', 'notes', 'VARCHAR(1000) NULL');

      // Slice 6: Workout Plans
      await ensureColumnExists(db, 'workout_plans', 'is_archived', 'INTEGER NOT NULL DEFAULT 0');
      await ensureColumnExists(db, 'workout_plans', 'archived_at', 'DATETIME NULL');
      await ensureColumnExists(db, 'workout_plan_versions', 'change_summary', 'VARCHAR(500) NULL');
      await ensureColumnExists(db, 'workout_plan_versions', 'published_at', 'DATETIME NULL');
      await ensureColumnExists(db, 'workout_plan_days', 'day_order', 'INTEGER NOT NULL DEFAULT 1');
      await ensureColumnExists(db, 'workout_plan_days', 'is_rest_day', 'INTEGER NOT NULL DEFAULT 0');
      await ensureColumnExists(db, 'workout_plan_exercises', 'exercise_order', 'INTEGER NOT NULL DEFAULT 1');
      await ensureColumnExists(db, 'workout_plan_exercises', 'exercise_name_snapshot', 'VARCHAR(150) NULL');
      await ensureColumnExists(db, 'workout_plan_exercises', 'tracking_type_snapshot', 'VARCHAR(30) NULL');
      await ensureColumnExists(db, 'workout_plan_exercise_sets', 'set_order', 'INTEGER NOT NULL DEFAULT 1');
      await ensureColumnExists(db, 'workout_plan_exercise_sets', 'target_reps', 'INTEGER NULL');
      await ensureColumnExists(db, 'workout_plan_exercise_sets', 'reps_min_target', 'INTEGER NULL');
      await ensureColumnExists(db, 'workout_plan_exercise_sets', 'reps_max_target', 'INTEGER NULL');
      await ensureColumnExists(db, 'workout_plan_exercise_sets', 'weight_kg_target', 'DECIMAL(6,2) NULL');
      await ensureColumnExists(db, 'workout_plan_exercise_sets', 'duration_seconds_target', 'INTEGER NULL');
      await ensureColumnExists(db, 'workout_plan_exercise_sets', 'rest_seconds_target', 'INTEGER NULL');

      // Slice 7: Diet Plans
      await ensureColumnExists(db, 'diet_plans', 'is_archived', 'INTEGER NOT NULL DEFAULT 0');
      await ensureColumnExists(db, 'diet_plans', 'archived_at', 'DATETIME NULL');
      await ensureColumnExists(db, 'diet_plan_versions', 'change_summary', 'VARCHAR(500) NULL');
      await ensureColumnExists(db, 'diet_plan_versions', 'published_at', 'DATETIME NULL');
      await ensureColumnExists(db, 'diet_meals', 'meal_date', 'DATE NULL');
      await ensureColumnExists(db, 'diet_meals', 'order_index', 'INTEGER NOT NULL DEFAULT 1');
      await ensureColumnExists(db, 'diet_meal_option_groups', 'order_index', 'INTEGER NOT NULL DEFAULT 1');
      await ensureColumnExists(db, 'diet_meal_options', 'order_index', 'INTEGER NOT NULL DEFAULT 1');
      await ensureColumnExists(db, 'diet_meal_options', 'custom_label', 'VARCHAR(150) NULL');
      await ensureColumnExists(db, 'diet_meal_options', 'serving_quantity', 'DECIMAL(8,2) NULL');
      await ensureColumnExists(db, 'diet_meal_options', 'calories_snapshot', 'DECIMAL(8,2) NULL');
      await ensureColumnExists(db, 'diet_meal_options', 'protein_snapshot', 'DECIMAL(6,2) NULL');
      await ensureColumnExists(db, 'diet_meal_options', 'carbs_snapshot', 'DECIMAL(6,2) NULL');
      await ensureColumnExists(db, 'diet_meal_options', 'fat_snapshot', 'DECIMAL(6,2) NULL');

      // Slice 8: Workout Execution
      await ensureColumnExists(db, 'workout_sessions', 'workout_date', 'DATE NULL');
      await ensureColumnExists(db, 'workout_sessions', 'source_type', "VARCHAR(20) NOT NULL DEFAULT 'assigned'");
      await ensureColumnExists(db, 'workout_sessions', 'workout_name_snapshot', 'VARCHAR(150) NULL');
      await ensureColumnExists(db, 'workout_session_exercises', 'exercise_order', 'INTEGER NOT NULL DEFAULT 1');
      await ensureColumnExists(db, 'workout_session_exercises', 'exercise_name_snapshot', 'VARCHAR(150) NULL');
      await ensureColumnExists(db, 'workout_session_exercises', 'tracking_type_snapshot', 'VARCHAR(30) NULL');
      await ensureColumnExists(db, 'workout_session_exercises', 'planned_sets_snapshot', 'INTEGER NULL');
      await ensureColumnExists(db, 'workout_session_exercises', 'reps_min_snapshot', 'INTEGER NULL');
      await ensureColumnExists(db, 'workout_session_exercises', 'reps_max_snapshot', 'INTEGER NULL');
      await ensureColumnExists(db, 'workout_session_exercises', 'target_weight_kg_snapshot', 'DECIMAL(8,2) NULL');
      await ensureColumnExists(db, 'workout_sets', 'performed_at', 'DATETIME NULL');

      // Slice 9: Meal Logs & Selections
      await ensureColumnExists(db, 'meal_logs', 'user_diet_assignment_id', 'INTEGER NULL');
      await ensureColumnExists(db, 'meal_logs', 'diet_plan_version_id', 'INTEGER NULL');
      await ensureColumnExists(db, 'meal_logs', 'meal_date', 'DATE NULL');
      await ensureColumnExists(db, 'meal_logs', 'meal_name_snapshot', 'VARCHAR(150) NULL');
      await ensureColumnExists(db, 'meal_logs', 'scheduled_time_snapshot', 'TIME NULL');
      await ensureColumnExists(db, 'meal_logs', 'actual_calories', 'DECIMAL(8,2) NULL');
      await ensureColumnExists(db, 'meal_logs', 'actual_protein', 'DECIMAL(6,2) NULL');
      await ensureColumnExists(db, 'meal_logs', 'actual_carbs', 'DECIMAL(6,2) NULL');
      await ensureColumnExists(db, 'meal_logs', 'actual_fat', 'DECIMAL(6,2) NULL');
      await ensureColumnExists(db, 'meal_log_selections', 'group_name_snapshot', 'VARCHAR(150) NULL');
      await ensureColumnExists(db, 'meal_log_selections', 'option_label_snapshot', 'VARCHAR(150) NULL');
      await ensureColumnExists(db, 'meal_log_selections', 'quantity_snapshot', 'DECIMAL(8,2) NULL');
      await ensureColumnExists(db, 'meal_log_selections', 'unit_code_snapshot', 'VARCHAR(50) NULL');
      await ensureColumnExists(db, 'meal_log_selections', 'calories_snapshot', 'DECIMAL(8,2) NULL');
      await ensureColumnExists(db, 'meal_log_selections', 'protein_snapshot', 'DECIMAL(6,2) NULL');
      await ensureColumnExists(db, 'meal_log_selections', 'carbs_snapshot', 'DECIMAL(6,2) NULL');
      await ensureColumnExists(db, 'meal_log_selections', 'fat_snapshot', 'DECIMAL(6,2) NULL');

      // Slice 10: Daily Tasks, Adherence, Reminders, Notifications
      await ensureColumnExists(db, 'daily_tasks', 'task_key', "VARCHAR(191) NOT NULL DEFAULT ''");
      await ensureColumnExists(db, 'daily_tasks', 'user_diet_assignment_id', 'INTEGER NULL');
      await ensureColumnExists(db, 'daily_tasks', 'user_workout_assignment_id', 'INTEGER NULL');
      await ensureColumnExists(db, 'daily_tasks', 'diet_meal_id', 'INTEGER NULL');
      await ensureColumnExists(db, 'daily_tasks', 'workout_plan_day_id', 'INTEGER NULL');
      await ensureColumnExists(db, 'daily_tasks', 'user_cardio_target_id', 'INTEGER NULL');
      await ensureColumnExists(db, 'daily_tasks', 'user_water_target_id', 'INTEGER NULL');
      await ensureColumnExists(db, 'daily_tasks', 'user_weight_goal_id', 'INTEGER NULL');
      await ensureColumnExists(db, 'daily_tasks', 'title_snapshot', "VARCHAR(255) NOT NULL DEFAULT ''");
      await ensureColumnExists(db, 'daily_tasks', 'description_snapshot', 'TEXT NULL');
      await ensureColumnExists(db, 'daily_tasks', 'target_snapshot', 'TEXT NULL');
      await ensureColumnExists(db, 'daily_tasks', 'scheduled_at', 'DATETIME NULL');
      await ensureColumnExists(db, 'daily_tasks', 'due_at', 'DATETIME NULL');

      await ensureColumnExists(db, 'user_adherence_configs', 'diet_weight_pct', 'DECIMAL(5,2) NOT NULL DEFAULT 35');
      await ensureColumnExists(db, 'user_adherence_configs', 'workout_weight_pct', 'DECIMAL(5,2) NOT NULL DEFAULT 25');
      await ensureColumnExists(db, 'user_adherence_configs', 'cardio_weight_pct', 'DECIMAL(5,2) NOT NULL DEFAULT 15');
      await ensureColumnExists(db, 'user_adherence_configs', 'water_weight_pct', 'DECIMAL(5,2) NOT NULL DEFAULT 15');
      await ensureColumnExists(db, 'user_adherence_configs', 'weight_logging_weight_pct', 'DECIMAL(5,2) NOT NULL DEFAULT 10');
      await ensureColumnExists(db, 'user_adherence_configs', 'effective_from', 'DATE NULL');
      await ensureColumnExists(db, 'user_adherence_configs', 'effective_until', 'DATE NULL');
      await ensureColumnExists(db, 'user_adherence_configs', 'is_active', 'INTEGER NOT NULL DEFAULT 1');

      await ensureColumnExists(db, 'user_notification_settings', 'in_app_enabled', 'INTEGER NOT NULL DEFAULT 1');
      await ensureColumnExists(db, 'user_notification_settings', 'push_enabled', 'INTEGER NOT NULL DEFAULT 1');
      await ensureColumnExists(db, 'user_notification_settings', 'local_notifications_enabled', 'INTEGER NOT NULL DEFAULT 1');
      await ensureColumnExists(db, 'user_notification_settings', 'quiet_hours_enabled', 'INTEGER NOT NULL DEFAULT 0');
      await ensureColumnExists(db, 'user_notification_settings', 'quiet_hours_start', 'TIME NULL');
      await ensureColumnExists(db, 'user_notification_settings', 'quiet_hours_end', 'TIME NULL');

      await ensureColumnExists(db, 'reminder_rules', 'name', "VARCHAR(191) NOT NULL DEFAULT ''");
      await ensureColumnExists(db, 'reminder_rules', 'rule_scope', "VARCHAR(20) NOT NULL DEFAULT 'user'");
      await ensureColumnExists(db, 'reminder_rules', 'trigger_mode', "VARCHAR(20) NOT NULL DEFAULT 'fixed_time'");
      await ensureColumnExists(db, 'reminder_rules', 'offset_minutes', 'INTEGER NULL');
      await ensureColumnExists(db, 'reminder_rules', 'grace_period_minutes', 'INTEGER NOT NULL DEFAULT 0');
      await ensureColumnExists(db, 'reminder_rules', 'repeat_interval_minutes', 'INTEGER NULL');
      await ensureColumnExists(db, 'reminder_rules', 'max_repeats', 'INTEGER NOT NULL DEFAULT 1');
      await ensureColumnExists(db, 'reminder_rules', 'active_window_start', 'TIME NULL');
      await ensureColumnExists(db, 'reminder_rules', 'active_window_end', 'TIME NULL');
      await ensureColumnExists(db, 'reminder_rules', 'created_by', 'INTEGER NULL');

      await ensureColumnExists(db, 'notifications', 'daily_task_id', 'INTEGER NULL');
      await ensureColumnExists(db, 'notifications', 'reminder_rule_id', 'INTEGER NULL');
      await ensureColumnExists(db, 'notifications', 'message', "TEXT NOT NULL DEFAULT ''");
      await ensureColumnExists(db, 'notifications', 'deep_link', 'VARCHAR(500) NULL');
      await ensureColumnExists(db, 'notifications', 'dedupe_key', 'VARCHAR(191) NULL');
      await ensureColumnExists(db, 'notifications', 'scheduled_at', 'DATETIME NULL');
      await ensureColumnExists(db, 'notifications', 'status', "VARCHAR(20) NOT NULL DEFAULT 'unread'");
      await ensureColumnExists(db, 'notifications', 'dismissed_at', 'DATETIME NULL');
      await ensureColumnExists(db, 'notifications', 'updated_at', 'DATETIME NULL');

      await ensureColumnExists(db, 'notification_deliveries', 'user_push_device_id', 'INTEGER NULL');
      await ensureColumnExists(db, 'notification_deliveries', 'channel', "VARCHAR(20) NOT NULL DEFAULT 'in_app'");
      await ensureColumnExists(db, 'notification_deliveries', 'provider_message_id', 'VARCHAR(500) NULL');
      await ensureColumnExists(db, 'notification_deliveries', 'attempt_count', 'INTEGER NOT NULL DEFAULT 0');
      await ensureColumnExists(db, 'notification_deliveries', 'last_error', 'TEXT NULL');
      await ensureColumnExists(db, 'notification_deliveries', 'sent_at', 'DATETIME NULL');

      await ensureColumnExists(db, 'user_daily_summaries', 'weight_kg', 'DECIMAL(6,2) NULL');
      await ensureColumnExists(db, 'user_daily_summaries', 'meals_expected', 'INTEGER NOT NULL DEFAULT 0');
      await ensureColumnExists(db, 'user_daily_summaries', 'meals_completed', 'INTEGER NOT NULL DEFAULT 0');
      await ensureColumnExists(db, 'user_daily_summaries', 'meals_partial', 'INTEGER NOT NULL DEFAULT 0');
      await ensureColumnExists(db, 'user_daily_summaries', 'meals_skipped', 'INTEGER NOT NULL DEFAULT 0');
      await ensureColumnExists(db, 'user_daily_summaries', 'workout_expected', 'INTEGER NOT NULL DEFAULT 0');
      await ensureColumnExists(db, 'user_daily_summaries', 'workout_completed', 'INTEGER NOT NULL DEFAULT 0');
      await ensureColumnExists(db, 'user_daily_summaries', 'cardio_target_minutes', 'INTEGER NULL');
      await ensureColumnExists(db, 'user_daily_summaries', 'cardio_actual_minutes', 'INTEGER NOT NULL DEFAULT 0');
      await ensureColumnExists(db, 'user_daily_summaries', 'water_target_ml', 'INTEGER NULL');
      await ensureColumnExists(db, 'user_daily_summaries', 'water_actual_ml', 'INTEGER NOT NULL DEFAULT 0');
      await ensureColumnExists(db, 'user_daily_summaries', 'weight_logged', 'INTEGER NOT NULL DEFAULT 0');
      await ensureColumnExists(db, 'user_daily_summaries', 'weight_logging_adherence_pct', 'DECIMAL(5,2) NULL');

      // Data Backfills from legacy column names
      await backfillColumnData(db, 'workout_sessions', 'workout_date', 'session_date', 'session_date');
      await backfillColumnData(db, 'workout_plan_versions', 'change_summary', 'change_notes', 'change_notes');
      await backfillColumnData(db, 'diet_plan_versions', 'change_summary', 'change_notes', 'change_notes');
      await backfillColumnData(db, 'diet_meals', 'order_index', 'meal_order', 'meal_order');
      await backfillColumnData(db, 'diet_meal_option_groups', 'order_index', 'group_order', 'group_order');
      await backfillColumnData(db, 'diet_meal_options', 'order_index', 'option_order', 'option_order');
      await backfillColumnData(db, 'diet_meal_options', 'custom_label', 'label', 'label');
      await backfillColumnData(db, 'diet_meal_options', 'serving_quantity', 'quantity', 'quantity');
      await backfillColumnData(db, 'workout_plan_days', 'day_order', 'day_number', 'day_number');
      await backfillColumnData(db, 'workout_plan_exercises', 'exercise_order', 'order_in_day', 'order_in_day');
      await backfillColumnData(db, 'workout_plan_exercise_sets', 'set_order', 'set_number', 'set_number');
      await backfillColumnData(db, 'workout_plan_exercise_sets', 'reps_min_target', 'reps_min', 'reps_min');
      await backfillColumnData(db, 'workout_plan_exercise_sets', 'reps_max_target', 'reps_max', 'reps_max');
      await backfillColumnData(db, 'workout_plan_exercise_sets', 'weight_kg_target', 'weight_kg', 'weight_kg');
      await backfillColumnData(db, 'workout_plan_exercise_sets', 'duration_seconds_target', 'duration_seconds', 'duration_seconds');
      await backfillColumnData(db, 'workout_plan_exercise_sets', 'rest_seconds_target', 'rest_seconds', 'rest_seconds');
      await backfillColumnData(db, 'workout_session_exercises', 'exercise_order', 'order_index', 'order_index');
      await backfillColumnData(db, 'workout_sets', 'performed_at', 'created_at', 'created_at');
      await backfillColumnData(db, 'daily_tasks', 'title_snapshot', 'title', 'title');
      await backfillColumnData(db, 'daily_tasks', 'description_snapshot', 'description', 'description');
      await backfillColumnData(db, 'daily_tasks', 'scheduled_at', getScheduledAtBackfillExpr(configuredDbClient()), 'scheduled_time');
      await backfillColumnData(db, 'user_adherence_configs', 'diet_weight_pct', 'diet_weight * 100', 'diet_weight', 'diet_weight <= 1.0');
      await backfillColumnData(db, 'user_adherence_configs', 'workout_weight_pct', 'workout_weight * 100', 'workout_weight', 'workout_weight <= 1.0');
      await backfillColumnData(db, 'user_adherence_configs', 'cardio_weight_pct', 'cardio_weight * 100', 'cardio_weight', 'cardio_weight <= 1.0');
      await backfillColumnData(db, 'user_adherence_configs', 'water_weight_pct', 'water_weight * 100', 'water_weight', 'water_weight <= 1.0');
      await backfillColumnData(db, 'user_adherence_configs', 'weight_logging_weight_pct', 'weight_logging_weight * 100', 'weight_logging_weight', 'weight_logging_weight <= 1.0');
      await backfillColumnData(db, 'user_notification_settings', 'push_enabled', 'allow_push', 'allow_push');
      await backfillColumnData(db, 'user_notification_settings', 'in_app_enabled', 'allow_in_app', 'allow_in_app');
      await backfillColumnData(db, 'user_notification_settings', 'local_notifications_enabled', 'allow_reminders', 'allow_reminders');
      await backfillColumnData(db, 'reminder_rules', 'name', 'title', 'title');
      await backfillColumnData(db, 'reminder_rules', 'trigger_mode', 'mode', 'mode');
      await backfillColumnData(db, 'notifications', 'message', 'body', 'body');
      await backfillColumnData(db, 'notifications', 'dedupe_key', 'dedup_key', 'dedup_key');
      await backfillColumnData(db, 'notifications', 'status', "CASE WHEN is_read = 1 THEN 'read' ELSE 'unread' END", 'is_read');
      await backfillColumnData(db, 'notification_deliveries', 'channel', 'delivery_channel', 'delivery_channel');
      await backfillColumnData(db, 'user_daily_summaries', 'water_actual_ml', 'total_water_ml', 'total_water_ml');
      await backfillColumnData(db, 'user_daily_summaries', 'cardio_actual_minutes', 'total_cardio_minutes', 'total_cardio_minutes');
      await backfillColumnData(db, 'user_daily_summaries', 'workout_completed', 'workout_session_completed', 'workout_session_completed');
      await backfillColumnData(db, 'user_daily_summaries', 'weight_kg', 'weight_recorded_kg', 'weight_recorded_kg');
      await backfillColumnData(db, 'user_daily_summaries', 'weight_logging_adherence_pct', 'weight_logging_pct', 'weight_logging_pct');
    },
  },
  {
    version: '005-self-service-and-rir-removal',
    up: async (db) => {
      logger.info('Running migration 005: self-service configuration fields, OTP security tables, and RIR removal');

      // 1. New user columns
      await ensureColumnExists(db, 'users', 'security_version', 'INTEGER NOT NULL DEFAULT 1');
      await ensureColumnExists(db, 'users', 'email_verified_at', 'DATETIME NULL');
      await ensureColumnExists(db, 'users', 'unit_system', "VARCHAR(10) NOT NULL DEFAULT 'metric'");

      // 2. Private plan owner and visibility
      await ensureColumnExists(db, 'workout_plans', 'owner_user_id', 'INTEGER NULL');
      await ensureColumnExists(db, 'workout_plans', 'visibility', "VARCHAR(20) NOT NULL DEFAULT 'admin'");
      await ensureColumnExists(db, 'diet_plans', 'owner_user_id', 'INTEGER NULL');
      await ensureColumnExists(db, 'diet_plans', 'visibility', "VARCHAR(20) NOT NULL DEFAULT 'admin'");

      // 3. Assignment source
      await ensureColumnExists(db, 'user_workout_assignments', 'assignment_source', "VARCHAR(20) NOT NULL DEFAULT 'admin'");
      await ensureColumnExists(db, 'user_diet_assignments', 'assignment_source', "VARCHAR(20) NOT NULL DEFAULT 'admin'");

      // 4. Weight goal type
      await ensureColumnExists(db, 'user_weight_goals', 'goal_type', "VARCHAR(30) NULL DEFAULT 'lose_weight'");

      // 5. Auth OTP Challenges table
      if (configuredDbClient() === 'sqlite') {
        await db.execute(`
          CREATE TABLE IF NOT EXISTS auth_otp_challenges (
            id VARCHAR(64) PRIMARY KEY,
            user_id INTEGER NULL,
            purpose VARCHAR(50) NOT NULL,
            destination_email VARCHAR(255) NOT NULL,
            otp_hash VARCHAR(128) NOT NULL,
            expires_at DATETIME NOT NULL,
            consumed_at DATETIME NULL,
            failed_attempts INTEGER NOT NULL DEFAULT 0,
            max_attempts INTEGER NOT NULL DEFAULT 5,
            last_sent_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
          )
        `);
        await db.execute(`CREATE INDEX IF NOT EXISTS idx_otp_challenges_user ON auth_otp_challenges(user_id, purpose)`);
        await db.execute(`CREATE INDEX IF NOT EXISTS idx_otp_challenges_dest ON auth_otp_challenges(destination_email, purpose)`);

        await db.execute(`
          CREATE TABLE IF NOT EXISTS user_email_change_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            new_email VARCHAR(255) NOT NULL,
            current_email_challenge_id VARCHAR(64) NOT NULL,
            new_email_challenge_id VARCHAR(64) NOT NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'pending',
            expires_at DATETIME NOT NULL,
            completed_at DATETIME NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (current_email_challenge_id) REFERENCES auth_otp_challenges(id) ON DELETE CASCADE,
            FOREIGN KEY (new_email_challenge_id) REFERENCES auth_otp_challenges(id) ON DELETE CASCADE
          )
        `);
      } else {
        await db.execute(`
          CREATE TABLE IF NOT EXISTS auth_otp_challenges (
            id VARCHAR(64) PRIMARY KEY,
            user_id BIGINT UNSIGNED NULL,
            purpose VARCHAR(50) NOT NULL,
            destination_email VARCHAR(255) NOT NULL,
            otp_hash VARCHAR(128) NOT NULL,
            expires_at TIMESTAMP(3) NOT NULL,
            consumed_at TIMESTAMP(3) NULL,
            failed_attempts INT UNSIGNED NOT NULL DEFAULT 0,
            max_attempts INT UNSIGNED NOT NULL DEFAULT 5,
            last_sent_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
            created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
            CONSTRAINT fk_otp_challenges_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            INDEX idx_otp_challenges_user (user_id, purpose),
            INDEX idx_otp_challenges_dest (destination_email, purpose)
          ) ENGINE=InnoDB
        `);

        await db.execute(`
          CREATE TABLE IF NOT EXISTS user_email_change_requests (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            user_id BIGINT UNSIGNED NOT NULL,
            new_email VARCHAR(255) NOT NULL,
            current_email_challenge_id VARCHAR(64) NOT NULL,
            new_email_challenge_id VARCHAR(64) NOT NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'pending',
            expires_at TIMESTAMP(3) NOT NULL,
            completed_at TIMESTAMP(3) NULL,
            created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
            CONSTRAINT fk_email_change_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            CONSTRAINT fk_email_change_cur_challenge FOREIGN KEY (current_email_challenge_id) REFERENCES auth_otp_challenges(id) ON DELETE CASCADE,
            CONSTRAINT fk_email_change_new_challenge FOREIGN KEY (new_email_challenge_id) REFERENCES auth_otp_challenges(id) ON DELETE CASCADE
          ) ENGINE=InnoDB
        `);
      }

      // 6. Complete RIR Removal
      if (configuredDbClient() === 'sqlite') {
        const hasRirTarget = await db.queryOne<{ count: number }>(
          `SELECT COUNT(*) as count FROM pragma_table_info('workout_plan_exercises') WHERE name = 'rir_target'`
        );
        if ((hasRirTarget?.count || 0) > 0) {
          await db.execute(`ALTER TABLE workout_plan_exercises DROP COLUMN rir_target`);
        }

        const hasSetRirTarget = await db.queryOne<{ count: number }>(
          `SELECT COUNT(*) as count FROM pragma_table_info('workout_plan_exercise_sets') WHERE name = 'rir_target'`
        );
        if ((hasSetRirTarget?.count || 0) > 0) {
          await db.execute(`ALTER TABLE workout_plan_exercise_sets DROP COLUMN rir_target`);
        }

        const hasSessionRir = await db.queryOne<{ count: number }>(
          `SELECT COUNT(*) as count FROM pragma_table_info('workout_session_exercises') WHERE name = 'planned_rir_snapshot'`
        );
        if ((hasSessionRir?.count || 0) > 0) {
          await db.execute(`ALTER TABLE workout_session_exercises DROP COLUMN planned_rir_snapshot`);
        }

        const hasSetRir = await db.queryOne<{ count: number }>(
          `SELECT COUNT(*) as count FROM pragma_table_info('workout_sets') WHERE name = 'rir'`
        );
        if ((hasSetRir?.count || 0) > 0) {
          await db.execute(`ALTER TABLE workout_sets DROP COLUMN rir`);
        }
      } else {
        // MySQL dialect: inspect before each DDL operation so migration failures
        // are not hidden by broad exception handling.
        if (await mysqlConstraintExists(db, 'workout_plan_exercises', 'chk_workout_rir')) {
          await db.execute(`ALTER TABLE workout_plan_exercises DROP CHECK chk_workout_rir`);
        }
        if (await mysqlColumnExists(db, 'workout_plan_exercises', 'rir_target')) {
          await db.execute(`ALTER TABLE workout_plan_exercises DROP COLUMN rir_target`);
        }
        if (await mysqlColumnExists(db, 'workout_plan_exercise_sets', 'rir_target')) {
          await db.execute(`ALTER TABLE workout_plan_exercise_sets DROP COLUMN rir_target`);
        }
        if (await mysqlColumnExists(db, 'workout_session_exercises', 'planned_rir_snapshot')) {
          await db.execute(`ALTER TABLE workout_session_exercises DROP COLUMN planned_rir_snapshot`);
        }
        if (await mysqlConstraintExists(db, 'workout_sets', 'chk_workout_set_rir')) {
          await db.execute(`ALTER TABLE workout_sets DROP CHECK chk_workout_set_rir`);
        }
        if (await mysqlColumnExists(db, 'workout_sets', 'rir')) {
          await db.execute(`ALTER TABLE workout_sets DROP COLUMN rir`);
        }
      }
    },
  },
  {
    version: '006-cardio-and-plan-validation-compatibility',
    up: async (db) => {
      logger.info('Running migration 006: target status enum harmonization and self-service plan compatibility');

      if (configuredDbClient() === 'mysql') {
        try {
          await db.execute(`
            ALTER TABLE user_cardio_targets 
            MODIFY COLUMN status ENUM('active', 'ended', 'cancelled', 'inactive') NOT NULL DEFAULT 'active'
          `);
        } catch (err) {
          logger.warn({ err }, 'Could not modify user_cardio_targets status enum');
        }

        try {
          await db.execute(`
            ALTER TABLE user_water_targets 
            MODIFY COLUMN status ENUM('active', 'ended', 'cancelled', 'inactive') NOT NULL DEFAULT 'active'
          `);
        } catch (err) {
          logger.warn({ err }, 'Could not modify user_water_targets status enum');
        }
      }
    },
  },
  {
    version: '007-passkey-authentication-tables',
    up: async (db) => {
      logger.info('Running migration 007: creating passkey and webauthn challenge tables');

      if (configuredDbClient() === 'sqlite') {
        await db.execute(`
          CREATE TABLE IF NOT EXISTS user_passkeys (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            credential_id VARCHAR(255) NOT NULL UNIQUE,
            public_key TEXT NOT NULL,
            credential_format VARCHAR(30) NOT NULL DEFAULT 'webauthn-cose',
            counter INTEGER NOT NULL DEFAULT 0,
            device_name VARCHAR(150) NOT NULL,
            transports VARCHAR(255) NULL,
            aaguid VARCHAR(64) NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            last_used_at DATETIME NULL,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
          )
        `);

        await db.execute(`
          CREATE TABLE IF NOT EXISTS auth_webauthn_challenges (
            id VARCHAR(100) PRIMARY KEY,
            user_id INTEGER NULL,
            challenge VARCHAR(255) NOT NULL,
            ceremony_type VARCHAR(30) NOT NULL,
            expires_at DATETIME NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
          )
        `);

        await db.execute(`CREATE INDEX IF NOT EXISTS idx_user_passkeys_user ON user_passkeys (user_id)`);
        await db.execute(`CREATE INDEX IF NOT EXISTS idx_webauthn_challenges_exp ON auth_webauthn_challenges (expires_at)`);
      } else {
        await db.execute(`
          CREATE TABLE IF NOT EXISTS user_passkeys (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            user_id BIGINT UNSIGNED NOT NULL,
            credential_id VARCHAR(255) NOT NULL,
            public_key TEXT NOT NULL,
            credential_format VARCHAR(30) NOT NULL DEFAULT 'webauthn-cose',
            counter BIGINT UNSIGNED NOT NULL DEFAULT 0,
            device_name VARCHAR(150) NOT NULL,
            transports VARCHAR(255) NULL,
            aaguid VARCHAR(64) NULL,
            created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
            last_used_at TIMESTAMP(3) NULL,
            CONSTRAINT uq_passkeys_credential_id UNIQUE (credential_id),
            CONSTRAINT fk_passkeys_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            INDEX idx_passkeys_user (user_id)
          ) ENGINE=InnoDB
        `);

        await db.execute(`
          CREATE TABLE IF NOT EXISTS auth_webauthn_challenges (
            id VARCHAR(100) PRIMARY KEY,
            user_id BIGINT UNSIGNED NULL,
            challenge VARCHAR(255) NOT NULL,
            ceremony_type VARCHAR(30) NOT NULL,
            expires_at TIMESTAMP(3) NOT NULL,
            created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
            CONSTRAINT fk_webauthn_challenges_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            INDEX idx_webauthn_challenges_exp (expires_at)
          ) ENGINE=InnoDB
        `);
      }
    },
  },
  {
    version: '008-passkey-credential-format-and-plan-set-compatibility',
    up: async (db) => {
      logger.info('Running migration 008: hardening passkey storage and reconciling plan prescription columns');

      await ensureColumnExists(db, 'user_passkeys', 'credential_format', "VARCHAR(30) NOT NULL DEFAULT 'webauthn-cose'");

      // Keep the canonical workout date populated even when an older database
      // recorded migration 004 before the legacy session-date column existed.
      await ensureColumnExists(db, 'workout_sessions', 'workout_date', 'DATE NULL');
      await backfillColumnData(db, 'workout_sessions', 'workout_date', 'session_date', 'session_date');

      // Canonical ordering is stored in the runtime columns used by the
      // services; retain compatibility with databases that only have the
      // previous order_index aliases.
      await ensureColumnExists(db, 'diet_meals', 'meal_order', 'INTEGER NOT NULL DEFAULT 1');
      await ensureColumnExists(db, 'diet_meal_option_groups', 'group_order', 'INTEGER NOT NULL DEFAULT 1');
      await ensureColumnExists(db, 'diet_meal_options', 'option_order', 'INTEGER NOT NULL DEFAULT 1');
      await ensureColumnExists(db, 'diet_meal_options', 'fiber_g_snapshot', 'DECIMAL(10,2) NULL');
      await reconcileOrderingColumns(db, 'diet_meals', 'meal_order', 'order_index');
      await reconcileOrderingColumns(db, 'diet_meal_option_groups', 'group_order', 'order_index');
      await reconcileOrderingColumns(db, 'diet_meal_options', 'option_order', 'order_index');

      // Previous records were created by the hand-rolled HMAC/SPKI flow and
      // cannot be trusted as WebAuthn registrations. Preserve them for
      // re-enrollment visibility, but make them unusable for authentication.
      await db.execute(`
        UPDATE user_passkeys
        SET credential_format = CASE
          WHEN public_key LIKE 'hmac:%' THEN 'legacy-hmac'
          ELSE 'legacy-unverified'
        END
        WHERE credential_format = 'webauthn-cose'
      `);

      // Older databases used alternate names for the per-set prescription
      // columns. Ensure the canonical columns exist for both SQLite and MySQL
      // and backfill them from the old names where those names are present.
      await ensureColumnExists(db, 'workout_plan_exercise_sets', 'set_number', 'INTEGER NOT NULL DEFAULT 1');
      await ensureColumnExists(db, 'workout_plan_exercise_sets', 'target_reps_min', 'INTEGER NULL');
      await ensureColumnExists(db, 'workout_plan_exercise_sets', 'target_reps_max', 'INTEGER NULL');
      await ensureColumnExists(db, 'workout_plan_exercise_sets', 'target_weight_kg', 'DECIMAL(8,2) NULL');
      await ensureColumnExists(db, 'workout_plan_exercise_sets', 'target_duration_seconds', 'INTEGER NULL');
      await ensureColumnExists(db, 'workout_plan_exercise_sets', 'target_distance_meters', 'DECIMAL(10,2) NULL');
      await ensureColumnExists(db, 'workout_plan_exercise_sets', 'rest_seconds', 'INTEGER NULL');
      await ensureColumnExists(db, 'workout_plan_exercise_sets', 'notes', 'VARCHAR(1000) NULL');

      await reconcileOrderingColumns(db, 'workout_plan_exercise_sets', 'set_number', 'set_order');
      await backfillColumnData(db, 'workout_plan_exercise_sets', 'target_reps_min', 'reps_min_target', 'reps_min_target');
      await backfillColumnData(db, 'workout_plan_exercise_sets', 'target_reps_max', 'reps_max_target', 'reps_max_target');
      await backfillColumnData(db, 'workout_plan_exercise_sets', 'target_reps_min', 'target_reps', 'target_reps');
      await backfillColumnData(db, 'workout_plan_exercise_sets', 'target_reps_max', 'target_reps', 'target_reps');
      await backfillColumnData(db, 'workout_plan_exercise_sets', 'target_weight_kg', 'weight_kg_target', 'weight_kg_target');
      await backfillColumnData(db, 'workout_plan_exercise_sets', 'target_duration_seconds', 'duration_seconds_target', 'duration_seconds_target');
      await backfillColumnData(db, 'workout_plan_exercise_sets', 'rest_seconds', 'rest_seconds_target', 'rest_seconds_target');
    },
  },
];

export async function runMigrations(customDb?: DatabasePool) {
  const db = customDb || getDatabasePool();
  logger.info('Running database migrations...');

  await db.execute(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(191) PRIMARY KEY,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  for (const migration of migrations) {
    const alreadyApplied = await db.queryOne(
      'SELECT version FROM schema_migrations WHERE version = ?',
      [migration.version],
    );
    if (!alreadyApplied) {
      logger.info({ version: migration.version }, `Applying migration ${migration.version}...`);
      await migration.up(db);
      await db.execute('INSERT INTO schema_migrations (version) VALUES (?)', [migration.version]);
      logger.info({ version: migration.version }, `Migration ${migration.version} applied successfully.`);
    }
  }

  // Idempotent safeguard: ensure unique index is created on active SQLite DB
  if (configuredDbClient() === 'sqlite') {
    const hasSessionDate = await db.queryOne<{ count: number }>(`SELECT COUNT(*) as count FROM pragma_table_info('workout_sessions') WHERE name = 'session_date'`);
    const dateCol = (hasSessionDate?.count || 0) > 0 ? 'session_date' : 'workout_date';
    await db.execute(`
      CREATE UNIQUE INDEX IF NOT EXISTS uidx_workout_sessions_user_session_date
      ON workout_sessions (user_id, ${dateCol}, workout_plan_day_id)
    `);
  }

  logger.info('Database migrations completed successfully.');
}

if (process.argv[1]?.includes('migrate')) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
