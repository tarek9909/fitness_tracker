export interface PushMessagePayload {
  deviceToken: string;
  platform: 'ios' | 'android' | 'web' | string;
  title: string;
  body: string;
  data?: Record<string, any>;
  deepLink?: string;
}

export interface PushDeliveryResult {
  success: boolean;
  providerMessageId?: string;
  error?: string;
  deliveredAt?: Date;
}

export interface PushProvider {
  readonly providerName: string;
  isAvailable(): boolean;
  send(payload: PushMessagePayload): Promise<PushDeliveryResult>;
  sendBatch?(payloads: PushMessagePayload[]): Promise<PushDeliveryResult[]>;
}

export interface SentPushNotificationRecord {
  deviceToken: string;
  platform: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  deepLink?: string;
  providerMessageId: string;
  sentAt: Date;
}

export const testSentPushNotifications: SentPushNotificationRecord[] = [];

/**
 * MockPushProvider: config-driven, mock-safe provider requiring no external APNs/FCM credentials.
 * Captures outgoing push notifications in-memory for testing and local development.
 */
export class MockPushProvider implements PushProvider {
  readonly providerName = 'mock';

  isAvailable(): boolean {
    return true;
  }

  async send(payload: PushMessagePayload): Promise<PushDeliveryResult> {
    const providerMessageId = `mock-push-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const deliveredAt = new Date();

    testSentPushNotifications.push({
      deviceToken: payload.deviceToken,
      platform: payload.platform,
      title: payload.title,
      body: payload.body,
      data: payload.data,
      deepLink: payload.deepLink,
      providerMessageId,
      sentAt: deliveredAt,
    });

    return {
      success: true,
      providerMessageId,
      deliveredAt,
    };
  }

  async sendBatch(payloads: PushMessagePayload[]): Promise<PushDeliveryResult[]> {
    return Promise.all(payloads.map((p) => this.send(p)));
  }
}

/**
 * UnavailablePushProvider: fails closed without claiming sent status when external provider is unconfigured.
 */
export class UnavailablePushProvider implements PushProvider {
  readonly providerName: string;
  private reason: string;

  constructor(providerName = 'none', reason = 'Push notification provider is not configured or unavailable.') {
    this.providerName = providerName;
    this.reason = reason;
  }

  isAvailable(): boolean {
    return false;
  }

  async send(_payload: PushMessagePayload): Promise<PushDeliveryResult> {
    return {
      success: false,
      error: this.reason,
    };
  }

  async sendBatch(payloads: PushMessagePayload[]): Promise<PushDeliveryResult[]> {
    return payloads.map(() => ({
      success: false,
      error: this.reason,
    }));
  }
}
