import crypto from 'crypto';
import { FastifyRequest } from 'fastify';
import { DatabasePool } from '../../database/types.js';
import { ConflictError, ValidationError } from '../errors/app-error.js';

export function isDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
}

export function parseDateOnly(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || !isDateOnly(value)) {
    throw new ValidationError(`Invalid ${fieldName}: must be a valid date in YYYY-MM-DD format`);
  }
  return value;
}

export function parseOptionalDateOnly(value: unknown, fieldName: string, fallback: string): string {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  if (typeof value !== 'string' || !isDateOnly(value)) {
    throw new ValidationError(`Invalid ${fieldName}: must be a valid date in YYYY-MM-DD format`);
  }
  return value;
}

export function parsePositiveInt(value: string, fieldName: string): number {
  if (!/^\d+$/.test(value)) throw new ValidationError(`Invalid ${fieldName}`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new ValidationError(`Invalid ${fieldName}`);
  }
  return parsed;
}

export function parseBoundedPositiveInt(
  value: unknown,
  fieldName: string,
  min: number,
  max: number,
  defaultValue?: number
): number {
  if (value === undefined || value === null || value === '') {
    if (defaultValue !== undefined) return defaultValue;
    throw new ValidationError(`Missing required parameter: ${fieldName}`);
  }
  const str = String(value).trim();
  if (!/^\d+$/.test(str)) {
    throw new ValidationError(`Invalid ${fieldName}: must be an integer between ${min} and ${max}`);
  }
  const parsed = Number(str);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    throw new ValidationError(`Invalid ${fieldName}: must be an integer between ${min} and ${max}`);
  }
  return parsed;
}

export interface IdempotencyReservation {
  userId: number;
  clientOperationId: string;
  requestHash: string;
  endpoint: string;
}

export interface IdempotencyReplay {
  statusCode: number;
  body: unknown;
}

function requestOperationId(request: FastifyRequest, body: unknown): string | undefined {
  const headerValue = request.headers['idempotency-key'] || request.headers['x-idempotency-key'];
  const header = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  const bodyValue = body && typeof body === 'object' && 'clientOperationId' in body
    ? (body as { clientOperationId?: unknown }).clientOperationId
    : undefined;
  const operationId = typeof bodyValue === 'string' && bodyValue.trim()
    ? bodyValue.trim()
    : typeof header === 'string' && header.trim()
      ? header.trim()
      : undefined;

  if (operationId && (operationId.length < 8 || operationId.length > 191)) {
    throw new ConflictError('Idempotency key must be between 8 and 191 characters', 'VALIDATION_ERROR');
  }
  return operationId;
}

function hashBody(body: unknown): string {
  return crypto.createHash('sha256').update(JSON.stringify(body ?? {})).digest('hex');
}

function getPortableExpiryTimestamp(days = 7): string {
  const date = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

export async function beginIdempotentRequest(
  db: DatabasePool,
  request: FastifyRequest,
  userId: number,
  body: unknown,
): Promise<{ reservation?: IdempotencyReservation; replay?: IdempotencyReplay }> {
  const clientOperationId = requestOperationId(request, body);
  if (!clientOperationId) return {};

  const requestHash = hashBody(body);
  const endpoint = request.url.split('?')[0];
  const existing = await db.queryOne<any>(
    `SELECT client_operation_id, request_hash, response_status, response_body
     FROM api_idempotency_keys
     WHERE user_id = ? AND client_operation_id = ?
       AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)`,
    [userId, clientOperationId],
  );

  if (existing) {
    if (existing.request_hash && existing.request_hash !== requestHash) {
      throw new ConflictError('Idempotency key was already used with a different request', 'IDEMPOTENCY_KEY_REUSED');
    }
    if (existing.response_status && existing.response_body) {
      return {
        replay: {
          statusCode: Number(existing.response_status),
          body: typeof existing.response_body === 'string'
            ? JSON.parse(existing.response_body)
            : existing.response_body,
        },
      };
    }
    throw new ConflictError('A request with this idempotency key is already in progress', 'IDEMPOTENCY_IN_PROGRESS');
  }

  const reservation = { userId, clientOperationId, requestHash, endpoint };
  try {
    const expiresAt = getPortableExpiryTimestamp(7);
    await db.execute(
      `INSERT INTO api_idempotency_keys
       (user_id, client_operation_id, http_method, endpoint, request_hash, expires_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, clientOperationId, request.method, endpoint, requestHash, expiresAt],
    );
  } catch (error) {
    // Another request won the insertion race. Re-read and apply identical replay/conflict semantics.
    const raced = await db.queryOne<any>(
      `SELECT request_hash, response_status, response_body
       FROM api_idempotency_keys WHERE user_id = ? AND client_operation_id = ?`,
      [userId, clientOperationId],
    );
    if (!raced) throw error;
    if (raced.request_hash && raced.request_hash !== requestHash) {
      throw new ConflictError('Idempotency key was already used with a different request', 'IDEMPOTENCY_KEY_REUSED');
    }
    if (raced.response_status && raced.response_body) {
      return {
        replay: {
          statusCode: Number(raced.response_status),
          body: typeof raced.response_body === 'string' ? JSON.parse(raced.response_body) : raced.response_body,
        },
      };
    }
    throw new ConflictError('A request with this idempotency key is already in progress', 'IDEMPOTENCY_IN_PROGRESS');
  }

  return { reservation };
}

export async function completeIdempotentRequest(
  db: { execute(sql: string, params?: any[]): Promise<any> },
  reservation: IdempotencyReservation,
  statusCode: number,
  body: unknown,
): Promise<void> {
  await db.execute(
    `UPDATE api_idempotency_keys
     SET response_status = ?, response_body = ?, completed_at = CURRENT_TIMESTAMP
     WHERE user_id = ? AND client_operation_id = ?`,
    [statusCode, JSON.stringify(body), reservation.userId, reservation.clientOperationId],
  );
}

export async function releaseIdempotentRequest(
  db: { execute(sql: string, params?: any[]): Promise<any> },
  reservation?: IdempotencyReservation,
): Promise<void> {
  if (!reservation) return;
  await db.execute(
    'DELETE FROM api_idempotency_keys WHERE user_id = ? AND client_operation_id = ? AND completed_at IS NULL',
    [reservation.userId, reservation.clientOperationId],
  );
}
