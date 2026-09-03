import crypto from 'node:crypto';
import { v4 as uuidv4 } from 'uuid';
import { getDatabasePool } from '../../database/pool.js';
import { AppError } from '../errors/app-error.js';
import { emailService } from './email.service.js';
import { logger } from '../../config/logger.js';

export type OtpPurpose =
  | 'password_reset'
  | 'password_change'
  | 'email_change_current'
  | 'email_change_new';

export interface OtpChallengeRecord {
  id: string;
  user_id: number | null;
  purpose: OtpPurpose;
  destination_email: string;
  otp_hash: string;
  expires_at: string | Date;
  consumed_at: string | Date | null;
  failed_attempts: number;
  max_attempts: number;
  last_sent_at: string | Date;
  created_at: string | Date;
}

function hashOtp(otp: string): string {
  return crypto.createHash('sha256').update(otp.trim()).digest('hex');
}

export class OtpService {
  /**
   * Generates a 6-digit numeric OTP and creates an auth_otp_challenges record,
   * then dispatches it via email.
   */
  async createChallenge(options: {
    userId?: number | null;
    purpose: OtpPurpose;
    destinationEmail: string;
    expiryMinutes?: number;
  }): Promise<{ challengeId: string; expiresAt: Date }> {
    const { userId = null, purpose, destinationEmail, expiryMinutes = 10 } = options;
    const db = getDatabasePool();

    // Check resend rate-limit (minimum 60s cooldown between codes to the same email & purpose)
    const recent = await db.queryOne<{ id: string; last_sent_at: string }>(
      `SELECT id, last_sent_at FROM auth_otp_challenges 
       WHERE destination_email = ? AND purpose = ? AND consumed_at IS NULL 
       ORDER BY created_at DESC LIMIT 1`,
      [destinationEmail.toLowerCase().trim(), purpose]
    );

    if (recent) {
      const lastSentTime = new Date(recent.last_sent_at).getTime();
      const elapsedSeconds = (Date.now() - lastSentTime) / 1000;
      if (elapsedSeconds < 60) {
        const retryAfter = Math.ceil(60 - elapsedSeconds);
        throw new AppError(
          `Please wait ${retryAfter} seconds before requesting another code.`,
          429,
          'RATE_LIMIT_EXCEEDED'
        );
      }
    }

    // Generate cryptographically secure 6-digit OTP
    const otp = crypto.randomInt(100000, 1000000).toString();
    const otpHash = hashOtp(otp);
    const challengeId = uuidv4();
    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

    await db.execute(
      `INSERT INTO auth_otp_challenges (
        id, user_id, purpose, destination_email, otp_hash, expires_at,
        consumed_at, failed_attempts, max_attempts, last_sent_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, NULL, 0, 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [challengeId, userId, purpose, destinationEmail.toLowerCase().trim(), otpHash, expiresAt]
    );

    logger.info(
      { challengeId, purpose, recipient: destinationEmail },
      'Generated OTP challenge, dispatching notification email'
    );

    await emailService.sendOtpEmail({
      to: destinationEmail.toLowerCase().trim(),
      purpose,
      otp,
      expiryMinutes,
    });

    return { challengeId, expiresAt };
  }

  /**
   * Verifies an OTP against a challenge.
   * If valid, marks the challenge as consumed and returns challenge metadata.
   */
  async verifyChallenge(options: {
    challengeId: string;
    purpose: OtpPurpose;
    otp: string;
  }): Promise<{ valid: boolean; userId: number | null; destinationEmail: string }> {
    const { challengeId, purpose, otp } = options;
    const db = getDatabasePool();

    const challenge = await db.queryOne<OtpChallengeRecord>(
      `SELECT * FROM auth_otp_challenges WHERE id = ? AND purpose = ?`,
      [challengeId, purpose]
    );

    if (!challenge) {
      throw new AppError('Verification challenge not found or invalid.', 400, 'OTP_NOT_FOUND');
    }

    if (challenge.consumed_at !== null) {
      throw new AppError('This verification code has already been used.', 400, 'OTP_ALREADY_USED');
    }

    const expiresTime = new Date(challenge.expires_at).getTime();
    if (Date.now() > expiresTime) {
      throw new AppError('This verification code has expired. Please request a new one.', 400, 'OTP_EXPIRED');
    }

    if (challenge.failed_attempts >= challenge.max_attempts) {
      throw new AppError(
        'Maximum verification attempts exceeded. Please request a new code.',
        429,
        'OTP_MAX_ATTEMPTS_EXCEEDED'
      );
    }

    const incomingHash = hashOtp(otp);
    const incomingBuf = Buffer.from(incomingHash, 'utf8');
    const targetBuf = Buffer.from(challenge.otp_hash, 'utf8');

    const isValid =
      incomingBuf.length === targetBuf.length &&
      crypto.timingSafeEqual(incomingBuf, targetBuf);

    if (!isValid) {
      const nextAttempts = challenge.failed_attempts + 1;
      await db.execute(
        `UPDATE auth_otp_challenges SET failed_attempts = ? WHERE id = ?`,
        [nextAttempts, challengeId]
      );
      const remaining = challenge.max_attempts - nextAttempts;
      throw new AppError(
        `Invalid verification code. ${remaining > 0 ? `${remaining} attempt(s) remaining.` : 'Code locked.'}`,
        400,
        'OTP_INVALID'
      );
    }

    // Mark as consumed
    await db.execute(
      `UPDATE auth_otp_challenges SET consumed_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [challengeId]
    );

    logger.info(
      { challengeId, purpose, recipient: challenge.destination_email },
      'Successfully verified OTP challenge'
    );

    return {
      valid: true,
      userId: challenge.user_id,
      destinationEmail: challenge.destination_email,
    };
  }
}

export const otpService = new OtpService();
