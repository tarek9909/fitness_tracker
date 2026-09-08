import { getDatabasePool } from '../../database/pool.js';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../../middleware/authenticate.js';
import { requireAdmin } from '../../middleware/authorize.js';
import { AuthenticatedRequest } from '../../shared/types/index.js';
import { parsePositiveInt, parseBoundedPositiveInt } from '../../shared/utils/request-utils.js';
import { recordAuditEvent } from '../../shared/utils/audit-utils.js';
import { NotFoundError } from '../../shared/errors/app-error.js';
import { ReminderWorker } from '../../workers/reminder.worker.js';
import { pushNotificationService } from '../../shared/services/push-notification.service.js';

const registerDeviceSchema = z.object({
  deviceUuid: z.string().min(1).max(191),
  platform: z.enum(['ios', 'android']),
  pushToken: z.string().min(1).max(1000),
  appVersion: z.string().max(50).optional(),
});

const clockValue = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/, 'Time must use HH:MM or HH:MM:SS');

const reminderFields = {
  title: z.string().min(1).max(150),
  category: z.enum(['meal', 'workout', 'cardio', 'water', 'weight', 'progress', 'system']),
  mode: z.enum(['fixed_time', 'relative_to_task', 'interval']).default('fixed_time'),
  fixedTime: clockValue.optional().nullable(),
  offsetMinutes: z.number().int().min(-1440).max(1440).optional().nullable(),
  gracePeriodMinutes: z.number().int().min(0).default(0),
  repeatIntervalMinutes: z.number().int().positive().optional().nullable(),
  maxRepeats: z.number().int().min(1).default(1),
  activeWindowStart: clockValue.optional().nullable(),
  activeWindowEnd: clockValue.optional().nullable(),
  messageTemplate: z.string().min(1).max(5000).optional().nullable(),
  isActive: z.boolean().default(true),
};

const reminderSchema = z.object(reminderFields).superRefine((value, context) => {
  if (value.mode === 'fixed_time' && !value.fixedTime) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['fixedTime'], message: 'Fixed-time reminders require fixedTime' });
  }
  if (value.mode === 'interval' && !value.repeatIntervalMinutes) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['repeatIntervalMinutes'], message: 'Interval reminders require repeatIntervalMinutes' });
  }
  if (value.mode === 'relative_to_task' && ['system', 'progress'].includes(value.category)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['category'], message: 'Relative reminders must target a task category' });
  }
});

const updateReminderSchema = z.object(reminderFields).partial();

const adminSendNotificationSchema = z.object({
  userId: z.number().int().positive().optional().nullable(), // null for broadcast to all active users
  category: z.enum(['meal', 'workout', 'cardio', 'water', 'weight', 'progress', 'system']).default('system'),
  notificationType: z.enum(['reminder', 'system', 'adherence', 'alert']).default('system'),
  title: z.string().min(1).max(191),
  message: z.string().min(1).max(5000),
  deepLink: z.string().max(500).optional().nullable(),
});

export class NotificationsController {
  private db = getDatabasePool();

  private async isUserInAppEnabled(userId: number): Promise<boolean> {
    const settings = await this.db.queryOne<{ in_app_enabled: number }>(
      'SELECT in_app_enabled FROM user_notification_settings WHERE user_id = ?',
      [userId]
    );
    return settings ? settings.in_app_enabled !== 0 : true;
  }

  async getMyNotifications(request: FastifyRequest, reply: FastifyReply) {
    const auth = (request as AuthenticatedRequest).user;
    const inAppEnabled = await this.isUserInAppEnabled(auth.userId);
    if (!inAppEnabled) {
      return reply.status(200).send({
        success: true,
        data: [],
      });
    }

    let notifications: any[];
    try {
      notifications = await this.db.query(
        `SELECT n.*, 
                n.message as body, 
                (CASE WHEN n.status = 'read' THEN 1 ELSE 0 END) as is_read 
         FROM notifications n 
         WHERE n.user_id = ? 
           AND n.status != 'dismissed'
           AND (
             EXISTS (SELECT 1 FROM notification_deliveries nd WHERE nd.notification_id = n.id AND nd.channel = 'in_app')
             OR NOT EXISTS (SELECT 1 FROM notification_deliveries nd WHERE nd.notification_id = n.id)
           )
         ORDER BY n.created_at DESC 
         LIMIT 50`,
        [auth.userId]
      );
    } catch {
      try {
        const rows = await this.db.query(
          `SELECT n.*, 
                  n.message as body, 
                  (CASE WHEN (n.is_read = 1 OR n.read_at IS NOT NULL) THEN 1 ELSE 0 END) as is_read,
                  (CASE 
                    WHEN n.dismissed_at IS NOT NULL THEN 'dismissed'
                    WHEN (n.is_read = 1 OR n.read_at IS NOT NULL) THEN 'read'
                    ELSE 'unread'
                  END) as status
           FROM notifications n 
           WHERE n.user_id = ? 
             AND n.dismissed_at IS NULL
             AND (
               EXISTS (SELECT 1 FROM notification_deliveries nd WHERE nd.notification_id = n.id AND nd.channel = 'in_app')
               OR NOT EXISTS (SELECT 1 FROM notification_deliveries nd WHERE nd.notification_id = n.id)
             )
           ORDER BY n.created_at DESC 
           LIMIT 50`,
          [auth.userId]
        );
        notifications = rows;
      } catch {
        const rows = await this.db.query(
          `SELECT n.*, n.message as body FROM notifications n WHERE n.user_id = ? ORDER BY n.created_at DESC LIMIT 50`,
          [auth.userId]
        );
        notifications = rows.map((r: any) => ({
          ...r,
          is_read: r.is_read ? 1 : 0,
          status: r.status || (r.is_read ? 'read' : 'unread'),
        }));
      }
    }
    return reply.status(200).send({
      success: true,
      data: notifications,
    });
  }

  async markAsRead(request: FastifyRequest, reply: FastifyReply) {
    const auth = (request as AuthenticatedRequest).user;
    const params = request.params as { id: string };
    const notificationId = parsePositiveInt(params.id, 'notificationId');

    const inAppEnabled = await this.isUserInAppEnabled(auth.userId);
    if (!inAppEnabled) {
      return reply.status(404).send({
        success: false,
        error: { code: 'RESOURCE_NOT_FOUND', message: 'Notification not found' },
      });
    }

    let result: any;
    try {
      result = await this.db.execute(
        `UPDATE notifications 
         SET status = 'read', read_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
         WHERE id = ? 
           AND user_id = ?
           AND (
             EXISTS (SELECT 1 FROM notification_deliveries nd WHERE nd.notification_id = ? AND nd.channel = 'in_app')
             OR NOT EXISTS (SELECT 1 FROM notification_deliveries nd WHERE nd.notification_id = ?)
           )`,
        [notificationId, auth.userId, notificationId, notificationId]
      );
    } catch {
      result = await this.db.execute(
        `UPDATE notifications 
         SET is_read = 1, read_at = CURRENT_TIMESTAMP 
         WHERE id = ? 
           AND user_id = ?
           AND (
             EXISTS (SELECT 1 FROM notification_deliveries nd WHERE nd.notification_id = ? AND nd.channel = 'in_app')
             OR NOT EXISTS (SELECT 1 FROM notification_deliveries nd WHERE nd.notification_id = ?)
           )`,
        [notificationId, auth.userId, notificationId, notificationId]
      );
    }
    if (result.affectedRows === 0) {
      return reply.status(404).send({
        success: false,
        error: { code: 'RESOURCE_NOT_FOUND', message: 'Notification not found' },
      });
    }
    return reply.status(200).send({
      success: true,
      data: { message: 'Marked as read' },
    });
  }

  async markAllAsRead(request: FastifyRequest, reply: FastifyReply) {
    const auth = (request as AuthenticatedRequest).user;

    const inAppEnabled = await this.isUserInAppEnabled(auth.userId);
    if (!inAppEnabled) {
      return reply.status(200).send({
        success: true,
        data: { message: 'All notifications marked as read' },
      });
    }

    try {
      await this.db.execute(
        `UPDATE notifications 
         SET status = 'read', read_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
         WHERE user_id = ? 
           AND status = 'unread'
           AND (
             EXISTS (SELECT 1 FROM notification_deliveries nd WHERE nd.notification_id = notifications.id AND nd.channel = 'in_app')
             OR NOT EXISTS (SELECT 1 FROM notification_deliveries nd WHERE nd.notification_id = notifications.id)
           )`,
        [auth.userId]
      );
    } catch {
      await this.db.execute(
        `UPDATE notifications 
         SET is_read = 1, read_at = CURRENT_TIMESTAMP 
         WHERE user_id = ? 
           AND (is_read = 0 OR is_read IS NULL)
           AND (
             EXISTS (SELECT 1 FROM notification_deliveries nd WHERE nd.notification_id = notifications.id AND nd.channel = 'in_app')
             OR NOT EXISTS (SELECT 1 FROM notification_deliveries nd WHERE nd.notification_id = notifications.id)
           )`,
        [auth.userId]
      );
    }
    return reply.status(200).send({
      success: true,
      data: { message: 'All notifications marked as read' },
    });
  }

  async dismissNotification(request: FastifyRequest, reply: FastifyReply) {
    const auth = (request as AuthenticatedRequest).user;
    const params = request.params as { id: string };
    const notificationId = parsePositiveInt(params.id, 'notificationId');

    const inAppEnabled = await this.isUserInAppEnabled(auth.userId);
    if (!inAppEnabled) {
      return reply.status(404).send({
        success: false,
        error: { code: 'RESOURCE_NOT_FOUND', message: 'Notification not found' },
      });
    }

    let result: any;
    try {
      result = await this.db.execute(
        `UPDATE notifications 
         SET status = 'dismissed', dismissed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
         WHERE id = ? 
           AND user_id = ?
           AND (
             EXISTS (SELECT 1 FROM notification_deliveries nd WHERE nd.notification_id = ? AND nd.channel = 'in_app')
             OR NOT EXISTS (SELECT 1 FROM notification_deliveries nd WHERE nd.notification_id = ?)
           )`,
        [notificationId, auth.userId, notificationId, notificationId]
      );
    } catch {
      result = await this.db.execute(
        `UPDATE notifications 
         SET dismissed_at = CURRENT_TIMESTAMP 
         WHERE id = ? 
           AND user_id = ?
           AND (
             EXISTS (SELECT 1 FROM notification_deliveries nd WHERE nd.notification_id = ? AND nd.channel = 'in_app')
             OR NOT EXISTS (SELECT 1 FROM notification_deliveries nd WHERE nd.notification_id = ?)
           )`,
        [notificationId, auth.userId, notificationId, notificationId]
      );
    }
    if (result.affectedRows === 0) {
      return reply.status(404).send({
        success: false,
        error: { code: 'RESOURCE_NOT_FOUND', message: 'Notification not found' },
      });
    }
    return reply.status(200).send({
      success: true,
      data: { message: 'Notification dismissed' },
    });
  }

  async registerDevice(request: FastifyRequest, reply: FastifyReply) {
    const auth = (request as AuthenticatedRequest).user;
    const body = registerDeviceSchema.parse(request.body);

    const existing = await this.db.queryOne(
      'SELECT id FROM user_push_devices WHERE user_id = ? AND device_uuid = ?',
      [auth.userId, body.deviceUuid]
    );

    if (existing) {
      await this.db.execute(
        `UPDATE user_push_devices SET push_token = ?, platform = ?, app_version = ?, is_active = 1, last_seen_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [body.pushToken, body.platform, body.appVersion || null, existing.id]
      );
    } else {
      await this.db.execute(
        `INSERT INTO user_push_devices (user_id, device_uuid, platform, push_token, app_version, is_active, last_seen_at) VALUES (?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)`,
        [auth.userId, body.deviceUuid, body.platform, body.pushToken, body.appVersion || null]
      );
    }

    return reply.status(200).send({
      success: true,
      data: { message: 'Push device registered successfully' },
    });
  }

  // --- Admin Reminder Endpoints ---

  async listReminders(request: FastifyRequest, reply: FastifyReply) {
    let reminders: any[];
    try {
      reminders = await this.db.query(`
        SELECT *, 
               name as title, 
               trigger_mode as mode 
        FROM reminder_rules 
        ORDER BY id ASC
      `);
    } catch {
      const rows = await this.db.query(`SELECT * FROM reminder_rules ORDER BY id ASC`);
      reminders = rows.map((r: any) => ({
        ...r,
        title: r.title ?? r.name ?? 'Reminder',
        name: r.name ?? r.title ?? 'Reminder',
        mode: r.mode ?? r.trigger_mode ?? 'fixed_time',
        trigger_mode: r.trigger_mode ?? r.mode ?? 'fixed_time',
        category: r.category ?? r.target_category ?? 'custom',
      }));
    }
    return reply.status(200).send({
      success: true,
      data: reminders,
    });
  }

  async getReminder(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as { id: string };
    const reminderId = parsePositiveInt(params.id, 'reminderId');
    let reminder: any;
    try {
      reminder = await this.db.queryOne(
        `SELECT *, name as title, trigger_mode as mode FROM reminder_rules WHERE id = ?`,
        [reminderId]
      );
    } catch {
      const row = await this.db.queryOne(
        `SELECT * FROM reminder_rules WHERE id = ?`,
        [reminderId]
      );
      if (row) {
        reminder = {
          ...row,
          title: row.title ?? row.name ?? 'Reminder',
          name: row.name ?? row.title ?? 'Reminder',
          mode: row.mode ?? row.trigger_mode ?? 'fixed_time',
          trigger_mode: row.trigger_mode ?? row.mode ?? 'fixed_time',
          category: row.category ?? row.target_category ?? 'custom',
        };
      }
    }
    if (!reminder) throw new NotFoundError('Reminder rule not found');
    return reply.status(200).send({
      success: true,
      data: reminder,
    });
  }

  async createReminder(request: FastifyRequest, reply: FastifyReply) {
    const body = reminderSchema.parse(request.body);
    const auth = (request as AuthenticatedRequest).user;
    const res = await this.db.execute(
      `INSERT INTO reminder_rules (
         name, category, rule_scope, trigger_mode, fixed_time, offset_minutes,
         grace_period_minutes, repeat_interval_minutes, max_repeats,
         active_window_start, active_window_end, is_active, created_by
       ) VALUES (?, ?, 'system', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        body.title,
        body.category,
        body.mode,
        body.fixedTime || null,
        body.offsetMinutes || null,
        body.gracePeriodMinutes || 0,
        body.repeatIntervalMinutes || null,
        body.maxRepeats || 1,
        body.activeWindowStart || null,
        body.activeWindowEnd || null,
        body.isActive ? 1 : 0,
        auth.userId,
      ]
    );
    await recordAuditEvent(request, 'reminder.created', 'reminder_rule', res.insertId, { title: body.title, category: body.category });
    return reply.status(201).send({
      success: true,
      data: { id: res.insertId },
    });
  }

  async updateReminder(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as { id: string };
    const reminderId = parsePositiveInt(params.id, 'reminderId');
    const body = reminderSchema.parse(request.body);

    const existing = await this.db.queryOne('SELECT id FROM reminder_rules WHERE id = ?', [reminderId]);
    if (!existing) throw new NotFoundError('Reminder rule not found');

    await this.db.execute(
      `UPDATE reminder_rules SET 
         name = ?, category = ?, trigger_mode = ?, fixed_time = ?, offset_minutes = ?,
         grace_period_minutes = ?, repeat_interval_minutes = ?, max_repeats = ?,
         active_window_start = ?, active_window_end = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        body.title,
        body.category,
        body.mode,
        body.fixedTime || null,
        body.offsetMinutes || null,
        body.gracePeriodMinutes || 0,
        body.repeatIntervalMinutes || null,
        body.maxRepeats || 1,
        body.activeWindowStart || null,
        body.activeWindowEnd || null,
        body.isActive ? 1 : 0,
        reminderId,
      ]
    );

    await recordAuditEvent(request, 'reminder.updated', 'reminder_rule', reminderId, { title: body.title });
    return reply.status(200).send({
      success: true,
      data: { id: reminderId, message: 'Reminder updated successfully' },
    });
  }

  async toggleReminder(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as { id: string };
    const reminderId = parsePositiveInt(params.id, 'reminderId');
    const body = z.object({ isActive: z.boolean() }).parse(request.body || {});

    const existing = await this.db.queryOne('SELECT id FROM reminder_rules WHERE id = ?', [reminderId]);
    if (!existing) throw new NotFoundError('Reminder rule not found');

    await this.db.execute(
      'UPDATE reminder_rules SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [body.isActive ? 1 : 0, reminderId]
    );

    await recordAuditEvent(request, 'reminder.toggled', 'reminder_rule', reminderId, { isActive: body.isActive });
    return reply.status(200).send({
      success: true,
      data: { id: reminderId, isActive: body.isActive },
    });
  }

  async deleteReminder(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as { id: string };
    const reminderId = parsePositiveInt(params.id, 'reminderId');

    const result = await this.db.execute('DELETE FROM reminder_rules WHERE id = ?', [reminderId]);
    if (result.affectedRows === 0) throw new NotFoundError('Reminder rule not found');

    await recordAuditEvent(request, 'reminder.deleted', 'reminder_rule', reminderId, {});
    return reply.status(200).send({
      success: true,
      data: { message: 'Reminder deleted successfully' },
    });
  }

  // --- Self-Service User Reminders ---

  async getMyReminders(request: FastifyRequest, reply: FastifyReply) {
    const auth = (request as AuthenticatedRequest).user;
    let reminders: any[];
    try {
      reminders = await this.db.query(
        `SELECT *, name as title, trigger_mode as mode
         FROM reminder_rules
         WHERE user_id = ? OR (rule_scope = 'system' AND user_id IS NULL AND is_active = 1)
         ORDER BY id ASC`,
        [auth.userId]
      );
    } catch {
      try {
        const rows = await this.db.query(
          `SELECT * FROM reminder_rules WHERE user_id = ? OR (user_id IS NULL AND is_active = 1) ORDER BY id ASC`,
          [auth.userId]
        );
        reminders = rows.map((r: any) => ({
          ...r,
          title: r.title ?? r.name ?? 'Reminder',
          name: r.name ?? r.title ?? 'Reminder',
          mode: r.mode ?? r.trigger_mode ?? 'fixed_time',
          trigger_mode: r.trigger_mode ?? r.mode ?? 'fixed_time',
          category: r.category ?? r.target_category ?? 'custom',
          rule_scope: r.rule_scope ?? (r.user_id ? 'user' : 'system'),
        }));
      } catch {
        reminders = [];
      }
    }
    return reply.status(200).send({ success: true, data: reminders });
  }

  async createMyReminder(request: FastifyRequest, reply: FastifyReply) {
    const auth = (request as AuthenticatedRequest).user;
    const body = reminderSchema.parse(request.body);
    const res = await this.db.execute(
      `INSERT INTO reminder_rules (
         user_id, name, category, rule_scope, trigger_mode, fixed_time, offset_minutes,
         grace_period_minutes, repeat_interval_minutes, max_repeats,
         active_window_start, active_window_end, is_active, created_by
       ) VALUES (?, ?, ?, 'user', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        auth.userId,
        body.title,
        body.category,
        body.mode,
        body.fixedTime || null,
        body.offsetMinutes || null,
        body.gracePeriodMinutes || 0,
        body.repeatIntervalMinutes || null,
        body.maxRepeats || 1,
        body.activeWindowStart || null,
        body.activeWindowEnd || null,
        body.isActive ? 1 : 0,
        auth.userId,
      ]
    );
    const created = await this.db.queryOne(
      `SELECT *, name as title, trigger_mode as mode FROM reminder_rules WHERE id = ?`,
      [res.insertId]
    );
    return reply.status(201).send({ success: true, data: created });
  }

  async updateMyReminder(request: FastifyRequest, reply: FastifyReply) {
    const auth = (request as AuthenticatedRequest).user;
    const params = request.params as { id: string };
    const reminderId = parsePositiveInt(params.id, 'reminderId');
    const existing = await this.db.queryOne<{ id: number; user_id: number | null }>(
      'SELECT id, user_id FROM reminder_rules WHERE id = ?',
      [reminderId]
    );
    if (!existing || existing.user_id !== auth.userId) {
      throw new NotFoundError('Reminder rule not found or not owned by user');
    }
    const body = updateReminderSchema.parse(request.body);
    const setClauses: string[] = [];
    const values: any[] = [];
    if (body.title !== undefined) { setClauses.push('name = ?'); values.push(body.title); }
    if (body.category !== undefined) { setClauses.push('category = ?'); values.push(body.category); }
    if (body.mode !== undefined) { setClauses.push('trigger_mode = ?'); values.push(body.mode); }
    if (body.fixedTime !== undefined) { setClauses.push('fixed_time = ?'); values.push(body.fixedTime); }
    if (body.offsetMinutes !== undefined) { setClauses.push('offset_minutes = ?'); values.push(body.offsetMinutes); }
    if (body.gracePeriodMinutes !== undefined) { setClauses.push('grace_period_minutes = ?'); values.push(body.gracePeriodMinutes); }
    if (body.repeatIntervalMinutes !== undefined) { setClauses.push('repeat_interval_minutes = ?'); values.push(body.repeatIntervalMinutes); }
    if (body.maxRepeats !== undefined) { setClauses.push('max_repeats = ?'); values.push(body.maxRepeats); }
    if (body.activeWindowStart !== undefined) { setClauses.push('active_window_start = ?'); values.push(body.activeWindowStart); }
    if (body.activeWindowEnd !== undefined) { setClauses.push('active_window_end = ?'); values.push(body.activeWindowEnd); }
    if (body.isActive !== undefined) { setClauses.push('is_active = ?'); values.push(body.isActive ? 1 : 0); }
    setClauses.push('updated_at = CURRENT_TIMESTAMP');
    await this.db.execute(`UPDATE reminder_rules SET ${setClauses.join(', ')} WHERE id = ?`, [...values, reminderId]);
    const updated = await this.db.queryOne(
      `SELECT *, name as title, trigger_mode as mode FROM reminder_rules WHERE id = ?`,
      [reminderId]
    );
    return reply.status(200).send({ success: true, data: updated });
  }

  async deleteMyReminder(request: FastifyRequest, reply: FastifyReply) {
    const auth = (request as AuthenticatedRequest).user;
    const params = request.params as { id: string };
    const reminderId = parsePositiveInt(params.id, 'reminderId');
    const result = await this.db.execute(
      'DELETE FROM reminder_rules WHERE id = ? AND user_id = ?',
      [reminderId, auth.userId]
    );
    if (result.affectedRows === 0) {
      throw new NotFoundError('Reminder rule not found or not owned by user');
    }
    return reply.status(200).send({ success: true, data: { message: 'Reminder deleted successfully' } });
  }

  async processReminders(request: FastifyRequest, reply: FastifyReply) {
    const summary = await new ReminderWorker().processOnce();
    await recordAuditEvent(request, 'reminders.processed', 'system_worker', null, {
      dispatchedCount: summary.notificationsDispatched,
      rulesCount: summary.rulesEvaluated,
      errorsCount: summary.errorsCount,
    });

    return reply.status(200).send({
      success: true,
      data: {
        processedRules: summary.rulesEvaluated,
        dispatchedNotifications: summary.notificationsDispatched,
        errors: summary.errorsCount,
      },
    });
  }

  // --- Admin Notification Inspection & Dispatch Endpoints ---

  async listAdminNotifications(request: FastifyRequest, reply: FastifyReply) {
    const query = (request.query || {}) as { userId?: string; category?: string; status?: string; page?: string; limit?: string };
    const page = parseBoundedPositiveInt(query.page, 'page', 1, 100000, 1);
    const limit = parseBoundedPositiveInt(query.limit, 'limit', 1, 100, 50);
    const offset = (page - 1) * limit;

    const whereClauses: string[] = ['1=1'];
    const params: any[] = [];

    if (query.userId !== undefined && query.userId !== '') {
      const parsedUserId = parsePositiveInt(String(query.userId).trim(), 'userId');
      whereClauses.push('n.user_id = ?');
      params.push(parsedUserId);
    }
    if (query.category) {
      whereClauses.push('n.category = ?');
      params.push(query.category);
    }
    if (query.status) {
      whereClauses.push('n.status = ?');
      params.push(query.status);
    }

    const whereStr = whereClauses.join(' AND ');

    const countRes = await this.db.queryOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM notifications n WHERE ${whereStr}`,
      params
    );
    const total = countRes?.count || 0;

    const notifications = await this.db.query(
      `SELECT n.*, u.first_name, u.last_name, u.email as user_email,
              (SELECT COUNT(*) FROM notification_deliveries nd WHERE nd.notification_id = n.id) as delivery_count
       FROM notifications n
       JOIN users u ON u.id = n.user_id
       WHERE ${whereStr}
       ORDER BY n.id DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return reply.status(200).send({
      success: true,
      data: {
        notifications,
        total,
        page,
        limit,
      },
    });
  }

  async getAdminNotificationDetail(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as { id: string };
    const notificationId = parsePositiveInt(params.id, 'notificationId');

    const notification = await this.db.queryOne(
      `SELECT n.*, u.first_name, u.last_name, u.email as user_email
       FROM notifications n
       JOIN users u ON u.id = n.user_id
       WHERE n.id = ?`,
      [notificationId]
    );
    if (!notification) throw new NotFoundError('Notification not found');

    const deliveries = await this.db.query(
      `SELECT * FROM notification_deliveries WHERE notification_id = ? ORDER BY created_at DESC`,
      [notificationId]
    );

    return reply.status(200).send({
      success: true,
      data: {
        ...notification,
        deliveries,
      },
    });
  }

  async sendAdminNotification(request: FastifyRequest, reply: FastifyReply) {
    const body = adminSendNotificationSchema.parse(request.body);

    type NotificationTarget = {
      id: number;
      in_app_enabled: number | null;
      push_enabled: number | null;
    };

    let targets: NotificationTarget[] = [];
    if (body.userId) {
      const user = await this.db.queryOne<NotificationTarget>(
        `SELECT u.id,
                COALESCE(s.in_app_enabled, 1) as in_app_enabled,
                COALESCE(s.push_enabled, 1) as push_enabled
         FROM users u
         LEFT JOIN user_notification_settings s ON s.user_id = u.id
         WHERE u.id = ?`,
        [body.userId],
      );
      if (!user) throw new NotFoundError('Target user not found');
      targets = [user];
    } else {
      targets = await this.db.query<NotificationTarget>(
        `SELECT u.id,
                COALESCE(s.in_app_enabled, 1) as in_app_enabled,
                COALESCE(s.push_enabled, 1) as push_enabled
         FROM users u
         LEFT JOIN user_notification_settings s ON s.user_id = u.id
         WHERE u.status = 'active' AND u.role_id = 3
         ORDER BY u.id ASC`,
      );
    }

    let createdCount = 0;
    for (const target of targets) {
      const uId = Number(target.id);
      const inAppEnabled = target.in_app_enabled !== 0;
      const pushEnabled = target.push_enabled !== 0;

      // If user disabled both in-app and push, skip notification creation and delivery
      if (!inAppEnabled && !pushEnabled) {
        continue;
      }

      const notifRes = await this.db.execute(
        `INSERT INTO notifications (user_id, category, notification_type, title, message, deep_link, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'unread', CURRENT_TIMESTAMP)`,
        [uId, body.category, body.notificationType, body.title, body.message, body.deepLink || null]
      );

      if (inAppEnabled) {
        await this.db.execute(
          `INSERT INTO notification_deliveries (notification_id, channel, status, delivered_at, created_at)
           VALUES (?, 'in_app', 'sent', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          [notifRes.insertId]
        );
      }

      if (pushEnabled) {
        await pushNotificationService.dispatchPushToUserDevices(this.db, {
          notificationId: notifRes.insertId,
          userId: uId,
          pushEnabled,
          title: body.title,
          message: body.message,
          deepLink: body.deepLink,
          category: body.category,
        });
      }

      createdCount++;
    }

    await recordAuditEvent(request, 'notification.dispatched', 'notification', null, {
      title: body.title,
      targetUserIdsCount: targets.length,
      isBroadcast: !body.userId,
    });

    return reply.status(201).send({
      success: true,
      data: {
        dispatchedCount: createdCount,
        message: `Notification sent to ${createdCount} user(s)`,
      },
    });
  }
}

export async function notificationsRoutes(fastify: FastifyInstance) {
  const controller = new NotificationsController();

  // User notifications & reminders
  fastify.get('/me/notifications', { preHandler: [authenticate] }, (req, res) => controller.getMyNotifications(req, res));
  fastify.post('/me/notifications/:id/read', { preHandler: [authenticate] }, (req, res) => controller.markAsRead(req, res));
  fastify.post('/me/notifications/read-all', { preHandler: [authenticate] }, (req, res) => controller.markAllAsRead(req, res));
  fastify.post('/me/notifications/:id/dismiss', { preHandler: [authenticate] }, (req, res) => controller.dismissNotification(req, res));
  fastify.post('/me/devices', { preHandler: [authenticate] }, (req, res) => controller.registerDevice(req, res));
  fastify.get('/me/reminders', { preHandler: [authenticate] }, (req, res) => controller.getMyReminders(req, res));
  fastify.post('/me/reminders', { preHandler: [authenticate] }, (req, res) => controller.createMyReminder(req, res));
  fastify.put('/me/reminders/:id', { preHandler: [authenticate] }, (req, res) => controller.updateMyReminder(req, res));
  fastify.delete('/me/reminders/:id', { preHandler: [authenticate] }, (req, res) => controller.deleteMyReminder(req, res));

  // Admin Reminders CRUD
  fastify.get('/admin/reminders', { preHandler: [authenticate, requireAdmin] }, (req, res) => controller.listReminders(req, res));
  fastify.get('/admin/reminders/:id', { preHandler: [authenticate, requireAdmin] }, (req, res) => controller.getReminder(req, res));
  fastify.post('/admin/reminders', { preHandler: [authenticate, requireAdmin] }, (req, res) => controller.createReminder(req, res));
  fastify.put('/admin/reminders/:id', { preHandler: [authenticate, requireAdmin] }, (req, res) => controller.updateReminder(req, res));
  fastify.patch('/admin/reminders/:id/toggle', { preHandler: [authenticate, requireAdmin] }, (req, res) => controller.toggleReminder(req, res));
  fastify.delete('/admin/reminders/:id', { preHandler: [authenticate, requireAdmin] }, (req, res) => controller.deleteReminder(req, res));
  fastify.post('/admin/reminders/process', { preHandler: [authenticate, requireAdmin] }, (req, res) => controller.processReminders(req, res));

  // Admin Notifications Inspection & Dispatch
  fastify.get('/admin/notifications', { preHandler: [authenticate, requireAdmin] }, (req, res) => controller.listAdminNotifications(req, res));
  fastify.get('/admin/notifications/:id', { preHandler: [authenticate, requireAdmin] }, (req, res) => controller.getAdminNotificationDetail(req, res));
  fastify.post('/admin/notifications', { preHandler: [authenticate, requireAdmin] }, (req, res) => controller.sendAdminNotification(req, res));
}
