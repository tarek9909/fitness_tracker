import { env } from '../config/env.js';
import { getDatabasePool, resetDatabasePool } from '../database/pool.js';
import { runMigrations } from '../database/migrate.js';
import { seedDatabase } from '../database/seed.js';
import { logger } from '../config/logger.js';

async function resetDevelopmentDatabase() {
  if (env.nodeEnv === 'production') {
    throw new Error('FATAL: reset:dev is strictly prohibited in production environments.');
  }

  if (env.dbClient !== 'sqlite') {
    throw new Error('FATAL: reset:dev is only designed for local SQLite development.');
  }

  logger.warn('Initiating local development database reset...');
  const db = getDatabasePool();

  // 1. Disable foreign keys temporarily to drop all tables cleanly
  await db.execute('PRAGMA foreign_keys = OFF');

  // 2. Query all existing tables and views
  const tables = await db.query<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%'`
  );

  for (const t of tables) {
    await db.execute(`DROP TABLE IF EXISTS "${t.name}"`);
    await db.execute(`DROP VIEW IF EXISTS "${t.name}"`);
  }

  // 3. Re-enable foreign keys
  await db.execute('PRAGMA foreign_keys = ON');

  // 4. Re-run migrations and fresh baseline seed
  await runMigrations();
  await seedDatabase();

  logger.info('Local development SQLite database successfully recreated and seeded with fresh demo credentials.');
  logger.info('Demo Credentials Available:');
  logger.info('  - Super Admin: admin@fitnessplatform.com / Admin123!');
  logger.info('  - Demo User:   john.doe@fitnessplatform.com / User123!');
}

resetDevelopmentDatabase()
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error({ err }, 'Failed to reset local development database');
    process.exit(1);
  });
