import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { AuthRepository } from './auth.repository.js';
import { env } from '../../config/env.js';
import { getDatabasePool } from '../../database/pool.js';
import { signAccessToken, generateSecureToken, hashToken } from '../../shared/utils/crypto-utils.js';
import { UserAuthPayload } from '../../shared/types/index.js';
import { UnauthorizedError, ForbiddenError, AppError, ConflictError } from '../../shared/errors/app-error.js';
import { otpService } from '../../shared/services/otp.service.js';
import { logger } from '../../config/logger.js';
import { UsersRepository } from '../users/users.repository.js';

export interface LoginResult {
  user: {
    id: number;
    role: string;
    firstName: string;
    lastName: string | null;
    email: string;
    timezone: string;
    locale: string;
  };
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
}

export interface RegisterData {
  firstName: string;
  lastName?: string;
  email: string;
  password: string;
  phone?: string;
  gender?: string;
  heightCm?: number;
  timezone?: string;
  locale?: string;
  deviceName?: string;
  ipAddress?: string;
  userAgent?: string;
}

// In-memory test token delivery container (used strictly during automated tests)
export class AuthService {
  private repo = new AuthRepository();
  private usersRepo = new UsersRepository();
  private db = getDatabasePool();

  async register(data: RegisterData): Promise<LoginResult> {
    const normalizedEmail = data.email.toLowerCase().trim();
    const existing = await this.repo.findUserByEmail(normalizedEmail);
    if (existing) {
      throw new ConflictError('Email already in use', 'EMAIL_ALREADY_EXISTS');
    }

    const passwordHash = await bcrypt.hash(data.password, 10);
    const userId = await this.usersRepo.createUser({
      role_id: 3, // Standard user role
      first_name: data.firstName.trim(),
      last_name: data.lastName?.trim() || null,
      email: normalizedEmail,
      password_hash: passwordHash,
      phone: data.phone?.trim() || null,
      height_cm: data.heightCm,
      gender: data.gender || null,
      timezone: data.timezone || 'UTC',
      locale: data.locale || 'en',
    });

    const user = await this.repo.findUserById(userId);
    if (!user) {
      throw new AppError('Failed to initialize user session after registration', 500);
    }

    return this.issueSession(user, data.deviceName, data.ipAddress, data.userAgent);
  }

  async login(email: string, password: string, deviceName?: string, ipAddress?: string, userAgent?: string): Promise<LoginResult> {
    const user = await this.repo.findUserByEmail(email);
    if (!user) {
      throw new UnauthorizedError('Invalid email or password', 'INVALID_CREDENTIALS');
    }

    if (user.status !== 'active') {
      throw new ForbiddenError('Account is disabled or inactive', 'ACCOUNT_DISABLED');
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      throw new UnauthorizedError('Invalid email or password', 'INVALID_CREDENTIALS');
    }

    return this.issueSession(user, deviceName, ipAddress, userAgent);
  }

  async issueSession(user: any, deviceName?: string, ipAddress?: string, userAgent?: string): Promise<LoginResult> {
    const payload: UserAuthPayload = {
      userId: user.id,
      roleId: user.role_id,
      roleName: user.role_name,
      email: user.email,
      securityVersion: user.security_version ?? 1,
    };

    const accessToken = signAccessToken(payload);
    const rawRefreshToken = generateSecureToken();
    const hashed = hashToken(rawRefreshToken);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + env.refreshTokenTtlDays);

    await this.repo.storeRefreshToken(user.id, hashed, expiresAt, deviceName, ipAddress, userAgent);
    await this.repo.updateLastLogin(user.id);

    return {
      user: {
        id: user.id,
        role: user.role_name,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        timezone: user.timezone,
        locale: user.locale,
      },
      accessToken,
      refreshToken: rawRefreshToken,
      expiresInSeconds: env.accessTokenTtlSeconds,
    };
  }

  async refreshToken(rawRefreshToken: string, ipAddress?: string, userAgent?: string): Promise<{ accessToken: string; refreshToken: string; expiresInSeconds: number }> {
    const hashed = hashToken(rawRefreshToken);

    return this.db.withTransaction(async (conn) => {
      // Find token record
      const tokenRecord = await conn.queryOne<any>(
        'SELECT * FROM user_refresh_tokens WHERE token_hash = ?',
        [hashed]
      );

      if (!tokenRecord || tokenRecord.revoked_at) {
        throw new UnauthorizedError('Refresh token is invalid or has been revoked', 'REFRESH_TOKEN_INVALID');
      }

      if (new Date(tokenRecord.expires_at) < new Date()) {
        throw new UnauthorizedError('Refresh token has expired', 'REFRESH_TOKEN_EXPIRED');
      }

      // Atomically revoke old token with conditional check
      const revokeRes = await conn.execute(
        'UPDATE user_refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE id = ? AND revoked_at IS NULL',
        [tokenRecord.id]
      );

      if (revokeRes.affectedRows === 0) {
        throw new UnauthorizedError('Refresh token was already rotated or revoked', 'REFRESH_TOKEN_INVALID');
      }

      // Re-verify user is still active
      const user = await conn.queryOne<any>(
        `SELECT u.*, r.name as role_name 
         FROM users u
         JOIN roles r ON r.id = u.role_id
         WHERE u.id = ?`,
        [tokenRecord.user_id]
      );

      if (!user || user.status !== 'active') {
        throw new UnauthorizedError('User account is invalid or inactive', 'ACCOUNT_DISABLED');
      }

      // Rotate to new token
      const newRawRefreshToken = generateSecureToken();
      const newHashed = hashToken(newRawRefreshToken);

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + env.refreshTokenTtlDays);

      await conn.execute(
        `INSERT INTO user_refresh_tokens (user_id, token_hash, device_name, ip_address, user_agent, expires_at, rotated_from_token_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          user.id,
          newHashed,
          tokenRecord.device_name || null,
          ipAddress || null,
          userAgent || null,
          expiresAt.toISOString().slice(0, 19).replace('T', ' '),
          tokenRecord.id,
        ]
      );

      const payload: UserAuthPayload = {
        userId: user.id,
        roleId: user.role_id,
        roleName: user.role_name,
        email: user.email,
        securityVersion: user.security_version ?? 1,
      };

      const accessToken = signAccessToken(payload);

      return {
        accessToken,
        refreshToken: newRawRefreshToken,
        expiresInSeconds: env.accessTokenTtlSeconds,
      };
    });
  }

  async logout(rawRefreshToken?: string): Promise<void> {
    if (rawRefreshToken) {
      const hashed = hashToken(rawRefreshToken);
      const tokenRecord = await this.repo.findRefreshToken(hashed);
      if (tokenRecord) {
        await this.repo.revokeRefreshToken(tokenRecord.id);
      }
    }
  }

  // --- OTP Self-Service Security Flows ---

  async requestPasswordResetOtp(email: string): Promise<{ challengeId: string }> {
    const user = await this.repo.findUserByEmail(email);
    if (!user) {
      // Enumeration-resistant: return random UUID without revealing lack of account
      return { challengeId: crypto.randomUUID() };
    }
    const { challengeId } = await otpService.createChallenge({
      userId: user.id,
      purpose: 'password_reset',
      destinationEmail: user.email,
      expiryMinutes: 15,
    });
    return { challengeId };
  }

  async verifyPasswordResetOtp(challengeId: string, otp: string, newPassword: string): Promise<void> {
    const verification = await otpService.verifyChallenge({
      challengeId,
      purpose: 'password_reset',
      otp,
    });
    if (!verification.userId) {
      throw new UnauthorizedError('Invalid password reset challenge', 'PASSWORD_RESET_INVALID');
    }
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.db.withTransaction(async (conn) => {
      await conn.execute(
        `UPDATE users
         SET password_hash = ?, security_version = security_version + 1, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [passwordHash, verification.userId]
      );
      await conn.execute(
        `UPDATE user_refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = ? AND revoked_at IS NULL`,
        [verification.userId]
      );
    });
  }

  async requestPasswordChangeOtp(userId: number): Promise<{ challengeId: string }> {
    const user = await this.repo.findUserById(userId);
    if (!user) {
      throw new UnauthorizedError('User not found', 'USER_NOT_FOUND');
    }
    const { challengeId } = await otpService.createChallenge({
      userId: user.id,
      purpose: 'password_change',
      destinationEmail: user.email,
      expiryMinutes: 10,
    });
    return { challengeId };
  }

  async verifyPasswordChangeOtp(
    userId: number,
    challengeId: string,
    otp: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    const user = await this.repo.findUserById(userId);
    if (!user) {
      throw new UnauthorizedError('User not found', 'USER_NOT_FOUND');
    }
    const isValid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isValid) {
      throw new UnauthorizedError('Current password is incorrect', 'INVALID_CREDENTIALS');
    }
    await otpService.verifyChallenge({
      challengeId,
      purpose: 'password_change',
      otp,
      expectedUserId: userId,
    });
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.db.withTransaction(async (conn) => {
      await conn.execute(
        `UPDATE users
         SET password_hash = ?, security_version = security_version + 1, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [passwordHash, userId]
      );
      await conn.execute(
        `UPDATE user_refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = ? AND revoked_at IS NULL`,
        [userId]
      );
    });
  }

  async requestEmailChange(
    userId: number,
    newEmailRaw: string
  ): Promise<{ currentEmailChallengeId: string; newEmailChallengeId: string }> {
    const newEmail = newEmailRaw.trim().toLowerCase();
    const user = await this.repo.findUserById(userId);
    if (!user) {
      throw new UnauthorizedError('User not found', 'USER_NOT_FOUND');
    }
    if (user.email.toLowerCase() === newEmail) {
      throw new AppError('New email address must be different from current email', 400, 'INVALID_EMAIL');
    }
    const existing = await this.repo.findUserByEmail(newEmail);
    if (existing) {
      throw new AppError('This email address is already in use by another account', 409, 'EMAIL_ALREADY_EXISTS');
    }
    await this.db.execute(
      `UPDATE user_email_change_requests SET status = 'cancelled' WHERE user_id = ? AND status = 'pending'`,
      [userId]
    );
    const curChallenge = await otpService.createChallenge({
      userId,
      purpose: 'email_change_current',
      destinationEmail: user.email,
      expiryMinutes: 15,
    });
    const newChallenge = await otpService.createChallenge({
      userId,
      purpose: 'email_change_new',
      destinationEmail: newEmail,
      expiryMinutes: 15,
    });
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await this.db.execute(
      `INSERT INTO user_email_change_requests (
        user_id, new_email, current_email_challenge_id, new_email_challenge_id,
        status, expires_at, created_at
      ) VALUES (?, ?, ?, ?, 'pending', ?, CURRENT_TIMESTAMP)`,
      [userId, newEmail, curChallenge.challengeId, newChallenge.challengeId, expiresAt]
    );
    return {
      currentEmailChallengeId: curChallenge.challengeId,
      newEmailChallengeId: newChallenge.challengeId,
    };
  }

  async verifyEmailChange(
    userId: number,
    currentEmailOtp: string,
    newEmailOtp: string,
    password: string
  ): Promise<{ email: string }> {
    const user = await this.repo.findUserById(userId);
    if (!user) {
      throw new UnauthorizedError('User not found', 'USER_NOT_FOUND');
    }
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      throw new UnauthorizedError('Invalid password confirmation', 'INVALID_CREDENTIALS');
    }
    const pendingReq = await this.db.queryOne<any>(
      `SELECT * FROM user_email_change_requests 
       WHERE user_id = ? AND status = 'pending' 
       ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );
    if (!pendingReq) {
      throw new AppError('No pending email change request found', 400, 'REQUEST_NOT_FOUND');
    }
    if (new Date(pendingReq.expires_at).getTime() < Date.now()) {
      await this.db.execute(`UPDATE user_email_change_requests SET status = 'expired' WHERE id = ?`, [pendingReq.id]);
      throw new AppError('Email change request has expired. Please submit a new request.', 400, 'REQUEST_EXPIRED');
    }
    await otpService.verifyChallenge({
      challengeId: pendingReq.current_email_challenge_id,
      purpose: 'email_change_current',
      otp: currentEmailOtp,
      expectedUserId: userId,
    });
    await otpService.verifyChallenge({
      challengeId: pendingReq.new_email_challenge_id,
      purpose: 'email_change_new',
      otp: newEmailOtp,
      expectedUserId: userId,
    });
    const existing = await this.repo.findUserByEmail(pendingReq.new_email);
    if (existing && existing.id !== userId) {
      throw new AppError('This email address is already in use by another account', 409, 'EMAIL_ALREADY_EXISTS');
    }
    await this.db.withTransaction(async (conn) => {
      await conn.execute(
        `UPDATE users
         SET email = ?, email_verified_at = CURRENT_TIMESTAMP, security_version = security_version + 1, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [pendingReq.new_email, userId]
      );
      await conn.execute(
        `UPDATE user_email_change_requests SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [pendingReq.id]
      );
      await conn.execute(
        `UPDATE user_refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = ? AND revoked_at IS NULL`,
        [userId]
      );
    });
    return { email: pendingReq.new_email };
  }
}
