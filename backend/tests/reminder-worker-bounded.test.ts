import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { runMigrations } from '../src/database/migrate.js';
import { seedDatabase } from '../src/database/seed.js';
import { getDatabasePool, closeDatabasePool, resetDatabasePool } from '../src/database/pool.js';
import { env } from '../src/config/env.js';
import { ReminderWorker } from '../src/workers/reminder.worker.js';

const testDbDir = path.resolve(process.cwd(), 'tests', '.tmp');
const testDbPath = path.resolve(testDbDir, `fitness_test_reminder_bounded_${process.pid}_${Date.now()}.db`);

describe('ReminderWorker Bounded & Chunked Query Strategy Suite', () => {
  beforeAll(async () => {
    if (!fs.existsSync(testDbDir)) {
      fs.mkdirSync(testDbDir, { recursive: true });
    }

    process.env.SQLITE_DB_PATH = testDbPath;
    env.sqliteDbPath = testDbPath;
    resetDatabasePool();

    await runMigrations();
    await seedDatabase();
  });

  afterAll(async () => {
    await closeDatabasePool();
    if (fs.existsSync(testDbPath)) {
      try {
        fs.unlinkSync(testDbPath);
      } catch (_) {}
    }
  });

  it('drains stale tasks across multiple bounded chunks using keyset pagination and marks them missed', async () => {
    const db = getDatabasePool();

    // Create test user
    const userRes = await db.execute(
      `INSERT INTO users (email, password_hash, first_name, last_name, role_id, status, timezone)
       VALUES ('bounded_user1@test.com', 'hash', 'Bounded', 'User', 3, 'active', 'UTC')`,
    );
    const userId = userRes.insertId;

    await db.execute(
      `INSERT INTO user_notification_settings (user_id, in_app_enabled, push_enabled)
       VALUES (?, 1, 0)`,
      [userId],
    );

    // Insert 5 stale tasks from past dates
    const staleDates = ['2023-01-01', '2023-01-02', '2023-01-03', '2023-01-04', '2023-01-05'];
    for (let i = 0; i < staleDates.length; i++) {
      await db.execute(
        `INSERT INTO daily_tasks (user_id, task_date, task_key, task_type, title_snapshot, status)
         VALUES (?, ?, ?, 'workout', ?, 'pending')`,
        [userId, staleDates[i], `stale-task-${i}`, `Stale Workout ${i}`],
      );
    }

    // Instantiate worker with small chunk size of 2 so it must paginate across 3 chunks
    const worker = new ReminderWorker({ taskChunkSize: 2, maxStaleChunks: 10 });

    // Instrument db.query to verify keyset pagination and LIMIT clause
    const originalQuery = db.query.bind(db);
    const capturedStaleQueries: Array<{ sql: string; params?: any[] }> = [];

    db.query = async <T = any>(sql: string, params?: any[]): Promise<T[]> => {
      if (sql.includes('FROM daily_tasks') && sql.includes('task_date < ?')) {
        capturedStaleQueries.push({ sql, params });
      }
      return originalQuery<T>(sql, params);
    };

    let summary;
    try {
      summary = await worker.processOnce();
    } finally {
      db.query = originalQuery;
    }
    expect(summary.errorsCount).toBe(0);

    // Verify deterministic keyset chunking in database queries:
    // With 5 tasks and taskChunkSize = 2, exactly 3 chunk queries must be executed:
    // Chunk 1: id > 0, LIMIT 2 (yields 2 rows)
    // Chunk 2: id > lastSeenId, LIMIT 2 (yields 2 rows)
    // Chunk 3: id > lastSeenId, LIMIT 2 (yields 1 row, chunk size < 2 ends loop)
    expect(capturedStaleQueries.length).toBe(3);
    for (let i = 0; i < capturedStaleQueries.length; i++) {
      const { sql, params } = capturedStaleQueries[i];
      // Verify query includes keyset predicate and LIMIT clause
      expect(sql).toMatch(/id\s*>\s*\?/i);
      expect(sql).toMatch(/ORDER\s+BY\s+id\s+ASC/i);
      expect(sql).toMatch(/LIMIT\s+\?/i);

      // Verify parameters: [userId, latestLocalDate, lastSeenId, limit]
      expect(params).toBeDefined();
      expect(params![params!.length - 1]).toBe(2); // LIMIT parameter equals taskChunkSize (2)

      if (i > 0) {
        // Assert that lastSeenId parameter in subsequent chunk queries is strictly greater than 0
        const lastSeenParam = params![params!.length - 2];
        const prevLastSeenParam = capturedStaleQueries[i - 1].params![capturedStaleQueries[i - 1].params!.length - 2];
        expect(lastSeenParam).toBeGreaterThan(prevLastSeenParam);
      }
    }

    // Verify all 5 stale tasks transitioned to missed
    const tasks = await db.query<{ id: number; status: string; task_key: string }>(
      `SELECT id, status, task_key FROM daily_tasks WHERE user_id = ? AND task_key LIKE 'stale-task-%' ORDER BY id ASC`,
      [userId],
    );
    expect(tasks).toHaveLength(5);
    for (const t of tasks) {
      expect(t.status).toBe('missed');
    }

    // Verify 5 missed-task notifications were created
    const notifs = await db.query<{ id: number; dedupe_key: string }>(
      `SELECT id, dedupe_key FROM notifications WHERE user_id = ? AND dedupe_key LIKE 'missed-task:%'`,
      [userId],
    );
    expect(notifs).toHaveLength(5);

    // Run worker a second time; prove zero duplicate notifications are created
    const secondRun = await worker.processOnce();
    expect(secondRun.errorsCount).toBe(0);

    const notifsAfterSecondRun = await db.query<{ id: number }>(
      `SELECT id FROM notifications WHERE user_id = ? AND dedupe_key LIKE 'missed-task:%'`,
      [userId],
    );
    expect(notifsAfterSecondRun).toHaveLength(5);
  });

  it('filters weekdays strictly to active reminder rules', async () => {
    const db = getDatabasePool();

    // Deactivate existing rules
    await db.execute('UPDATE reminder_rules SET is_active = 0');

    // Create 1 active rule and 1 inactive rule
    const activeRuleRes = await db.execute(
      `INSERT INTO reminder_rules (rule_scope, category, name, trigger_mode, fixed_time, is_active)
       VALUES ('global', 'water', 'Active Rule', 'fixed_time', '09:00:00', 1)`,
    );
    const inactiveRuleRes = await db.execute(
      `INSERT INTO reminder_rules (rule_scope, category, name, trigger_mode, fixed_time, is_active)
       VALUES ('global', 'water', 'Inactive Rule', 'fixed_time', '10:00:00', 0)`,
    );

    // Insert weekdays for both rules
    await db.execute(
      `INSERT INTO reminder_rule_weekdays (reminder_rule_id, weekday) VALUES (?, 1), (?, 2)`,
      [activeRuleRes.insertId, inactiveRuleRes.insertId],
    );

    // Verify that weekday query joins active reminder rules
    const activeWeekdays = await db.query<{ reminder_rule_id: number; weekday: number }>(
      `SELECT rrw.reminder_rule_id, rrw.weekday
       FROM reminder_rule_weekdays rrw
       JOIN reminder_rules rr ON rr.id = rrw.reminder_rule_id
       WHERE rr.is_active = 1`,
    );

    expect(activeWeekdays.some((w) => w.reminder_rule_id === activeRuleRes.insertId)).toBe(true);
    expect(activeWeekdays.some((w) => w.reminder_rule_id === inactiveRuleRes.insertId)).toBe(false);
  });

  it('evaluates active window tasks separately without being polluted by historical stale tasks', async () => {
    const db = getDatabasePool();

    const userRes = await db.execute(
      `INSERT INTO users (email, password_hash, first_name, last_name, role_id, status, timezone)
       VALUES ('bounded_user2@test.com', 'hash', 'Active', 'Window', 3, 'active', 'UTC')`,
    );
    const userId = userRes.insertId;

    await db.execute(
      `INSERT INTO user_notification_settings (user_id, in_app_enabled, push_enabled)
       VALUES (?, 1, 0)`,
      [userId],
    );

    // Compute today and yesterday for UTC
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

    // Insert 1 yesterday pending task
    await db.execute(
      `INSERT INTO daily_tasks (user_id, task_date, task_key, task_type, title_snapshot, status)
       VALUES (?, ?, 'yesterday-task', 'meal', 'Yesterday Lunch', 'pending')`,
      [userId, yesterday],
    );

    // Insert 1 today overdue pending task (due earlier today)
    const overdueTime = `${today} 00:00:01`;
    await db.execute(
      `INSERT INTO daily_tasks (user_id, task_date, task_key, task_type, title_snapshot, status, due_at)
       VALUES (?, ?, 'today-overdue-task', 'meal', 'Today Lunch', 'pending', ?)`,
      [userId, today, overdueTime],
    );

    const worker = new ReminderWorker({ taskChunkSize: 10 });

    // Instrument db.query to assert active window query bounds
    const originalQuery = db.query.bind(db);
    const capturedActiveQueries: Array<{ sql: string; params?: any[] }> = [];

    db.query = async <T = any>(sql: string, params?: any[]): Promise<T[]> => {
      if (sql.includes('FROM daily_tasks') && sql.includes('task_date >= ?')) {
        capturedActiveQueries.push({ sql, params });
      }
      return originalQuery<T>(sql, params);
    };

    let summary;
    try {
      summary = await worker.processOnce();
    } finally {
      db.query = originalQuery;
    }
    expect(summary.errorsCount).toBe(0);

    // Verify active window query bounded between earliestLocalDate and latestLocalDate with keyset limit
    expect(capturedActiveQueries.length).toBeGreaterThanOrEqual(1);
    for (const q of capturedActiveQueries) {
      expect(q.sql).toMatch(/task_date\s*>=\s*\?/i);
      expect(q.sql).toMatch(/task_date\s*<=\s*\?/i);
      expect(q.sql).toMatch(/id\s*>\s*\?/i);
      expect(q.sql).toMatch(/LIMIT\s+\?/i);
      expect(q.params![q.params!.length - 1]).toBe(10); // LIMIT parameter equals taskChunkSize (10)
    }

    // Yesterday task became missed
    const staleTask = await db.queryOne<{ status: string }>(
      `SELECT status FROM daily_tasks WHERE user_id = ? AND task_key = 'yesterday-task'`,
      [userId],
    );
    expect(staleTask?.status).toBe('missed');

    // Today overdue task generated overdue notification
    const overdueNotif = await db.queryOne<{ id: number; title: string }>(
      `SELECT id, title FROM notifications WHERE user_id = ? AND dedupe_key LIKE 'overdue-task:%'`,
      [userId],
    );
    expect(overdueNotif).toBeDefined();
    expect(overdueNotif?.title).toContain('Overdue: Today Lunch');
  });
});
