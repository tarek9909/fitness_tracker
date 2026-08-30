import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import cookie from '@fastify/cookie';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { requestIdMiddleware } from '../middleware/request-id.js';
import { errorHandler } from '../middleware/error-handler.js';
import { csrfProtection } from '../middleware/csrf.js';
import { registerApiRoutes } from './routes.js';

export interface BuildAppOptions {
  rateLimitMax?: number;
  bodyLimit?: number;
}

export async function buildApp(options?: BuildAppOptions): Promise<FastifyInstance> {
  const app = Fastify({
    logger: false, // Pino structured logger is used via custom logging hooks
    trustProxy: env.trustProxy,
    disableRequestLogging: true,
    bodyLimit: options?.bodyLimit ?? 1048576, // 1 MiB bounded request body limit for DoS protection
  });

  // Global Middlewares & Plugins
  await app.register(cors, {
    origin: env.adminAllowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  await app.register(cookie, {
    secret: env.cookieSecret,
    hook: 'onRequest',
  });

  await app.register(rateLimit, {
    max: options?.rateLimitMax ?? env.rateLimitMax,
    timeWindow: '1 minute',
    allowList: (req) => {
      // Health and probe endpoints are exempt from rate limiting for container liveness/readiness probes
      const url = req.url || '';
      return url === '/api/v1/health' || url.startsWith('/api/v1/health/');
    },
  });

  // Request ID
  app.addHook('onRequest', requestIdMiddleware);
  app.addHook('preHandler', csrfProtection);

  // Structured Request Logger
  app.addHook('onRequest', async (request) => {
    logger.info({
      requestId: (request as any).requestId,
      method: request.method,
      url: request.url,
      ip: request.ip,
    }, 'Incoming request');
  });

  app.addHook('onResponse', async (request, reply) => {
    logger.info({
      requestId: (request as any).requestId,
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      responseTime: reply.elapsedTime,
    }, 'Request completed');
  });

  // Global Error Handler
  app.setErrorHandler(errorHandler);

  // Register API routes under /api/v1
  await app.register(registerApiRoutes, { prefix: '/api/v1' });

  return app;
}
