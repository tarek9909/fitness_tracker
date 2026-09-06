import fs from 'node:fs/promises';
import path from 'node:path';
import { getDatabasePool } from '../database/pool.js';
import { env } from '../config/env.js';

function escapeSqlString(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n');
}

function formatSqlValue(val: any): string {
  if (val === null || val === undefined) {
    return 'NULL';
  }
  if (typeof val === 'number') {
    return Number.isFinite(val) ? val.toString() : 'NULL';
  }
  if (typeof val === 'boolean') {
    return val ? '1' : '0';
  }
  if (typeof val === 'object') {
    if (val instanceof Date) {
      return `'${val.toISOString().slice(0, 23).replace('T', ' ')}'`;
    }
    return `'${escapeSqlString(JSON.stringify(val))}'`;
  }
  return `'${escapeSqlString(String(val))}'`;
}

// Tables whose data should be included in the production export
const SEED_TABLES = [
  'schema_migrations',
  'roles',
  'measurement_units',
  'muscle_groups',
  'equipment_types',
  'exercises',
  'exercise_muscle_groups',
  'foods',
  'cardio_activities',
  'users',
  'user_notification_settings',
  'user_adherence_configs',
  'user_water_targets',
  'user_water_quick_add_options',
  'user_weight_goals',
  'user_cardio_targets',
  'user_cardio_target_days',
  'workout_plans',
  'workout_plan_versions',
  'workout_plan_days',
  'workout_plan_exercises',
  'workout_plan_exercise_sets',
  'user_workout_assignments',
  'diet_plans',
  'diet_plan_versions',
  'diet_meals',
  'diet_meal_option_groups',
  'diet_meal_options',
  'diet_meal_option_items',
  'user_diet_assignments',
  'daily_tasks',
  'reminder_rules',
];

export async function generateDatabaseDump(): Promise<string> {
  const db = getDatabasePool();

  const canonicalSchemaPath = path.resolve(process.cwd(), 'src', 'database', 'mysql', 'canonical-schema.sql');
  let baseSchema = await fs.readFile(canonicalSchemaPath, 'utf8');

  // Strip database creation from canonical schema to allow customizable db name
  baseSchema = baseSchema
    .replace(/CREATE DATABASE IF NOT EXISTS `?fitness_platform`?[^;]*;/i, '')
    .replace(/USE `?fitness_platform`?;/i, '')
    .trim();

  let dump = '';
  dump += `-- =====================================================================\n`;
  dump += `-- FITNESS TRACKING PLATFORM - COMPLETE PRODUCTION DATABASE DUMP\n`;
  dump += `-- Generated: ${new Date().toISOString()}\n`;
  dump += `-- Target Engine: MySQL 8.x / MariaDB 10.5+\n`;
  dump += `--\n`;
  dump += `-- Usage Instructions:\n`;
  dump += `--   mysql -h <host> -P <port> -u <user> -p <database_name> < fitness_tracker_dump.sql\n`;
  dump += `-- =====================================================================\n\n`;

  dump += `CREATE DATABASE IF NOT EXISTS \`fitness_platform\`\n`;
  dump += `    CHARACTER SET utf8mb4\n`;
  dump += `    COLLATE utf8mb4_unicode_ci;\n\n`;
  dump += `USE \`fitness_platform\`;\n\n`;

  dump += `SET FOREIGN_KEY_CHECKS = 0;\n`;
  dump += `SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";\n`;
  dump += `SET NAMES utf8mb4;\n\n`;

  dump += `-- =====================================================================\n`;
  dump += `-- 0. SCHEMA MIGRATIONS TABLE\n`;
  dump += `-- =====================================================================\n\n`;
  dump += `CREATE TABLE IF NOT EXISTS schema_migrations (\n`;
  dump += `    version VARCHAR(191) PRIMARY KEY,\n`;
  dump += `    applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP\n`;
  dump += `) ENGINE=InnoDB;\n\n`;

  dump += `-- =====================================================================\n`;
  dump += `-- CANONICAL BASELINE SCHEMA (50+ TABLES)\n`;
  dump += `-- =====================================================================\n\n`;
  dump += baseSchema + '\n\n';

  // Append modern tables if not already present in canonical schema
  if (!baseSchema.includes('user_passkeys')) {
    dump += `-- =====================================================================\n`;
    dump += `-- 52. USER PASSKEYS (WEBAUTHN / BIOMETRICS)\n`;
    dump += `-- =====================================================================\n\n`;
    dump += `CREATE TABLE IF NOT EXISTS user_passkeys (\n`;
    dump += `    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,\n`;
    dump += `    user_id BIGINT UNSIGNED NOT NULL,\n`;
    dump += `    credential_id VARCHAR(255) NOT NULL,\n`;
    dump += `    public_key TEXT NOT NULL,\n`;
    dump += `    credential_format VARCHAR(30) NOT NULL DEFAULT 'webauthn-cose',\n`;
    dump += `    counter BIGINT UNSIGNED NOT NULL DEFAULT 0,\n`;
    dump += `    device_name VARCHAR(150) NOT NULL,\n`;
    dump += `    transports VARCHAR(255) NULL,\n`;
    dump += `    aaguid VARCHAR(64) NULL,\n`;
    dump += `    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),\n`;
    dump += `    last_used_at TIMESTAMP(3) NULL,\n`;
    dump += `    CONSTRAINT uq_passkeys_credential_id UNIQUE (credential_id),\n`;
    dump += `    CONSTRAINT fk_passkeys_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,\n`;
    dump += `    INDEX idx_passkeys_user (user_id)\n`;
    dump += `) ENGINE=InnoDB;\n\n`;
  }

  if (!baseSchema.includes('auth_webauthn_challenges')) {
    dump += `-- =====================================================================\n`;
    dump += `-- 53. WEBAUTHN CHALLENGES\n`;
    dump += `-- =====================================================================\n\n`;
    dump += `CREATE TABLE IF NOT EXISTS auth_webauthn_challenges (\n`;
    dump += `    id VARCHAR(100) PRIMARY KEY,\n`;
    dump += `    user_id BIGINT UNSIGNED NULL,\n`;
    dump += `    challenge VARCHAR(255) NOT NULL,\n`;
    dump += `    ceremony_type VARCHAR(30) NOT NULL,\n`;
    dump += `    expires_at TIMESTAMP(3) NOT NULL,\n`;
    dump += `    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),\n`;
    dump += `    CONSTRAINT fk_webauthn_challenges_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,\n`;
    dump += `    INDEX idx_webauthn_challenges_exp (expires_at)\n`;
    dump += `) ENGINE=InnoDB;\n\n`;
  }

  dump += `-- =====================================================================\n`;
  dump += `-- BASELINE DATA & SEED CATALOG INSERTS\n`;
  dump += `-- =====================================================================\n\n`;

  for (const table of SEED_TABLES) {
    try {
      const rows = await db.query<any[]>(`SELECT * FROM "${table}"`);
      if (!rows || rows.length === 0) continue;

      const columns = Object.keys(rows[0]);
      dump += `-- Table: ${table} (${rows.length} rows)\n`;
      dump += `LOCK TABLES \`${table}\` WRITE;\n`;

      const chunkSize = 50;
      for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize);
        dump += `INSERT IGNORE INTO \`${table}\` (\`${columns.join('`, `')}\`) VALUES\n`;
        const valuesList = chunk.map((row: any) => {
          const rowVals = columns.map(col => formatSqlValue(row[col]));
          return `  (${rowVals.join(', ')})`;
        });
        dump += valuesList.join(',\n') + ';\n';
      }

      dump += `UNLOCK TABLES;\n\n`;
    } catch (err: any) {
      // If table does not exist in active DB, continue safely
      console.warn(`Note: Could not export rows for table ${table}: ${err.message}`);
    }
  }

  dump += `SET FOREIGN_KEY_CHECKS = 1;\n\n`;
  dump += `-- =====================================================================\n`;
  dump += `-- END OF DUMP\n`;
  dump += `-- =====================================================================\n`;

  return dump;
}

async function run() {
  console.log('⏳ Extracting complete database schema and seed data...');
  const dumpSql = await generateDatabaseDump();

  const pathsToWrite = [
    path.resolve(process.cwd(), 'fitness_tracker_dump.sql'),
    path.resolve(process.cwd(), '..', 'fitness_tracker_dump.sql'),
    path.resolve(process.cwd(), 'src', 'database', 'fitness_tracker_dump.sql'),
  ];

  for (const p of pathsToWrite) {
    await fs.writeFile(p, dumpSql, 'utf8');
    console.log(`✅ Dump saved: ${p} (${(dumpSql.length / 1024).toFixed(1)} KB)`);
  }

  // Also update canonical-schema.sql to include user_passkeys, auth_webauthn_challenges
  const canonicalPath = path.resolve(process.cwd(), 'src', 'database', 'mysql', 'canonical-schema.sql');
  let canonical = await fs.readFile(canonicalPath, 'utf8');
  if (!canonical.includes('user_passkeys')) {
    const passkeysDdl = `
-- =====================================================================
-- 52. USER PASSKEYS (WEBAUTHN / BIOMETRICS)
-- =====================================================================

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
) ENGINE=InnoDB;

-- =====================================================================
-- 53. WEBAUTHN CHALLENGES
-- =====================================================================

CREATE TABLE IF NOT EXISTS auth_webauthn_challenges (
    id VARCHAR(100) PRIMARY KEY,
    user_id BIGINT UNSIGNED NULL,
    challenge VARCHAR(255) NOT NULL,
    ceremony_type VARCHAR(30) NOT NULL,
    expires_at TIMESTAMP(3) NOT NULL,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    CONSTRAINT fk_webauthn_challenges_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_webauthn_challenges_exp (expires_at)
) ENGINE=InnoDB;
`;
    canonical = canonical.trim() + '\n' + passkeysDdl;
    await fs.writeFile(canonicalPath, canonical, 'utf8');
    console.log(`✅ Updated canonical-schema.sql with passkeys and webauthn challenges.`);
  }

  console.log('\n🎉 Complete database export succeeded!');
  process.exit(0);
}

if (process.argv[1]?.includes('export-database-dump')) {
  run().catch(err => {
    console.error('❌ Failed to export database dump:', err);
    process.exit(1);
  });
}
