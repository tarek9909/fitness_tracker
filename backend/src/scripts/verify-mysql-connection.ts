import mysql from 'mysql2/promise';
import { env } from '../config/env.js';

async function verifyMySQL() {
  console.log('\n=== MYSQL DATABASE CONNECTION & SCHEMA VERIFICATION ===');
  console.log(`Target Host: ${env.databaseHost}:${env.databasePort}`);
  console.log(`Target Database: ${env.databaseName}`);
  console.log(`Target User: ${env.databaseUser}`);

  let connection: mysql.Connection | null = null;
  try {
    connection = await mysql.createConnection({
      host: env.databaseHost,
      port: env.databasePort,
      user: env.databaseUser,
      password: env.databasePassword,
      database: env.databaseName,
      connectTimeout: 5000,
    });

    console.log('\n[1/4] Connection: SUCCESS (Connected to MySQL Server)');

    // 1. Version check
    const [versionRows] = await connection.query('SELECT VERSION() as version');
    const version = (versionRows as any[])[0]?.version;
    console.log(`[2/4] MySQL Engine Version: ${version}`);

    // 2. Table count
    const [tableRows] = await connection.query(
      `SELECT TABLE_NAME, TABLE_ROWS, ENGINE 
       FROM information_schema.tables 
       WHERE table_schema = ? 
       ORDER BY TABLE_NAME ASC`,
      [env.databaseName]
    );
    const tables = tableRows as any[];
    console.log(`[3/4] Tables Present in '${env.databaseName}': ${tables.length}`);
    tables.forEach((t) => {
      console.log(`  - ${t.TABLE_NAME} (${t.ENGINE})`);
    });

    // 3. Check schema migrations
    try {
      const [migrationRows] = await connection.query('SELECT version, applied_at FROM schema_migrations ORDER BY applied_at ASC');
      console.log('\n[4/4] Applied Schema Migrations:');
      console.log(JSON.stringify(migrationRows, null, 2));
    } catch {
      console.log('\n[4/4] schema_migrations table not yet present. Run `npm run migrate` to apply.');
    }

    console.log('\nMySQL integration verification completed successfully.');
  } catch (error: any) {
    console.error('\n[!] MySQL Connection Failed:');
    console.error(`    Code: ${error.code || 'UNKNOWN'}`);
    console.error(`    Message: ${error.message}`);
    if (error.code === 'ECONNREFUSED') {
      console.log('\nNOTE: MySQL daemon is currently offline or unreachable on this host.');
      console.log('To run against MySQL:');
      console.log('  1. Start MySQL 8.x: docker run -d -p 3306:3306 -e MYSQL_ROOT_PASSWORD=root -e MYSQL_DATABASE=fitness_platform mysql:8.0');
      console.log('  2. Set DB_CLIENT=mysql, DATABASE_PASSWORD=root in your local .env');
      console.log('  3. Run: npm run migrate && npm run verify:mysql');
    }
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

verifyMySQL().catch(() => {
  process.exit(1);
});
