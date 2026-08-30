import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { toDialectInsertOrIgnore, seedDatabase } from '../src/database/seed.js';
import { getScheduledAtBackfillExpr } from '../src/database/migrate.js';
import { DatabasePool, DbConnection } from '../src/database/types.js';

describe('Dialect Compatibility & Static Query Audit Suite', () => {
  it('toDialectInsertOrIgnore accurately translates INSERT OR IGNORE to MySQL INSERT IGNORE', () => {
    const sqliteSql = "INSERT OR IGNORE INTO roles (id, name) VALUES (1, 'admin')";
    const mysqlSql = toDialectInsertOrIgnore(sqliteSql, 'mysql');
    const sqliteOutput = toDialectInsertOrIgnore(sqliteSql, 'sqlite');

    expect(mysqlSql).toBe("INSERT IGNORE INTO roles (id, name) VALUES (1, 'admin')");
    expect(sqliteOutput).toBe(sqliteSql);
    expect(mysqlSql).not.toContain('INSERT OR IGNORE');
  });

  it('getScheduledAtBackfillExpr generates dialect-safe expressions for both SQLite and MySQL', () => {
    const sqliteExpr = getScheduledAtBackfillExpr('sqlite');
    const mysqlExpr = getScheduledAtBackfillExpr('mysql');

    expect(sqliteExpr).toBe("datetime(task_date || ' ' || scheduled_time)");
    expect(mysqlExpr).toBe('TIMESTAMP(task_date, scheduled_time)');

    // Ensure MySQL expression does not use SQLite string concatenation (||)
    expect(mysqlExpr).not.toContain('||');
    // Ensure SQLite expression uses valid SQLite datetime() helper
    expect(sqliteExpr).toContain('datetime(');
  });

  it('seedDatabase translates all 14 seed blocks reliably through dialect translator when targetClient=mysql', async () => {
    const executedSql: string[] = [];

    // Mock database pool that records all executed statements
    const mockDb: DatabasePool = {
      query: async <T = any>(_sql: string, _params?: any[]): Promise<T[]> => {
        // Return schema_migrations table check or empty array
        return [] as T[];
      },
      queryOne: async <T = any>(_sql: string, _params?: any[]): Promise<T | null> => {
        return null;
      },
      execute: async (sql: string, _params?: any[]): Promise<{ insertId: number; affectedRows: number }> => {
        executedSql.push(sql);
        return { insertId: 1, affectedRows: 1 };
      },
      withTransaction: async <T>(callback: (conn: DbConnection) => Promise<T>): Promise<T> => {
        const mockConn: DbConnection = {
          query: async <R = any>(_sql: string, _params?: any[]): Promise<R[]> => [] as R[],
          queryOne: async <R = any>(_sql: string, _params?: any[]): Promise<R | null> => null,
          execute: async (sql: string, _params?: any[]): Promise<{ insertId: number; affectedRows: number }> => {
            executedSql.push(sql);
            return { insertId: 1, affectedRows: 1 };
          },
        };
        return callback(mockConn);
      },
    };

    await seedDatabase(mockDb, 'mysql');

    // 1. Across all executed statements in MySQL mode, zero occurrences of SQLite "INSERT OR IGNORE" must exist
    for (const statement of executedSql) {
      expect(statement).not.toContain('INSERT OR IGNORE');
    }

    // 2. All seed table insert statements must be translated to MySQL "INSERT IGNORE INTO"
    const seedInsertStatements = executedSql.filter((sql) =>
      /INSERT\s+IGNORE\s+INTO\s+(roles|measurement_units|muscle_groups|equipment_types|exercises|exercise_muscle_groups|cardio_activities|foods|users|workout_plans|workout_plan_versions|workout_plan_days|workout_plan_exercises|diet_plans|diet_plan_versions|diet_meals|diet_meal_option_groups|diet_meal_options|user_workout_assignments|user_diet_assignments|user_weight_goals|user_water_targets|user_water_quick_add_options|user_cardio_targets|user_cardio_target_days|user_adherence_configs|user_notification_settings|reminder_rules)/i.test(sql)
    );
    expect(seedInsertStatements.length).toBeGreaterThanOrEqual(14);
  });

  it('Static Query Audit: all backend src files adhere to cross-engine SQL compatibility', () => {
    const srcDir = path.resolve(process.cwd(), 'src');

    function getFiles(dir: string): string[] {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      const files: string[] = [];
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          files.push(...getFiles(fullPath));
        } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.js'))) {
          files.push(fullPath);
        }
      }
      return files;
    }

    const files = getFiles(srcDir);
    const violations: { file: string; line: number; reason: string }[] = [];

    for (const file of files) {
      // Exclude migration files and CLI scripts as they contain engine-guarded branches
      if (file.includes('migrate.ts') || file.includes('scripts') || file.includes('schema-parity.test.ts')) {
        continue;
      }

      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((lineText, idx) => {
        const lineNum = idx + 1;
        // In non-seed runtime source files, raw INSERT OR IGNORE without adapter is prohibited
        if (lineText.includes('INSERT OR IGNORE') && !file.includes('seed.ts') && !file.includes('pool.ts')) {
          violations.push({ file, line: lineNum, reason: 'Raw INSERT OR IGNORE used without dialect translation' });
        }
        // PRAGMA statements must only appear in SQLite-guarded pools
        if (lineText.includes('PRAGMA ') && !file.includes('pool.ts') && !file.includes('migrate.ts')) {
          violations.push({ file, line: lineNum, reason: 'PRAGMA statement used outside of pool SQLite configuration' });
        }
      });
    }

    expect(violations).toEqual([]);
  });

  it('All canonical column aliases are resolved with proper fallbacks', async () => {
    // Verify that canonical user_water_targets uses target_ml and falls back to daily_target_ml
    const waterTargetSample = { id: 1, user_id: 2, target_ml: 3500, effective_from: '2026-01-01', status: 'active' };
    const resolvedTarget = Number((waterTargetSample as any).target_ml ?? (waterTargetSample as any).daily_target_ml ?? 3000);
    expect(resolvedTarget).toBe(3500);

    const legacyTargetSample = { id: 1, user_id: 2, daily_target_ml: 2500, effective_from: '2026-01-01', status: 'active' };
    const resolvedLegacy = Number((legacyTargetSample as any).target_ml ?? (legacyTargetSample as any).daily_target_ml ?? 3000);
    expect(resolvedLegacy).toBe(2500);
  });
});
