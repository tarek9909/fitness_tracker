import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { UserAuthPayload } from '../types/index.js';

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function generateSecureToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function signAccessToken(payload: UserAuthPayload): string {
  return jwt.sign(payload, env.accessTokenSecret, {
    expiresIn: env.accessTokenTtlSeconds,
  });
}

export function verifyAccessToken(token: string): UserAuthPayload {
  return jwt.verify(token, env.accessTokenSecret) as UserAuthPayload;
}
