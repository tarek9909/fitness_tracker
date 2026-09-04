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
  security_version?: number;
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
      expiresAt.toISOString().slice(0, 19).replace('T', ' '),
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

}

