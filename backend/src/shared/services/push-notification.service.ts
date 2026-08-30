import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { DbConnection } from '../../database/types.js';
import {
  PushProvider,
  MockPushProvider,
  UnavailablePushProvider,
} from './push-provider.js';

export interface DispatchPushParams {
  notificationId: number;
  userId: number;
  /**
   * Optional setting already resolved by the caller's batch query. When
   * omitted, the service performs its own defensive lookup.
   */
  pushEnabled?: boolean;
  title: string;
  message: string;
  deepLink?: string | null;
  category?: string | null;
  metadata?: Record<string, any>;
}

export class PushNotificationService {
  private provider: PushProvider;

  constructor(provider?: PushProvider) {
    if (provider) {
      this.provider = provider;
    } else if (env.pushProvider === 'mock' || env.nodeEnv === 'test') {
      this.provider = new MockPushProvider();
    } else {
      this.provider = new UnavailablePushProvider(
        env.pushProvider || 'none',
        'Push notification provider is unconfigured or unavailable on this environment.'
      );
    }
  }

  getProvider(): PushProvider {
    return this.provider;
  }

  setProvider(provider: PushProvider): void {
    this.provider = provider;
  }

  /**
   * Dispatches push notifications to all active push devices for a given user,
   * recording delivery attempts in the notification_deliveries table without
   * falsely claiming sent status if the provider is unavailable or fails.
   */
  async dispatchPushToUserDevices(
    db: DbConnection,
    params: DispatchPushParams
  ): Promise<{ attempted: number; sent: number; failed: number }> {
    // If user explicitly disabled push notifications, gate push dispatch without recording attempts or false failures
    if (params.pushEnabled === false) {
      return { attempted: 0, sent: 0, failed: 0 };
    }

    if (params.pushEnabled === undefined) {
      const userSettings = await db.queryOne<{ push_enabled: number }>(
        `SELECT push_enabled FROM user_notification_settings WHERE user_id = ?`,
        [params.userId]
      );
      if (userSettings && userSettings.push_enabled === 0) {
        return { attempted: 0, sent: 0, failed: 0 };
      }
    }

    const devices = await db.query<{
      id: number;
      platform: string;
      push_token: string;
    }>(
      `SELECT id, platform, push_token 
       FROM user_push_devices 
       WHERE user_id = ? AND is_active = 1 AND push_token IS NOT NULL AND push_token != ''`,
      [params.userId]
    );

    if (!devices || devices.length === 0) {
      return { attempted: 0, sent: 0, failed: 0 };
    }

    let sentCount = 0;
    let failedCount = 0;

    for (const device of devices) {
      const isAvailable = this.provider.isAvailable();
      const result = await this.provider.send({
        deviceToken: device.push_token,
        platform: device.platform,
        title: params.title,
        body: params.message,
        deepLink: params.deepLink || undefined,
        data: {
          notificationId: params.notificationId,
          category: params.category,
          ...params.metadata,
        },
      });

      if (isAvailable && result.success) {
        await db.execute(
          `INSERT INTO notification_deliveries 
           (notification_id, user_push_device_id, channel, status, provider_message_id, attempt_count, sent_at, delivered_at, created_at, updated_at)
           VALUES (?, ?, 'push', 'sent', ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          [params.notificationId, device.id, result.providerMessageId || null]
        );
        sentCount++;
        logger.info(
          {
            notificationId: params.notificationId,
            userId: params.userId,
            deviceId: device.id,
            providerMessageId: result.providerMessageId,
          },
          'Push notification successfully delivered via provider'
        );
      } else {
        const errorMsg =
          result.error ||
          (!isAvailable
            ? 'Push notification provider is unavailable'
            : 'Push delivery failed');
        await db.execute(
          `INSERT INTO notification_deliveries 
           (notification_id, user_push_device_id, channel, status, attempt_count, last_error, created_at, updated_at)
           VALUES (?, ?, 'push', 'failed', 1, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          [params.notificationId, device.id, errorMsg]
        );
        failedCount++;
        logger.warn(
          {
            notificationId: params.notificationId,
            userId: params.userId,
            deviceId: device.id,
            error: errorMsg,
          },
          'Push notification delivery recorded as failed'
        );
      }
    }

    return { attempted: devices.length, sent: sentCount, failed: failedCount };
  }
}

export const pushNotificationService = new PushNotificationService();
