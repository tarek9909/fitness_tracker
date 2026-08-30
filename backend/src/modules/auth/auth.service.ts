import bcrypt from 'bcryptjs';
import { AuthRepository } from './auth.repository.js';
import { UnauthorizedError, ForbiddenError, ValidationError } from '../../shared/errors/app-error.js';
import { generateSecureToken, hashToken, signAccessToken } from '../../shared/utils/crypto-utils.js';
import { env } from '../../config/env.js';
import { UserAuthPayload } from '../../shared/types/index.js';
import { getDatabasePool } from '../../database/pool.js';
import { emailService } from '../../shared/services/email.service.js';

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

// In-memory test token delivery container (used strictly during automated tests)
export const testResetTokenStore = new Map<string, string>();

export class AuthService {
  private repo = new AuthRepository();
  private db = getDatabasePool();

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

    const payload: UserAuthPayload = {
      userId: user.id,
      roleId: user.role_id,
      roleName: user.role_name,
      email: user.email,
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

  async requestPasswordReset(email: string): Promise<void> {
    if (env.emailProvider === 'none') {
      throw new ValidationError('Password reset email delivery provider is not configured on this environment.');
    }

    const user = await this.repo.findUserByEmail(email);
    // Keep this endpoint enumeration-resistant
    if (!user) return;

    const rawToken = generateSecureToken();
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await this.repo.createPasswordResetToken(user.id, tokenHash, expiresAt);

    if (env.emailProvider === 'mock' || env.nodeEnv === 'test') {
      testResetTokenStore.set(user.email.toLowerCase(), rawToken);
    }

    try {
      await emailService.sendPasswordResetEmail(user.email, rawToken);
    } catch (error) {
      // Cleanly remove the token so no unusable token remains in the database
      await this.db.execute('DELETE FROM password_reset_tokens WHERE token_hash = ?', [tokenHash]);
      if (env.emailProvider === 'mock' || env.nodeEnv === 'test') {
        testResetTokenStore.delete(user.email.toLowerCase());
      }
      throw error;
    }
  }

  async resetPassword(rawToken: string, password: string): Promise<void> {
    const passwordHash = await bcrypt.hash(password, 12);
    const updated = await this.repo.resetPassword(hashToken(rawToken), passwordHash);
    if (!updated) throw new UnauthorizedError('Password reset token is invalid or expired', 'PASSWORD_RESET_INVALID');
  }
}
