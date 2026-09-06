import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import {
  MockPushProvider,
  UnavailablePushProvider,
  testSentPushNotifications,
} from '../src/shared/services/push-provider.js';
import { PushNotificationService } from '../src/shared/services/push-notification.service.js';
import { buildApp } from '../src/app/app.js';
import { runMigrations } from '../src/database/migrate.js';
import { seedDatabase } from '../src/database/seed.js';
import { getDatabasePool, closeDatabasePool, resetDatabasePool } from '../src/database/pool.js';
import { env } from '../src/config/env.js';
import { ReminderWorker } from '../src/workers/reminder.worker.js';

const testDbDir = path.resolve(process.cwd(), 'tests', '.tmp');
const testDbPath = path.resolve(testDbDir, `fitness_test_push_${process.pid}_${Date.now()}.db`);

describe('Push Provider & Push Delivery Abstraction Suite', () => {
  let app: FastifyInstance;
  let adminToken: string;

  const origDbClient = env.dbClient;

  beforeAll(async () => {
    if (!fs.existsSync(testDbDir)) {
      fs.mkdirSync(testDbDir, { recursive: true });
    }

    process.env.SQLITE_DB_PATH = testDbPath;
    env.sqliteDbPath = testDbPath;
    env.dbClient = 'sqlite';
    resetDatabasePool();

    await runMigrations();
    await seedDatabase();

    app = await buildApp();
    await app.ready();

    // Login as admin
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'admin@fitnessplatform.com',
        password: 'Admin123!',
        deviceName: 'Admin Console',
      },
    });
    expect(loginRes.statusCode).toBe(200);
    const json = loginRes.json();
    adminToken = json.data.accessToken;
  });

  afterAll(async () => {
    if (app) await app.close();
    await closeDatabasePool();
    env.dbClient = origDbClient;
    resetDatabasePool();
    if (fs.existsSync(testDbPath)) {
      try {
        fs.unlinkSync(testDbPath);
      } catch (_) {}
    }
  });

  beforeEach(async () => {
    testSentPushNotifications.length = 0;
  });

  it('MockPushProvider delivers push notifications and records in-memory history without external credentials', async () => {
    const provider = new MockPushProvider();
    expect(provider.providerName).toBe('mock');
    expect(provider.isAvailable()).toBe(true);

    const result = await provider.send({
      deviceToken: 'fcm-token-test-device-12345',
      platform: 'android',
      title: 'Workout Reminder',
      body: 'Time to start your Upper Body Push session!',
      data: { notificationId: 42, category: 'workout' },
      deepLink: 'fitnessapp://workout/12',
    });

    expect(result.success).toBe(true);
    expect(result.providerMessageId).toBeDefined();
    expect(result.providerMessageId).toMatch(/^mock-push-/);
    expect(testSentPushNotifications).toHaveLength(1);
    expect(testSentPushNotifications[0].deviceToken).toBe('fcm-token-test-device-12345');
    expect(testSentPushNotifications[0].platform).toBe('android');
    expect(testSentPushNotifications[0].title).toBe('Workout Reminder');
  });

  it('UnavailablePushProvider reports unavailable status and fails closed without claiming sent', async () => {
    const provider = new UnavailablePushProvider('none', 'Push provider is unconfigured in this environment.');
    expect(provider.providerName).toBe('none');
    expect(provider.isAvailable()).toBe(false);

    const result = await provider.send({
      deviceToken: 'apns-token-test-ios-98765',
      platform: 'ios',
      title: 'Meal Reminder',
      body: 'Time for Lunch: Grilled Chicken & Rice',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Push provider is unconfigured in this environment.');
    expect(result.providerMessageId).toBeUndefined();
    expect(testSentPushNotifications).toHaveLength(0);
  });

  it('PushNotificationService correctly records sent status in notification_deliveries when provider succeeds', async () => {
    const db = getDatabasePool();

    const userRes = await db.execute(
      `INSERT INTO users (email, password_hash, first_name, last_name, role_id, status)
       VALUES ('athlete@test.com', 'hash', 'Jane', 'Athlete', 3, 'active')`
    );
    const userId = userRes.insertId;

    const devRes = await db.execute(
      `INSERT INTO user_push_devices (user_id, device_uuid, platform, push_token, is_active, last_seen_at)
       VALUES (?, 'device-uuid-1', 'android', 'mock-push-token-111', 1, CURRENT_TIMESTAMP)`,
      [userId]
    );

    const notifRes = await db.execute(
      `INSERT INTO notifications (user_id, category, notification_type, title, message, status)
       VALUES (?, 'workout', 'reminder', 'Hydration Check', 'Drink 500ml water', 'unread')`,
      [userId]
    );

    const mockProvider = new MockPushProvider();
    const service = new PushNotificationService(mockProvider);

    const dispatchResult = await service.dispatchPushToUserDevices(db, {
      notificationId: notifRes.insertId,
      userId,
      title: 'Hydration Check',
      message: 'Drink 500ml water',
      category: 'water',
    });

    expect(dispatchResult).toEqual({ attempted: 1, sent: 1, failed: 0 });

    const deliveries = await db.query(
      `SELECT * FROM notification_deliveries WHERE notification_id = ? AND channel = 'push'`,
      [notifRes.insertId]
    );

    expect(deliveries).toHaveLength(1);
    expect(deliveries[0].status).toBe('sent');
    expect(deliveries[0].user_push_device_id).toBe(devRes.insertId);
    expect(deliveries[0].provider_message_id).toBeDefined();
    expect(deliveries[0].delivered_at).toBeDefined();
  });

  it('PushNotificationService records failed status in notification_deliveries when provider is unavailable (never claiming sent)', async () => {
    const db = getDatabasePool();

    const userRes = await db.execute(
      `INSERT INTO users (email, password_hash, first_name, last_name, role_id, status)
       VALUES ('athlete2@test.com', 'hash', 'Mark', 'Athlete', 3, 'active')`
    );
    const userId = userRes.insertId;

    const devRes = await db.execute(
      `INSERT INTO user_push_devices (user_id, device_uuid, platform, push_token, is_active, last_seen_at)
       VALUES (?, 'device-uuid-2', 'ios', 'mock-push-token-222', 1, CURRENT_TIMESTAMP)`,
      [userId]
    );

    const notifRes = await db.execute(
      `INSERT INTO notifications (user_id, category, notification_type, title, message, status)
       VALUES (?, 'meal', 'reminder', 'Lunch Reminder', 'Time for lunch', 'unread')`,
      [userId]
    );

    const unavailableProvider = new UnavailablePushProvider('none', 'Push provider is unconfigured in this environment.');
    const service = new PushNotificationService(unavailableProvider);

    const dispatchResult = await service.dispatchPushToUserDevices(db, {
      notificationId: notifRes.insertId,
      userId,
      title: 'Lunch Reminder',
      message: 'Time for lunch',
      category: 'meal',
    });

    expect(dispatchResult).toEqual({ attempted: 1, sent: 0, failed: 1 });

    const deliveries = await db.query(
      `SELECT * FROM notification_deliveries WHERE notification_id = ? AND channel = 'push'`,
      [notifRes.insertId]
    );

    expect(deliveries).toHaveLength(1);
    expect(deliveries[0].status).toBe('failed');
    expect(deliveries[0].user_push_device_id).toBe(devRes.insertId);
    expect(deliveries[0].last_error).toBe('Push provider is unconfigured in this environment.');
    expect(deliveries[0].sent_at).toBeNull();
    expect(deliveries[0].delivered_at).toBeNull();
  });

  it('Handles multiple devices and ignores inactive push devices', async () => {
    const db = getDatabasePool();

    const userRes = await db.execute(
      `INSERT INTO users (email, password_hash, first_name, last_name, role_id, status)
       VALUES ('athlete3@test.com', 'hash', 'Sarah', 'Athlete', 3, 'active')`
    );
    const userId = userRes.insertId;

    // 2 active devices, 1 inactive device
    await db.execute(
      `INSERT INTO user_push_devices (user_id, device_uuid, platform, push_token, is_active, last_seen_at)
       VALUES (?, 'device-phone', 'android', 'token-phone', 1, CURRENT_TIMESTAMP)`,
      [userId]
    );
    await db.execute(
      `INSERT INTO user_push_devices (user_id, device_uuid, platform, push_token, is_active, last_seen_at)
       VALUES (?, 'device-tablet', 'ios', 'token-tablet', 1, CURRENT_TIMESTAMP)`,
      [userId]
    );
    await db.execute(
      `INSERT INTO user_push_devices (user_id, device_uuid, platform, push_token, is_active, last_seen_at)
       VALUES (?, 'device-old', 'android', 'token-old', 0, CURRENT_TIMESTAMP)`,
      [userId]
    );

    const notifRes = await db.execute(
      `INSERT INTO notifications (user_id, category, notification_type, title, message, status)
       VALUES (?, 'workout', 'alert', 'Overdue: Workout', 'Workout is overdue', 'unread')`,
      [userId]
    );

    const mockProvider = new MockPushProvider();
    const service = new PushNotificationService(mockProvider);

    const dispatchResult = await service.dispatchPushToUserDevices(db, {
      notificationId: notifRes.insertId,
      userId,
      title: 'Overdue: Workout',
      message: 'Workout is overdue',
    });

    expect(dispatchResult).toEqual({ attempted: 2, sent: 2, failed: 0 });
    expect(testSentPushNotifications).toHaveLength(2);

    const deliveries = await db.query(
      `SELECT * FROM notification_deliveries WHERE notification_id = ? AND channel = 'push'`,
      [notifRes.insertId]
    );
    expect(deliveries).toHaveLength(2);
    expect(deliveries.every((d) => d.status === 'sent')).toBe(true);
  });

  it('push_enabled=0 preference gates push dispatch without recording attempts or false errors', async () => {
    const db = getDatabasePool();

    const userRes = await db.execute(
      `INSERT INTO users (email, password_hash, first_name, last_name, role_id, status)
       VALUES ('athlete_nopush@test.com', 'hash', 'NoPush', 'Athlete', 3, 'active')`
    );
    const userId = userRes.insertId;

    // Active device registered
    await db.execute(
      `INSERT INTO user_push_devices (user_id, device_uuid, platform, push_token, is_active, last_seen_at)
       VALUES (?, 'device-nopush', 'android', 'token-nopush', 1, CURRENT_TIMESTAMP)`,
      [userId]
    );

    // Explicitly set push_enabled = 0
    await db.execute(
      `INSERT INTO user_notification_settings (user_id, in_app_enabled, push_enabled, local_notifications_enabled)
       VALUES (?, 1, 0, 1)`,
      [userId]
    );

    const notifRes = await db.execute(
      `INSERT INTO notifications (user_id, category, notification_type, title, message, status)
       VALUES (?, 'water', 'reminder', 'Hydrate', 'Drink water', 'unread')`,
      [userId]
    );

    const mockProvider = new MockPushProvider();
    const service = new PushNotificationService(mockProvider);

    const dispatchResult = await service.dispatchPushToUserDevices(db, {
      notificationId: notifRes.insertId,
      userId,
      title: 'Hydrate',
      message: 'Drink water',
    });

    expect(dispatchResult).toEqual({ attempted: 0, sent: 0, failed: 0 });
    expect(testSentPushNotifications).toHaveLength(0);

    const deliveries = await db.query(
      `SELECT * FROM notification_deliveries WHERE notification_id = ? AND channel = 'push'`,
      [notifRes.insertId]
    );
    expect(deliveries).toHaveLength(0);
  });

  it('local_notifications_enabled=0 is client-local and does NOT suppress server in-app or push delivery in reminder worker', async () => {
    const db = getDatabasePool();

    const userRes = await db.execute(
      `INSERT INTO users (email, password_hash, first_name, last_name, role_id, status, timezone)
       VALUES ('athlete_localoff@test.com', 'hash', 'LocalOff', 'Athlete', 3, 'active', 'UTC')`
    );
    const userId = userRes.insertId;

    // Active push device
    await db.execute(
      `INSERT INTO user_push_devices (user_id, device_uuid, platform, push_token, is_active, last_seen_at)
       VALUES (?, 'device-localoff', 'ios', 'token-localoff', 1, CURRENT_TIMESTAMP)`,
      [userId]
    );

    // in_app=1, push=1, local_notifications=0 (client-local disabled)
    await db.execute(
      `INSERT INTO user_notification_settings (user_id, in_app_enabled, push_enabled, local_notifications_enabled)
       VALUES (?, 1, 1, 0)`,
      [userId]
    );

    // Create a daily task from yesterday to trigger missed task processing
    await db.execute(
      `INSERT INTO daily_tasks (user_id, task_date, task_key, task_type, title_snapshot, status)
       VALUES (?, '2020-01-01', 'task-yesterday-localoff', 'workout', 'Morning Workout', 'pending')`,
      [userId]
    );

    const worker = new ReminderWorker();
    const result = await worker.processOnce();
    expect(result.errorsCount).toBe(0);

    // Stale task should be marked as missed
    const task = await db.queryOne<{ status: string }>(
      `SELECT status FROM daily_tasks WHERE user_id = ? AND task_key = 'task-yesterday-localoff'`,
      [userId]
    );
    expect(task?.status).toBe('missed');

    // Server in-app notification should be created
    const notifs = await db.query<{ id: number; title: string }>(
      `SELECT id, title FROM notifications WHERE user_id = ?`,
      [userId]
    );
    expect(notifs).toHaveLength(1);
    expect(notifs[0].title).toContain('Missed task: Morning Workout');

    // Both in_app and push deliveries should be recorded
    const deliveries = await db.query<{ channel: string; status: string }>(
      `SELECT channel, status FROM notification_deliveries WHERE notification_id = ?`,
      [notifs[0].id]
    );
    expect(deliveries.some((d) => d.channel === 'in_app' && d.status === 'sent')).toBe(true);
    expect(deliveries.some((d) => d.channel === 'push' && d.status === 'sent')).toBe(true);
    expect(testSentPushNotifications).toHaveLength(1);
  });

  it('Admin notification send correctly gates in_app vs push deliveries according to user settings', async () => {
    const db = getDatabasePool();

    // User A: in_app=0, push=1 (push only)
    const userARes = await db.execute(
      `INSERT INTO users (email, password_hash, first_name, last_name, role_id, status)
       VALUES ('athlete_pushonly@test.com', 'hash', 'PushOnly', 'Athlete', 3, 'active')`
    );
    const userAId = userARes.insertId;
    await db.execute(
      `INSERT INTO user_push_devices (user_id, device_uuid, platform, push_token, is_active, last_seen_at)
       VALUES (?, 'dev-pushonly', 'android', 'token-pushonly', 1, CURRENT_TIMESTAMP)`,
      [userAId]
    );
    await db.execute(
      `INSERT INTO user_notification_settings (user_id, in_app_enabled, push_enabled, local_notifications_enabled)
       VALUES (?, 0, 1, 1)`,
      [userAId]
    );

    // Send admin notification to User A
    const resA = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/notifications',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        userId: userAId,
        category: 'system',
        notificationType: 'system',
        title: 'Push Only Announcement',
        message: 'This should go to push, but not in_app delivery row.',
      },
    });
    expect(resA.statusCode).toBe(201);

    const notifsA = await db.query<{ id: number }>(
      `SELECT id FROM notifications WHERE user_id = ?`,
      [userAId]
    );
    expect(notifsA).toHaveLength(1);

    const deliveriesA = await db.query<{ channel: string; status: string }>(
      `SELECT channel, status FROM notification_deliveries WHERE notification_id = ?`,
      [notifsA[0].id]
    );
    // Push is delivered, in_app delivery is omitted
    expect(deliveriesA.some((d) => d.channel === 'push' && d.status === 'sent')).toBe(true);
    expect(deliveriesA.some((d) => d.channel === 'in_app')).toBe(false);

    // User B: in_app=1, push=0 (in_app only)
    const userBRes = await db.execute(
      `INSERT INTO users (email, password_hash, first_name, last_name, role_id, status)
       VALUES ('athlete_inapponly@test.com', 'hash', 'InAppOnly', 'Athlete', 3, 'active')`
    );
    const userBId = userBRes.insertId;
    await db.execute(
      `INSERT INTO user_push_devices (user_id, device_uuid, platform, push_token, is_active, last_seen_at)
       VALUES (?, 'dev-inapponly', 'ios', 'token-inapponly', 1, CURRENT_TIMESTAMP)`,
      [userBId]
    );
    await db.execute(
      `INSERT INTO user_notification_settings (user_id, in_app_enabled, push_enabled, local_notifications_enabled)
       VALUES (?, 1, 0, 1)`,
      [userBId]
    );

    testSentPushNotifications.length = 0;

    const resB = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/notifications',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        userId: userBId,
        category: 'workout',
        notificationType: 'alert',
        title: 'In-App Only Notice',
        message: 'This should record in_app delivery without push dispatch.',
      },
    });
    expect(resB.statusCode).toBe(201);

    const notifsB = await db.query<{ id: number }>(
      `SELECT id FROM notifications WHERE user_id = ?`,
      [userBId]
    );
    expect(notifsB).toHaveLength(1);

    const deliveriesB = await db.query<{ channel: string; status: string }>(
      `SELECT channel, status FROM notification_deliveries WHERE notification_id = ?`,
      [notifsB[0].id]
    );
    // In-app is delivered, push delivery is omitted
    expect(deliveriesB.some((d) => d.channel === 'in_app' && d.status === 'sent')).toBe(true);
    expect(deliveriesB.some((d) => d.channel === 'push')).toBe(false);
    expect(testSentPushNotifications).toHaveLength(0);

    // User C: in_app=0, push=0 (both disabled)
    const userCRes = await db.execute(
      `INSERT INTO users (email, password_hash, first_name, last_name, role_id, status)
       VALUES ('athlete_alloff@test.com', 'hash', 'AllOff', 'Athlete', 3, 'active')`
    );
    const userCId = userCRes.insertId;
    await db.execute(
      `INSERT INTO user_notification_settings (user_id, in_app_enabled, push_enabled, local_notifications_enabled)
       VALUES (?, 0, 0, 1)`,
      [userCId]
    );

    const resC = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/notifications',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        userId: userCId,
        category: 'system',
        notificationType: 'system',
        title: 'Muted Notice',
        message: 'This should be skipped.',
      },
    });
    expect(resC.statusCode).toBe(201);
    expect(JSON.parse(resC.payload).data.dispatchedCount).toBe(0);

    const notifsC = await db.query<{ id: number }>(
      `SELECT id FROM notifications WHERE user_id = ?`,
      [userCId]
    );
    expect(notifsC).toHaveLength(0);
  });

  it('GET /me/notifications strictly enforces in-app visibility boundary: push-only excluded, in-app included, admin inspection preserved', async () => {
    const db = getDatabasePool();
    const passwordHash = await bcrypt.hash('UserPass123!', 10);

    // 1. Create User Push-Only (in_app=0, push=1)
    const userPushOnlyRes = await db.execute(
      `INSERT INTO users (email, password_hash, first_name, last_name, role_id, status)
       VALUES ('user_pushonly@test.com', ?, 'PushOnly', 'User', 3, 'active')`,
      [passwordHash]
    );
    const pushOnlyUserId = userPushOnlyRes.insertId;
    await db.execute(
      `INSERT INTO user_push_devices (user_id, device_uuid, platform, push_token, is_active, last_seen_at)
       VALUES (?, 'dev-pushonly-feed', 'android', 'token-pushonly-feed', 1, CURRENT_TIMESTAMP)`,
      [pushOnlyUserId]
    );
    await db.execute(
      `INSERT INTO user_notification_settings (user_id, in_app_enabled, push_enabled, local_notifications_enabled)
       VALUES (?, 0, 1, 1)`,
      [pushOnlyUserId]
    );

    // 2. Create User In-App-Only (in_app=1, push=0)
    const userInAppOnlyRes = await db.execute(
      `INSERT INTO users (email, password_hash, first_name, last_name, role_id, status)
       VALUES ('user_inapponly@test.com', ?, 'InAppOnly', 'User', 3, 'active')`,
      [passwordHash]
    );
    const inAppOnlyUserId = userInAppOnlyRes.insertId;
    await db.execute(
      `INSERT INTO user_push_devices (user_id, device_uuid, platform, push_token, is_active, last_seen_at)
       VALUES (?, 'dev-inapponly-feed', 'ios', 'token-inapponly-feed', 1, CURRENT_TIMESTAMP)`,
      [inAppOnlyUserId]
    );
    await db.execute(
      `INSERT INTO user_notification_settings (user_id, in_app_enabled, push_enabled, local_notifications_enabled)
       VALUES (?, 1, 0, 1)`,
      [inAppOnlyUserId]
    );

    testSentPushNotifications.length = 0;

    // 3. Admin dispatches notification to User Push-Only
    const sendPushOnlyRes = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/notifications',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        userId: pushOnlyUserId,
        category: 'system',
        notificationType: 'alert',
        title: 'Emergency Server Alert',
        message: 'This is sent via push only',
      },
    });
    expect(sendPushOnlyRes.statusCode).toBe(201);
    expect(testSentPushNotifications).toHaveLength(1);
    expect(testSentPushNotifications[0].title).toBe('Emergency Server Alert');

    // 4. Admin dispatches notification to User In-App-Only
    const sendInAppOnlyRes = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/notifications',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        userId: inAppOnlyUserId,
        category: 'workout',
        notificationType: 'reminder',
        title: 'Daily Workout Summary',
        message: 'This is visible in app feed',
      },
    });
    expect(sendInAppOnlyRes.statusCode).toBe(201);

    // 5. Login as User Push-Only and verify GET /me/notifications is empty
    const loginPushOnlyRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'user_pushonly@test.com',
        password: 'UserPass123!',
        deviceName: 'Phone',
      },
    });
    expect(loginPushOnlyRes.statusCode).toBe(200);
    const pushOnlyToken = loginPushOnlyRes.json().data.accessToken;

    const mePushOnlyRes = await app.inject({
      method: 'GET',
      url: '/api/v1/me/notifications',
      headers: { authorization: `Bearer ${pushOnlyToken}` },
    });
    expect(mePushOnlyRes.statusCode).toBe(200);
    const pushOnlyList = mePushOnlyRes.json().data;
    expect(pushOnlyList).toHaveLength(0); // Push-only notification is NOT returned in in-app feed

    // 6. Login as User In-App-Only and verify GET /me/notifications contains the in-app notification
    const loginInAppOnlyRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'user_inapponly@test.com',
        password: 'UserPass123!',
        deviceName: 'Phone',
      },
    });
    expect(loginInAppOnlyRes.statusCode).toBe(200);
    const inAppOnlyToken = loginInAppOnlyRes.json().data.accessToken;

    const meInAppOnlyRes = await app.inject({
      method: 'GET',
      url: '/api/v1/me/notifications',
      headers: { authorization: `Bearer ${inAppOnlyToken}` },
    });
    expect(meInAppOnlyRes.statusCode).toBe(200);
    const inAppOnlyList = meInAppOnlyRes.json().data;
    expect(inAppOnlyList).toHaveLength(1);
    expect(inAppOnlyList[0].title).toBe('Daily Workout Summary');

    // 7. Admin inspection endpoint still lists all notifications
    const adminListRes = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/notifications',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(adminListRes.statusCode).toBe(200);
    const allAdminNotifs = adminListRes.json().data.notifications;
    expect(allAdminNotifs.some((n: any) => n.title === 'Emergency Server Alert')).toBe(true);
    expect(allAdminNotifs.some((n: any) => n.title === 'Daily Workout Summary')).toBe(true);
  });

  it('enforces in-app visibility boundary: push-only + in-app-disabled + no-device hides from feed and prevents user mutation', async () => {
    const db = getDatabasePool();
    const passwordHash = await bcrypt.hash('UserPass123!', 10);

    // 1. Create user with in_app_enabled=0, push_enabled=1, and NO registered devices
    const userRes = await db.execute(
      `INSERT INTO users (email, password_hash, first_name, last_name, role_id, status)
       VALUES ('user_push_nodevice@test.com', ?, 'NoDevice', 'User', 3, 'active')`,
      [passwordHash]
    );
    const userId = userRes.insertId;
    await db.execute(
      `INSERT INTO user_notification_settings (user_id, in_app_enabled, push_enabled, local_notifications_enabled)
       VALUES (?, 0, 1, 1)`,
      [userId]
    );

    testSentPushNotifications.length = 0;

    // 2. Admin dispatches notification to this user (push enabled, in-app disabled, no devices)
    const sendRes = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/notifications',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        userId,
        category: 'system',
        notificationType: 'alert',
        title: 'Push Only No Device Alert',
        message: 'This notification has no delivery rows but must stay hidden from feed',
      },
    });
    expect(sendRes.statusCode).toBe(201);
    expect(testSentPushNotifications).toHaveLength(0); // 0 devices -> 0 push dispatches

    // Find the created notification ID
    const notifRow = await db.queryOne<{ id: number; status: string }>(
      'SELECT id, status FROM notifications WHERE user_id = ? AND title = ?',
      [userId, 'Push Only No Device Alert']
    );
    expect(notifRow).toBeDefined();
    const notificationId = notifRow!.id;

    // Verify 0 delivery rows exist in DB for this notification
    const deliveries = await db.query(
      'SELECT * FROM notification_deliveries WHERE notification_id = ?',
      [notificationId]
    );
    expect(deliveries).toHaveLength(0);

    // 3. Login as the user
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'user_push_nodevice@test.com',
        password: 'UserPass123!',
        deviceName: 'Test Phone',
      },
    });
    expect(loginRes.statusCode).toBe(200);
    const userToken = loginRes.json().data.accessToken;

    // 4. User feed GET /me/notifications MUST return empty array (not leak notification)
    const feedRes = await app.inject({
      method: 'GET',
      url: '/api/v1/me/notifications',
      headers: { authorization: `Bearer ${userToken}` },
    });
    expect(feedRes.statusCode).toBe(200);
    expect(feedRes.json().data).toEqual([]);

    // 5. User mark-as-read POST /me/notifications/:id/read MUST fail with 404
    const markReadRes = await app.inject({
      method: 'POST',
      url: `/api/v1/me/notifications/${notificationId}/read`,
      headers: { authorization: `Bearer ${userToken}` },
    });
    expect(markReadRes.statusCode).toBe(404);
    expect(markReadRes.json().error.code).toBe('RESOURCE_NOT_FOUND');

    // 6. User dismiss POST /me/notifications/:id/dismiss MUST fail with 404
    const dismissRes = await app.inject({
      method: 'POST',
      url: `/api/v1/me/notifications/${notificationId}/dismiss`,
      headers: { authorization: `Bearer ${userToken}` },
    });
    expect(dismissRes.statusCode).toBe(404);
    expect(dismissRes.json().error.code).toBe('RESOURCE_NOT_FOUND');

    // 7. User read-all POST /me/notifications/read-all MUST succeed but NOT mutate hidden notification
    const readAllRes = await app.inject({
      method: 'POST',
      url: '/api/v1/me/notifications/read-all',
      headers: { authorization: `Bearer ${userToken}` },
    });
    expect(readAllRes.statusCode).toBe(200);

    // Verify DB status remains unread
    const notifAfter = await db.queryOne<{ status: string }>(
      'SELECT status FROM notifications WHERE id = ?',
      [notificationId]
    );
    expect(notifAfter?.status).toBe('unread');

    // 8. Admin inspection endpoints MUST still return this notification
    const adminDetailRes = await app.inject({
      method: 'GET',
      url: `/api/v1/admin/notifications/${notificationId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(adminDetailRes.statusCode).toBe(200);
    expect(adminDetailRes.json().data.title).toBe('Push Only No Device Alert');
    expect(adminDetailRes.json().data.deliveries).toHaveLength(0);
  });
});
