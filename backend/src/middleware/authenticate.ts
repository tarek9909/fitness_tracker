import { FastifyRequest, FastifyReply } from 'fastify';
import { UnauthorizedError, ForbiddenError } from '../shared/errors/app-error.js';
import { verifyAccessToken } from '../shared/utils/crypto-utils.js';
import { getDatabasePool } from '../database/pool.js';

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;
  let token: string | undefined;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if ((request as any).cookies?.access_token) {
    token = (request as any).cookies.access_token;
  }

  if (!token) {
    throw new UnauthorizedError('Missing authentication credentials (header or cookie)');
  }
  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch (error) {
    throw new UnauthorizedError('Token is invalid or expired', 'TOKEN_EXPIRED');
  }

  const db = getDatabasePool();
  const user = await db.queryOne<{ id: number; status: string; role_id: number; role_name?: string; security_version?: number }>(
    `SELECT u.id, u.status, u.role_id, u.security_version, r.name as role_name
     FROM users u
     LEFT JOIN roles r ON r.id = u.role_id
     WHERE u.id = ?`,
    [payload.userId]
  );

  if (!user) {
    throw new UnauthorizedError('User account not found', 'USER_NOT_FOUND');
  }

  if (user.status !== 'active') {
    throw new ForbiddenError('User account is disabled or inactive', 'ACCOUNT_DISABLED');
  }

  if (
    payload.securityVersion !== undefined &&
    user.security_version !== undefined &&
    payload.securityVersion !== user.security_version
  ) {
    throw new UnauthorizedError('Authentication session invalidated due to security credentials update', 'SESSION_REVOKED');
  }

  (request as any).user = {
    ...payload,
    roleId: user.role_id,
    securityVersion: user.security_version ?? 1,
    // The database is authoritative; do not retain a privileged role from a stale token.
    roleName: user.role_name ?? 'user',
  };
}
