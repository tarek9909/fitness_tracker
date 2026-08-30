import { FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'crypto';
import { ForbiddenError } from '../shared/errors/app-error.js';
import { env } from '../config/env.js';

export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function setCsrfCookie(reply: FastifyReply, token: string): void {
  reply.setCookie('csrf_token', token, {
    path: '/',
    httpOnly: false, // Must be readable by JavaScript client to supply in X-CSRF-Token header
    secure: env.nodeEnv === 'production',
    sameSite: env.cookieSameSite,
  });
}

export async function csrfProtection(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const method = request.method.toUpperCase();
  // Safe HTTP methods do not mutate state
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    return;
  }

  const authHeader = request.headers.authorization;
  // If explicitly authenticated via Bearer token in Authorization header, ambient cookie CSRF is not applicable
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return;
  }

  // Only enforce CSRF when ambient cookie session credentials are present
  const cookies = (request as any).cookies || {};
  const hasSessionCookie = Boolean(cookies.access_token || cookies.refresh_token);
  if (!hasSessionCookie) {
    return;
  }

  const cookieToken = cookies.csrf_token;
  const headerToken = request.headers['x-csrf-token'] as string | undefined;

  if (!cookieToken || !headerToken) {
    throw new ForbiddenError('Missing CSRF protection token for cookie-authenticated session', 'CSRF_TOKEN_MISSING');
  }

  if (cookieToken !== headerToken) {
    throw new ForbiddenError('Invalid CSRF protection token', 'CSRF_TOKEN_INVALID');
  }
}
