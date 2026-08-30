import { getDatabasePool } from '../../database/pool.js';

export interface UserEntity {
  id: number;
  role_id: number;
  role_name: string;
  first_name: string;
  last_name: string | null;
  email: string;
  password_hash: string;
  height_cm: number | null;
  timezone: string;
  locale: string;
  status: string;
}

export class AuthRepository {
  private db = getDatabasePool();

  async findUserByEmail(email: string): Promise<UserEntity | null> {
    const sql = `
      SELECT u.*, r.name as role_name 
      FROM users u
      JOIN roles r ON r.id = u.role_id
      WHERE u.email = ?
    `;
    return this.db.queryOne<UserEntity>(sql, [email.toLowerCase().trim()]);
  }

  async findUserById(userId: number): Promise<UserEntity | null> {
    const sql = `
      SELECT u.*, r.name as role_name 
      FROM users u
      JOIN roles r ON r.id = u.role_id
      WHERE u.id = ?
    `;
    return this.db.queryOne<UserEntity>(sql, [userId]);
  }

  async storeRefreshToken(
    userId: number,
    tokenHash: string,
    expiresAt: Date,
    deviceName?: string,
    ipAddress?: string,
    userAgent?: string,
    rotatedFromId?: number
  ): Promise<number> {
    const sql = `
      INSERT INTO user_refresh_tokens (user_id, token_hash, device_name, ip_address, user_agent, expires_at, rotated_from_token_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    const res = await this.db.execute(sql, [
      userId,
      tokenHash,
      deviceName || null,
      ipAddress || null,
      userAgent || null,
      expiresAt.toISOString(),
      rotatedFromId || null,
    ]);
    return res.insertId;
  }

  async findRefreshToken(tokenHash: string): Promise<any | null> {
    const sql = `
      SELECT * FROM user_refresh_tokens 
      WHERE token_hash = ?
    `;
    return this.db.queryOne(sql, [tokenHash]);
  }

  async revokeRefreshToken(id: number): Promise<void> {
    const sql = `
      UPDATE user_refresh_tokens 
      SET revoked_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `;
    await this.db.execute(sql, [id]);
  }

  async updateLastLogin(userId: number): Promise<void> {
    const sql = `
      UPDATE users 
      SET last_login_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `;
    await this.db.execute(sql, [userId]);
  }

  async createPasswordResetToken(userId: number, tokenHash: string, expiresAt: Date): Promise<void> {
    const expiresAtStr = expiresAt.toISOString().slice(0, 19).replace('T', ' ');
    await this.db.execute(
      'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
      [userId, tokenHash, expiresAtStr]
    );
  }

  async resetPassword(tokenHash: string, newPasswordHash: string): Promise<boolean> {
    return this.db.withTransaction(async (conn) => {
      const nowStr = new Date().toISOString().slice(0, 19).replace('T', ' ');
      const token = await conn.queryOne<{ id: number; user_id: number; expires_at: string; used_at: string | null }>(
        'SELECT * FROM password_reset_tokens WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?',
        [tokenHash, nowStr]
      );
      if (!token) return false;

      await conn.execute(
        'UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE id = ?',
        [token.id]
      );
      await conn.execute(
        'UPDATE users SET password_hash = ? WHERE id = ?',
        [newPasswordHash, token.user_id]
      );
      return true;
    });
  }
}

