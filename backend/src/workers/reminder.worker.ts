import { getDatabasePool } from '../database/pool.js';
import { DatabasePool } from '../database/types.js';
import { logger } from '../config/logger.js';
import { env } from '../config/env.js';
import { getUserLocalDateTime } from '../shared/utils/date-utils.js';
import { evaluateReminderRule, ReminderRule, ReminderTask } from '../modules/notifications/reminder-engine.js';
import { pushNotificationService } from '../shared/services/push-notification.service.js';

interface ProcessSummary {
  rulesEvaluated: number;
  notificationsDispatched: number;
  errorsCount: number;
  durationMs: number;
}

interface ActiveUser {
  id: number;
  timezone: string | null;
  first_name: string | null;
  in_app_enabled?: number | null;
  push_enabled?: number | null;
  local_notifications_enabled?: number | null;
  quiet_hours_enabled?: number | null;
  quiet_hours_start?: string | null;
  quiet_hours_end?: string | null;
}

interface PendingTask extends ReminderTask {
  user_id: number;
  task_date: string;
  title_snapshot: string;
  status: string;
  due_at?: string | null;
}

interface NotificationSettings {
  in_app_enabled?: number | null;
  push_enabled?: number | null;
  local_notifications_enabled?: number | null;
  quiet_hours_enabled?: number | null;
  quiet_hours_start?: string | null;
  quiet_hours_end?: string | null;
}

function isUniqueConstraintError(error: unknown): boolean {
  const value = error as { code?: string; message?: string };
  return value?.code === 'SQLITE_CONSTRAINT' || value?.code === 'ER_DUP_ENTRY' || /unique|duplicate/i.test(value?.message || '');
}

function categoryTaskType(category: string | null | undefined): string | null {
  if (!category || category === 'system' || category === 'general') return null;
  return category === 'diet' ? 'meal' : category;
}

function clockMinutes(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = /^(\d{1,2}):(\d{2})/.exec(value);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function isQuietHours(settings: NotificationSettings | null, localTime: string): boolean {
  if (!settings?.quiet_hours_enabled) return false;
  const start = clockMinutes(settings.quiet_hours_start);
  const end = clockMinutes(settings.quiet_hours_end);
  if (start === null || end === null) return false;
  const now = clockMinutes(localTime) ?? 0;
  if (start === end) return true;
  return start < end ? now >= start && now < end : now >= start || now < end;
}

export interface ReminderWorkerOptions {
  taskChunkSize?: number;
  userBatchSize?: number;
  maxStaleChunks?: number;
}

export class ReminderWorker {
  private running = false;
  private timer: NodeJS.Timeout | null = null;
  private isProcessing = false;
  private instanceId = `worker_${process.pid}_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
  private readonly taskChunkSize: number;
  private readonly userBatchSize: number;
  private readonly maxStaleChunks: number;

  constructor(options: ReminderWorkerOptions = {}) {
    this.taskChunkSize = options.taskChunkSize && options.taskChunkSize > 0 ? options.taskChunkSize : 500;
    this.userBatchSize = options.userBatchSize && options.userBatchSize > 0 ? options.userBatchSize : 250;
    this.maxStaleChunks = options.maxStaleChunks && options.maxStaleChunks > 0 ? options.maxStaleChunks : 20;
  }

  private async acquireLock(db: DatabasePool): Promise<boolean> {
    try {
      const now = new Date();
      const leaseUntil = new Date(Date.now() + 5 * 60 * 1000); // 5 minute lease duration
      const leaseUntilStr = leaseUntil.toISOString().slice(0, 19).replace('T', ' ');
      const nowStr = now.toISOString().slice(0, 19).replace('T', ' ');

      const existing = await db.queryOne<{ worker_name: string; locked_until: string; locked_by: string }>(
        "SELECT * FROM worker_locks WHERE worker_name = 'reminder_worker'"
      );

      if (!existing) {
        try {
          await db.execute(
            "INSERT INTO worker_locks (worker_name, locked_until, locked_by, updated_at) VALUES ('reminder_worker', ?, ?, CURRENT_TIMESTAMP)",
            [leaseUntilStr, this.instanceId]
          );
          return true;
        } catch {
          // Row was inserted concurrently by another instance
        }
      }

      // If existing lock has expired or is owned by this instance, renew lease
      const isExpired = existing && new Date(existing.locked_until) < now;
      const isOwned = existing && existing.locked_by === this.instanceId;

      if (!existing || isExpired || isOwned) {
        const updateRes = await db.execute(
          `UPDATE worker_locks 
           SET locked_until = ?, locked_by = ?, updated_at = CURRENT_TIMESTAMP 
           WHERE worker_name = 'reminder_worker' AND (locked_until <= ? OR locked_by = ?)`,
          [leaseUntilStr, this.instanceId, nowStr, this.instanceId]
        );
        return updateRes.affectedRows > 0;
      }

      return false;
    } catch (err) {
      logger.error({ err }, 'Failed acquiring distributed worker lock');
      return false;
    }
  }

  private async releaseLock(db: DatabasePool): Promise<void> {
    try {
      await db.execute(
        "UPDATE worker_locks SET locked_until = '1970-01-01 00:00:00', updated_at = CURRENT_TIMESTAMP WHERE worker_name = 'reminder_worker' AND locked_by = ?",
        [this.instanceId]
      );
    } catch (err) {
      logger.warn({ err }, 'Failed to release distributed worker lock');
    }
  }

  async processOnce(): Promise<ProcessSummary> {
    const startTime = Date.now();
    const db = getDatabasePool();
    let rulesEvaluated = 0;
    let notificationsDispatched = 0;
    let errorsCount = 0;

    // Acquire distributed database lock
    const lockAcquired = await this.acquireLock(db);
    if (!lockAcquired) {
      logger.info({ instanceId: this.instanceId }, 'Reminder worker lease held by another active instance; skipping tick');
      return {
        rulesEvaluated: 0,
        notificationsDispatched: 0,
        errorsCount: 0,
        durationMs: Date.now() - startTime,
      };
    }

    try {
      // 1. Fetch active reminder rules. Short-circuit immediately if none are active.
      // ARCHITECTURAL BOUNDING: reminder_rules represents platform-level and coach-configured
      // automation templates (not high-frequency telemetry, logs, or per-event logs). Even in
      // enterprise deployments, active reminder rule sets are cardinality-bounded (typically < 100
      // total rules platform-wide). Each rule is evaluated per active user during the worker cycle.
      // We explicitly order by id ASC for deterministic evaluation and avoid arbitrary LIMITs
      // that could silently drop configured reminders.
      const activeRules = await db.query<ReminderRule & { name?: string }>(
        'SELECT * FROM reminder_rules WHERE is_active = 1 ORDER BY id ASC',
      );

      rulesEvaluated = activeRules.length;
      if (activeRules.length === 0) {
        return {
          rulesEvaluated: 0,
          notificationsDispatched: 0,
          errorsCount: 0,
          durationMs: Date.now() - startTime,
        };
      }

      // Bound weekday restrictions to active rules only via set-based JOIN
      const weekdayRows = await db.query<{ reminder_rule_id: number; weekday: number }>(
        `SELECT rrw.reminder_rule_id, rrw.weekday
         FROM reminder_rule_weekdays rrw
         JOIN reminder_rules rr ON rr.id = rrw.reminder_rule_id
         WHERE rr.is_active = 1`,
      );
      const weekdaysByRule = new Map<number, number[]>();
      for (const row of weekdayRows) {
        const days = weekdaysByRule.get(row.reminder_rule_id) || [];
        days.push(Number(row.weekday));
        weekdaysByRule.set(row.reminder_rule_id, days);
      }

      // 2. Fetch active platform users (role_id = 3 for standard users) and
      // their notification settings in one query. Missing settings retain the
      // domain defaults used by the notification policy.
      const activeUsers = await db.query<ActiveUser>(
        `SELECT u.id, u.timezone, u.first_name,
                COALESCE(s.in_app_enabled, 1) as in_app_enabled,
                COALESCE(s.push_enabled, 1) as push_enabled,
                COALESCE(s.local_notifications_enabled, 1) as local_notifications_enabled,
                COALESCE(s.quiet_hours_enabled, 0) as quiet_hours_enabled,
                s.quiet_hours_start, s.quiet_hours_end
         FROM users u
         LEFT JOIN user_notification_settings s ON s.user_id = u.id
         WHERE u.status = 'active' AND u.role_id = 3
         ORDER BY u.id ASC`,
      );

      if (activeUsers.length === 0) {
        return {
          rulesEvaluated,
          notificationsDispatched: 0,
          errorsCount: 0,
          durationMs: Date.now() - startTime,
        };
      }

      const usersWithLocalTime = activeUsers.map((user) => ({
        user,
        local: getUserLocalDateTime(user.timezone || 'UTC'),
      }));
      const userMetaById = new Map<number, { user: ActiveUser; local: { date: string; time: string; weekday: number } }>();
      for (const item of usersWithLocalTime) {
        userMetaById.set(Number(item.user.id), item);
      }

      // 3. Process active users in bounded batches (to comply with SQL IN limits and keep queries snappy)
      for (let userOffset = 0; userOffset < activeUsers.length; userOffset += this.userBatchSize) {
        const userBatch = activeUsers.slice(userOffset, userOffset + this.userBatchSize);
        const batchUserIds = userBatch.map((u) => Number(u.id));
        const userPlaceholders = batchUserIds.map(() => '?').join(',');

        const batchUserMeta = batchUserIds.map((id) => userMetaById.get(id)!);
        const earliestLocalDate = batchUserMeta.reduce(
          (earliest, item) => item.local.date < earliest ? item.local.date : earliest,
          batchUserMeta[0].local.date,
        );
        const latestLocalDate = batchUserMeta.reduce(
          (latest, item) => item.local.date > latest ? item.local.date : latest,
          batchUserMeta[0].local.date,
        );

        // A. DRAIN STALE TASKS BACKLOG USING BOUNDED KEYSET CHUNKS
        // Tasks with task_date < latestLocalDate that have accumulated over time without logging.
        // Process in bounded chunks of taskChunkSize with keyset seek (id > lastSeenId) so that
        // large historical backlogs never exhaust memory or cause query timeouts.
        let lastSeenStaleId = 0;
        let staleChunkIndex = 0;
        let hasMoreStale = true;

        while (hasMoreStale && staleChunkIndex < this.maxStaleChunks) {
          staleChunkIndex++;
          const staleChunk = await db.query<PendingTask>(
            `SELECT id, user_id, task_type, scheduled_at, due_at, diet_meal_id,
                    workout_plan_day_id, task_date, title_snapshot, status
             FROM daily_tasks
             WHERE user_id IN (${userPlaceholders})
               AND task_date < ?
               AND status IN ('pending', 'in_progress')
               AND id > ?
             ORDER BY id ASC
             LIMIT ?`,
            [...batchUserIds, latestLocalDate, lastSeenStaleId, this.taskChunkSize],
          );

          if (staleChunk.length === 0) {
            hasMoreStale = false;
            break;
          }

          for (const task of staleChunk) {
            lastSeenStaleId = task.id;
            const meta = userMetaById.get(Number(task.user_id));
            if (!meta) continue;

            // Only transition if task_date is strictly before user's local date
            if (task.task_date >= meta.local.date) continue;

            const user = meta.user;
            const settings: NotificationSettings = user;
            const inAppEnabled = settings ? settings.in_app_enabled !== 0 : true;
            const pushEnabled = settings ? settings.push_enabled !== 0 : true;

            await db.withTransaction(async (conn) => {
              const update = await conn.execute(
                `UPDATE daily_tasks SET status = 'missed', updated_at = CURRENT_TIMESTAMP
                 WHERE id = ? AND status IN ('pending', 'in_progress')`,
                [task.id],
              );
              if (!update.affectedRows) return;
              if (!inAppEnabled && !pushEnabled) return;

              const dedupeKey = `missed-task:${task.id}`;
              const existing = await conn.queryOne('SELECT id FROM notifications WHERE user_id = ? AND dedupe_key = ?', [user.id, dedupeKey]);
              if (existing) return;

              const notif = await conn.execute(
                `INSERT INTO notifications
                 (user_id, daily_task_id, category, notification_type, title, message, dedupe_key, status, created_at)
                 VALUES (?, ?, ?, 'alert', ?, ?, ?, 'unread', CURRENT_TIMESTAMP)`,
                [user.id, task.id, task.task_type, `Missed task: ${task.title_snapshot}`, `You missed ${task.title_snapshot}.`, dedupeKey],
              );

              if (inAppEnabled) {
                await conn.execute(
                  `INSERT INTO notification_deliveries (notification_id, channel, status, delivered_at, created_at)
                   VALUES (?, 'in_app', 'sent', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                  [notif.insertId],
                );
              }

              if (pushEnabled) {
                await pushNotificationService.dispatchPushToUserDevices(conn, {
                  notificationId: notif.insertId,
                  userId: user.id,
                  pushEnabled,
                  title: `Missed task: ${task.title_snapshot}`,
                  message: `You missed ${task.title_snapshot}.`,
                  category: task.task_type,
                });
              }
            });
          }

          if (staleChunk.length < this.taskChunkSize) {
            hasMoreStale = false;
          }
        }

        // B. LOAD ACTIVE-WINDOW TASKS (BOUNDED TO CALENDAR WINDOW OF USER TIMEZONES)
        // For same-day overdue task detection and reminder rule matching, only tasks in the active
        // window (earliestLocalDate to latestLocalDate, spanning at most 1-2 days) are relevant.
        let lastSeenActiveId = 0;
        let hasMoreActive = true;
        const activeWindowTasksByUser = new Map<number, PendingTask[]>();

        while (hasMoreActive) {
          const activeChunk = await db.query<PendingTask>(
            `SELECT id, user_id, task_type, scheduled_at, due_at, diet_meal_id,
                    workout_plan_day_id, task_date, title_snapshot, status
             FROM daily_tasks
             WHERE user_id IN (${userPlaceholders})
               AND task_date >= ?
               AND task_date <= ?
               AND status IN ('pending', 'in_progress')
               AND id > ?
             ORDER BY id ASC
             LIMIT ?`,
            [...batchUserIds, earliestLocalDate, latestLocalDate, lastSeenActiveId, this.taskChunkSize],
          );

          if (activeChunk.length === 0) {
            hasMoreActive = false;
            break;
          }

          for (const task of activeChunk) {
            lastSeenActiveId = task.id;
            const userTasks = activeWindowTasksByUser.get(Number(task.user_id)) || [];
            userTasks.push(task);
            activeWindowTasksByUser.set(Number(task.user_id), userTasks);
          }

          if (activeChunk.length < this.taskChunkSize) {
            hasMoreActive = false;
          }
        }

        // C. EVALUATE SAME-DAY OVERDUE AND REMINDER RULES
        for (const user of userBatch) {
          const meta = userMetaById.get(Number(user.id))!;
          const local = meta.local;
          const settings: NotificationSettings = user;
          const userTasks = activeWindowTasksByUser.get(Number(user.id)) || [];
          const inAppEnabled = settings ? settings.in_app_enabled !== 0 : true;
          const pushEnabled = settings ? settings.push_enabled !== 0 : true;

          // If user has local timezone tasks that are strictly earlier than local.date
          // (possible if earliestLocalDate was before local.date due to multi-timezone batch),
          // transition them to missed as well.
          const residualStaleTasks = userTasks.filter((task) => task.task_date < local.date);
          for (const task of residualStaleTasks) {
            await db.withTransaction(async (conn) => {
              const update = await conn.execute(
                `UPDATE daily_tasks SET status = 'missed', updated_at = CURRENT_TIMESTAMP
                 WHERE id = ? AND status IN ('pending', 'in_progress')`,
                [task.id],
              );
              if (!update.affectedRows) return;
              if (!inAppEnabled && !pushEnabled) return;

              const dedupeKey = `missed-task:${task.id}`;
              const existing = await conn.queryOne('SELECT id FROM notifications WHERE user_id = ? AND dedupe_key = ?', [user.id, dedupeKey]);
              if (existing) return;

              const notif = await conn.execute(
                `INSERT INTO notifications
                 (user_id, daily_task_id, category, notification_type, title, message, dedupe_key, status, created_at)
                 VALUES (?, ?, ?, 'alert', ?, ?, ?, 'unread', CURRENT_TIMESTAMP)`,
                [user.id, task.id, task.task_type, `Missed task: ${task.title_snapshot}`, `You missed ${task.title_snapshot}.`, dedupeKey],
              );

              if (inAppEnabled) {
                await conn.execute(
                  `INSERT INTO notification_deliveries (notification_id, channel, status, delivered_at, created_at)
                   VALUES (?, 'in_app', 'sent', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                  [notif.insertId],
                );
              }

              if (pushEnabled) {
                await pushNotificationService.dispatchPushToUserDevices(conn, {
                  notificationId: notif.insertId,
                  userId: user.id,
                  pushEnabled,
                  title: `Missed task: ${task.title_snapshot}`,
                  message: `You missed ${task.title_snapshot}.`,
                  category: task.task_type,
                });
              }
            });
          }

          // Same-day overdue task detection
        const currentLocalDateTime = `${local.date} ${local.time}`;
        const overdueTasks = userTasks.filter((task) =>
          task.task_date === local.date && task.due_at != null && task.due_at < currentLocalDateTime,
        );
        for (const task of overdueTasks) {
          if (!inAppEnabled && !pushEnabled) continue;
          const dedupeKey = `overdue-task:${task.id}:${local.date}`;
          const existing = await db.queryOne('SELECT id FROM notifications WHERE user_id = ? AND dedupe_key = ?', [user.id, dedupeKey]);
          if (existing) continue;

          await db.withTransaction(async (conn) => {
            const notif = await conn.execute(
              `INSERT INTO notifications
               (user_id, daily_task_id, category, notification_type, title, message, dedupe_key, status, created_at)
               VALUES (?, ?, ?, 'alert', ?, ?, ?, 'unread', CURRENT_TIMESTAMP)`,
              [user.id, task.id, task.task_type, `Overdue: ${task.title_snapshot}`, `${task.title_snapshot} is overdue. Don't forget to log your progress!`, dedupeKey],
            );

            if (inAppEnabled) {
              await conn.execute(
                `INSERT INTO notification_deliveries (notification_id, channel, status, delivered_at, created_at)
                 VALUES (?, 'in_app', 'sent', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                [notif.insertId],
              );
            }

            if (pushEnabled) {
              await pushNotificationService.dispatchPushToUserDevices(conn, {
                notificationId: notif.insertId,
                userId: user.id,
                pushEnabled,
                title: `Overdue: ${task.title_snapshot}`,
                message: `${task.title_snapshot} is overdue. Don't forget to log your progress!`,
                category: task.task_type,
              });
            }

            notificationsDispatched++;
          });
        }

        if (isQuietHours(settings, local.time)) continue;

        for (const rule of activeRules) {
          try {
            if (!inAppEnabled && !pushEnabled) continue;
            if (rule.rule_scope === 'user' && rule.user_id && rule.user_id !== user.id) continue;
            const taskType = categoryTaskType(rule.category);
            const tasks = taskType
              ? userTasks.filter((task) => task.task_date === local.date && task.task_type === taskType)
              : [];
            const matchingTask = tasks.find((task) =>
              (!rule.diet_meal_id || task.diet_meal_id === rule.diet_meal_id) &&
              (!rule.workout_plan_day_id || task.workout_plan_day_id === rule.workout_plan_day_id),
            ) || null;
            if (taskType && !matchingTask) continue;
            if (matchingTask?.status === 'completed' || matchingTask?.status === 'skipped' || matchingTask?.status === 'missed') continue;

            const occurrence = evaluateReminderRule(rule, {
              localDate: local.date,
              localTime: local.time,
              weekday: local.weekday,
              task: matchingTask,
              weekdays: weekdaysByRule.get(rule.id),
            });
            if (!occurrence) continue;

            const alreadySent = await db.queryOne<{ id: number }>(
              'SELECT id FROM notifications WHERE user_id = ? AND dedupe_key = ?',
              [user.id, occurrence.dedupeKey],
            );
            if (alreadySent) continue;

            const ruleTitle = rule.name || 'Reminder';
            const bodyText = `Reminder: ${ruleTitle}`.replace('{first_name}', user.first_name || 'Athlete');
            await db.withTransaction(async (conn) => {
              const notifRes = await conn.execute(
                `INSERT INTO notifications
                 (user_id, daily_task_id, reminder_rule_id, category, notification_type,
                  title, message, dedupe_key, scheduled_at, status, created_at)
                 VALUES (?, ?, ?, ?, 'reminder', ?, ?, ?, ?, 'unread', CURRENT_TIMESTAMP)`,
                [user.id, matchingTask?.id || null, rule.id, rule.category || 'system', ruleTitle, bodyText, occurrence.dedupeKey, occurrence.scheduledAt],
              );

              if (inAppEnabled) {
                await conn.execute(
                  `INSERT INTO notification_deliveries (notification_id, channel, status, delivered_at, created_at)
                   VALUES (?, 'in_app', 'sent', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                  [notifRes.insertId],
                );
              }

              if (pushEnabled) {
                await pushNotificationService.dispatchPushToUserDevices(conn, {
                  notificationId: notifRes.insertId,
                  userId: user.id,
                  pushEnabled,
                  title: ruleTitle,
                  message: bodyText,
                  category: rule.category || 'system',
                });
              }
            });
            notificationsDispatched++;
          } catch (ruleError) {
            if (isUniqueConstraintError(ruleError)) continue;
            errorsCount++;
            logger.error({ ruleError, userId: user.id, ruleId: rule.id }, 'Error evaluating reminder rule for user');
          }
        }
      }
    }
  } catch (error) {
      errorsCount++;
      logger.error({ error }, 'Fatal error during reminder worker iteration');
    } finally {
      await this.releaseLock(db);
    }

    const durationMs = Date.now() - startTime;
    return {
      rulesEvaluated,
      notificationsDispatched,
      errorsCount,
      durationMs,
    };
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    logger.info({ intervalSeconds: env.reminderWorkerIntervalSeconds, instanceId: this.instanceId }, 'Starting background reminder worker daemon');

    const tick = async () => {
      if (!this.running) return;
      if (this.isProcessing) {
        logger.warn('Previous reminder worker run still in progress, skipping tick');
        return;
      }

      this.isProcessing = true;
      try {
        const summary = await this.processOnce();
        logger.info(
          {
            rulesEvaluated: summary.rulesEvaluated,
            dispatched: summary.notificationsDispatched,
            errors: summary.errorsCount,
            durationMs: summary.durationMs,
          },
          'Reminder worker cycle finished'
        );
      } catch (err) {
        logger.error({ err }, 'Unhandled error in reminder worker cycle');
      } finally {
        this.isProcessing = false;
        if (this.running) {
          this.timer = setTimeout(tick, env.reminderWorkerIntervalSeconds * 1000);
        }
      }
    };

    // Run first tick immediately
    await tick();
  }

  async stop(): Promise<void> {
    logger.info({ instanceId: this.instanceId }, 'Stopping background reminder worker daemon');
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}

// Entrypoint when invoked directly via CLI
if (process.argv[1]?.includes('reminder.worker')) {
  const worker = new ReminderWorker();

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Received termination signal, shutting down reminder worker...');
    await worker.stop();
    const db = getDatabasePool();
    await db.close();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  worker.start().catch((err) => {
    logger.fatal({ err }, 'Failed to start reminder worker');
    process.exit(1);
  });
}
