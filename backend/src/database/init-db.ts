import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import mysql from 'mysql2/promise';
import { runMigrations } from './migrate.js';
import { seedDatabase } from './seed.js';

interface InitOptions {
  seed?: boolean;
}

async function resolveSchemaSql(): Promise<{ sql: string; filePath: string }> {
  const candidates = [
    path.resolve(process.cwd(), 'src', 'database', 'fitness_tracker.sql'),
    path.resolve(process.cwd(), 'src', 'database', 'fitness_tracker.db'),
    path.resolve(process.cwd(), 'fitness_tracker.sql'),
    path.resolve(process.cwd(), 'fitness_tracker.db'),
    path.resolve(process.cwd(), '..', 'fitness_tracker.db'),
    path.resolve(process.cwd(), 'dist', 'database', 'fitness_tracker.sql'),
    path.resolve(process.cwd(), 'dist', 'database', 'fitness_tracker.db'),
  ];

  for (const candidate of candidates) {
    try {
      const sql = await readFile(candidate, 'utf8');
      return { sql, filePath: candidate };
    } catch {
      // try next candidate location
    }
  }

  throw new Error(
    `MySQL schema file was not found. Checked locations:\n${candidates.map((c) => '  - ' + c).join('\n')}`
  );
}

function splitSqlStatements(sql: string): string[] {
  return sql
    .replace(/^\s*--.*$/gm, '') // Remove line comments
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .filter((s) => !/^CREATE DATABASE\b/i.test(s))
    .filter((s) => !/^USE\b/i.test(s));
}

export async function initDatabase(options: InitOptions = {}) {
  const client = (process.env.DB_CLIENT || 'sqlite').toLowerCase();

  console.log('\n======================================================');
  console.log('🚀 FITNESS PLATFORM DATABASE INITIALIZER');
  console.log('======================================================\n');
  console.log(`Configured Engine: ${client.toUpperCase()}`);

  if (client === 'mysql') {
    await initMysqlDatabase(options);
  } else if (client === 'sqlite') {
    await initSqliteDatabase(options);
  } else {
    throw new Error(`Unsupported DB_CLIENT: "${client}". Must be "mysql" or "sqlite".`);
  }
}

async function initMysqlDatabase(options: InitOptions) {
  const host = process.env.DATABASE_HOST || 'localhost';
  const port = Number(process.env.DATABASE_PORT || 3306);
  const database = process.env.DATABASE_NAME || 'fitness_platform';
  const user = process.env.DATABASE_USER || 'root';
  const password = process.env.DATABASE_PASSWORD || '';

  console.log(`Target Host:       ${host}:${port}`);
  console.log(`Target Database:   ${database}`);
  console.log(`Target User:       ${user}`);
  console.log('------------------------------------------------------');

  // Step 1: Connect to server without selecting database
  console.log('⏳ Connecting to MySQL server...');
  let rootConn: mysql.Connection;
  try {
    rootConn = await mysql.createConnection({
      host,
      port,
      user,
      password,
    });
    console.log('✅ Connected to MySQL server successfully.');
  } catch (err: any) {
    console.error(`\n❌ Failed to connect to MySQL server at ${host}:${port}`);
    console.error(`Error details: ${err.message}`);
    console.error('\nPlease verify:');
    console.error('1. Your MySQL server is running.');
    console.error('2. Host, port, user, and password in .env are correct.');
    throw err;
  }

  // Step 2: Ensure database exists
  try {
    console.log(`⏳ Ensuring database "${database}" exists...`);
    await rootConn.query(
      `CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
    );
    console.log(`✅ Database "${database}" verified / created.`);
  } finally {
    await rootConn.end();
  }

  // Step 3: Connect directly to target database
  console.log(`⏳ Connecting to database "${database}"...`);
  const dbConn = await mysql.createConnection({
    host,
    port,
    database,
    user,
    password,
    multipleStatements: true,
  });

  try {
    // Step 4: Resolve schema SQL
    const { sql, filePath } = await resolveSchemaSql();
    console.log(`📄 Using schema source: ${path.basename(filePath)} (${(sql.length / 1024).toFixed(1)} KB)`);

    // Step 5: Execute schema statements
    const rawStatements = splitSqlStatements(sql);
    console.log(`⏳ Executing ${rawStatements.length} schema statements...`);

    let tableCount = 0;
    for (const stmt of rawStatements) {
      let runnable = stmt;
      if (/^CREATE TABLE\s+/i.test(runnable)) {
        runnable = runnable.replace(/^CREATE TABLE\s+/i, 'CREATE TABLE IF NOT EXISTS ');
        tableCount++;
      }
      try {
        await dbConn.query(runnable);
      } catch (err: any) {
        if (!err.message?.includes('already exists') && !err.message?.includes('Duplicate key')) {
          console.warn(`Warning on statement: ${err.message}`);
        }
      }
    }
    console.log(`✅ Schema definitions executed successfully (${tableCount} tables).`);

    // Step 6: Mark schema migrations table
    await dbConn.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(191) PRIMARY KEY,
        applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    const baselineVersions = [
      '001-initial-schema',
      '002-workout-sessions-unique-user-date',
      '003-domain-columns-backfill',
    ];
    for (const v of baselineVersions) {
      await dbConn.query(
        `INSERT IGNORE INTO schema_migrations (version) VALUES (?);`,
        [v]
      );
    }
    console.log('✅ Baseline schema migrations registered.');

    // Step 7: Verify final table count from information_schema
    const [rows] = await dbConn.query<mysql.RowDataPacket[]>(
      `SELECT COUNT(*) as cnt FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?`,
      [database]
    );
    const totalTables = rows[0]?.cnt ?? 0;

    // Step 8: Optionally seed if requested and not production
    const shouldSeed = options.seed ?? process.argv.includes('--seed');
    if (shouldSeed) {
      if (process.env.NODE_ENV === 'production') {
        console.log('ℹ️  Skipping demo seed data because NODE_ENV=production.');
      } else {
        console.log('⏳ Seeding database with baseline system and demo accounts...');
        await seedDatabase();
        console.log('✅ Demo seed data inserted.');
      }
    } else {
      console.log('💡 Tip: Run "npm run seed" anytime to populate sample athletes, workouts, and foods.');
    }

    console.log('\n======================================================');
    console.log('🎉 DATABASE INITIALIZATION SUCCEEDED!');
    console.log('======================================================');
    console.log(`Database Name: ${database}`);
    console.log(`Total Tables:  ${totalTables}`);
    console.log(`Engine:        MySQL 8.x`);
    console.log('======================================================\n');
  } finally {
    await dbConn.end();
  }
}

async function initSqliteDatabase(options: InitOptions) {
  const dbPath = process.env.SQLITE_DB_PATH || './fitness_local.db';
  console.log(`Target SQLite File: ${dbPath}`);
  console.log('------------------------------------------------------');
  console.log('⏳ Running SQLite migrations...');
  await runMigrations();
  console.log(`✅ SQLite database initialized at ${dbPath}`);

  const shouldSeed = options.seed ?? process.argv.includes('--seed');
  if (shouldSeed) {
    if (process.env.NODE_ENV === 'production') {
      console.log('ℹ️  Skipping demo seed data because NODE_ENV=production.');
    } else {
      console.log('⏳ Seeding SQLite database...');
      await seedDatabase();
      console.log('✅ SQLite database seeded successfully.');
    }
  }

  console.log('\n======================================================');
  console.log('🎉 SQLITE DATABASE INITIALIZATION SUCCEEDED!');
  console.log('======================================================\n');
}

// Direct execution CLI runner
if (process.argv[1]?.includes('init-db')) {
  initDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('\n❌ Fatal error initializing database:', err);
      process.exit(1);
    });
}
