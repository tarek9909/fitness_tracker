import { FastifyRequest } from 'fastify';
import { getDatabasePool } from '../../database/pool.js';
import { AuthenticatedRequest } from '../types/index.js';
import { logger } from '../../config/logger.js';

export async function recordAuditEvent(
  request: FastifyRequest,
  action: string,
  entityType: string,
  entityId: number | string | null,
  afterData?: unknown,
  beforeData?: unknown,
): Promise<void> {
  try {
    const actor = (request as AuthenticatedRequest).user;
    await getDatabasePool().execute(
      `INSERT INTO audit_logs
       (actor_user_id, action, entity_type, entity_id, before_data, after_data, ip_address, user_agent, request_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        actor?.userId || null,
        action,
        entityType,
        entityId === null ? null : String(entityId),
        beforeData === undefined ? null : JSON.stringify(beforeData),
        afterData === undefined ? null : JSON.stringify(afterData),
        request.ip || null,
        request.headers['user-agent'] || null,
        (request as AuthenticatedRequest).requestId || null,
      ],
    );
  } catch (error) {
    // Non-fatal: audit write failures must never abort successful business mutations
    logger.warn({ error, action, entityType, entityId }, 'Non-fatal: Failed to write audit log entry');
  }
}
