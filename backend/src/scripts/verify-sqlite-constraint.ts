import { getDatabasePool } from '../database/pool.js';

async function verifySqliteMaster() {
  const db = getDatabasePool();
  
  // 1. Query sqlite_master for workout_sessions indices
  const masterRows = await db.query<any>(`
    SELECT type, name, tbl_name, sql
    FROM sqlite_master
    WHERE tbl_name = 'workout_sessions'
  `);
  console.log('\n--- SQLITE_MASTER RECORDS FOR workout_sessions ---');
  console.log(JSON.stringify(masterRows, null, 2));

  // 2. Query schema_migrations
  const migrationRows = await db.query<any>(`
    SELECT version, applied_at FROM schema_migrations
  `);
  console.log('\n--- SCHEMA_MIGRATIONS ---');
  console.log(JSON.stringify(migrationRows, null, 2));

  // 3. Test uniqueness constraint enforcement
  console.log('\n--- TESTING UNIQUE CONSTRAINT ENFORCEMENT ---');
  const testUserId = 2; // john.doe
  const testDate = '2026-12-31';

  // Clean up any test row
  await db.execute('DELETE FROM workout_sessions WHERE user_id = ? AND session_date = ?', [testUserId, testDate]);

  // Insert first row
  await db.execute(
    `INSERT INTO workout_sessions (user_id, session_date, status) VALUES (?, ?, 'in_progress')`,
    [testUserId, testDate]
  );
  console.log('Successfully inserted initial session.');

  // Attempt duplicate insert - MUST fail with unique constraint violation
  try {
    await db.execute(
      `INSERT INTO workout_sessions (user_id, session_date, status) VALUES (?, ?, 'in_progress')`,
      [testUserId, testDate]
    );
    console.error('FAILED: Duplicate row was inserted without error!');
    process.exit(1);
  } catch (err: any) {
    console.log('SUCCESS: Duplicate insert caught by unique constraint as expected:', err.message);
  }

  // Clean up
  await db.execute('DELETE FROM workout_sessions WHERE user_id = ?', [testUserId]);
  console.log('Verified and cleaned up test data.');
  await db.close();
}

verifySqliteMaster().catch(console.error);
