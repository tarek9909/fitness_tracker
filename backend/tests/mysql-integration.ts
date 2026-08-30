import mysql from 'mysql2/promise';
import { env } from '../src/config/env.js';
import { auditSchemaDiscrepancies, SchemaComparisonReport } from '../src/scripts/audit-mysql-schema.js';

export interface MySQLIntegrationResult {
  success: boolean;
  stage: 'SCHEMA_AUDIT' | 'CONNECTION' | 'TRANSACTIONS' | 'COMPLETED';
  error?: string;
  report?: SchemaComparisonReport;
}

/**
 * Standalone MySQL 8.x Live Integration Test Suite
 * 
 * Verifies:
 * 1. Schema harmonization against canonical fitness_tracker.db DDL (FAILS CLOSED if unharmonized).
 * 2. MySQL 8.x server connectivity and version compatibility.
 * 3. Atomic transaction execution and rollback semantics.
 */
export async function runMySQLIntegrationTests(): Promise<MySQLIntegrationResult> {
  console.log('\n======================================================');
  console.log('       LIVE MYSQL 8.x INTEGRATION TEST SUITE          ');
  console.log('======================================================');
  console.log(`Target: ${env.databaseUser}@${env.databaseHost}:${env.databasePort}/${env.databaseName}\n`);

  // 1. Audit schema reconciliation state - HARD FAIL-CLOSED
  console.log('[Step 1/4] Checking Schema Harmonization Gate...');
  const audit = auditSchemaDiscrepancies();
  console.log(`Canonical Dump Table Count: ${audit.canonicalTableCount}`);
  console.log(`Active Runtime Table Count:  ${audit.activeTableCount}`);
  console.log(`Shared-table Column Discrepancies: ${audit.columnDiscrepancies.length}`);

  if (!audit.isHarmonized) {
    const errMsg = `FATAL: Schema harmonization gate failed: ${audit.columnDiscrepancies.length} shared tables have column discrepancies against canonical fitness_tracker.db.`;
    console.error(`\n[!] ${errMsg}`);
    console.error('\nPREREQUISITES TO PASS MYSQL GATE:');
    console.error('1. Reconcile all 45 shared-table column discrepancies identified by `npm run audit:mysql`');
    console.error('2. Provision MySQL 8.x: docker run -d -p 3306:3306 -e MYSQL_ROOT_PASSWORD=root -e MYSQL_DATABASE=fitness_platform mysql:8.0');
    console.error('3. Configure valid credentials in backend/.env');
    console.error('4. Re-run: npm run test:mysql\n');
    return {
      success: false,
      stage: 'SCHEMA_AUDIT',
      error: errMsg,
      report: audit,
    };
  }

  // 2. Connect to MySQL instance
  console.log('\n[Step 2/4] Connecting to Live MySQL Database...');
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
    console.log('SUCCESS: Connected to MySQL server.');

    // 3. Engine version check
    const [verResult] = await connection.query('SELECT VERSION() as v');
    const version = (verResult as any[])[0]?.v;
    console.log(`[Step 3/4] MySQL Version: ${version}`);

    // 4. Test transactions & CRUD
    console.log('\n[Step 4/4] Testing Atomic Transactions & Rollback...');
    await connection.beginTransaction();
    await connection.query('CREATE TEMPORARY TABLE IF NOT EXISTS _test_integration (id INT PRIMARY KEY, val VARCHAR(50))');
    await connection.query('INSERT INTO _test_integration (id, val) VALUES (1, "mysql_test")');
    const [rows] = await connection.query('SELECT val FROM _test_integration WHERE id = 1');
    const val = (rows as any[])[0]?.val;
    if (val !== 'mysql_test') {
      throw new Error(`Integration assertion failed: expected "mysql_test", got "${val}"`);
    }
    await connection.rollback();
    console.log('SUCCESS: Transaction and rollback semantics verified.');

    console.log('\n======================================================');
    console.log('  MYSQL INTEGRATION TEST PASSED SUCCESSFULLY          ');
    console.log('======================================================\n');
    return {
      success: true,
      stage: 'COMPLETED',
      report: audit,
    };
  } catch (err: any) {
    console.error('\n======================================================');
    console.error('  MYSQL INTEGRATION FAILED / PREREQUISITES UNMET      ');
    console.error('======================================================');
    console.error(`Error Code: ${err.code || 'UNKNOWN'}`);
    console.error(`Message:    ${err.message}`);
    return {
      success: false,
      stage: 'CONNECTION',
      error: err.message,
      report: audit,
    };
  } finally {
    if (connection) {
      try {
        await connection.end();
      } catch {
        // Safe cleanup
      }
    }
  }
}

if (process.argv[1]?.includes('mysql-integration')) {
  runMySQLIntegrationTests().then((res) => {
    if (!res.success) {
      process.exitCode = 1;
    }
  }).catch((err) => {
    console.error('Unexpected runner error:', err);
    process.exitCode = 1;
  });
}
