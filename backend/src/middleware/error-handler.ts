import { FastifyError, FastifyRequest, FastifyReply } from 'fastify';
import { AppError } from '../shared/errors/app-error.js';
import { logger } from '../config/logger.js';
import { ZodError } from 'zod';

export function errorHandler(error: FastifyError | AppError | Error, request: FastifyRequest, reply: FastifyReply) {
  const reqId = (request as any).requestId || 'unknown';

  if (error instanceof AppError) {
    logger.warn({
      requestId: reqId,
      code: error.code,
      message: error.message,
      statusCode: error.statusCode,
      details: error.details,
    }, 'Handled application error');

    return reply.status(error.statusCode).send({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    });
  }

  if (error instanceof ZodError) {
    const details = error.errors.map(e => ({
      path: e.path.join('.'),
      message: e.message,
    }));

    logger.warn({ requestId: reqId, details }, 'Request validation error');

    return reply.status(400).send({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details,
      },
    });
  }

  // Handle Fastify built-in client errors (e.g., 413 Payload Too Large, 429 Too Many Requests, 400 Bad Request)
  const statusCode = (error as any).statusCode;
  if (typeof statusCode === 'number' && statusCode >= 400 && statusCode < 500) {
    const errorCode = (error as any).code || (statusCode === 429 ? 'RATE_LIMIT_EXCEEDED' : 'CLIENT_ERROR');
    logger.warn({
      requestId: reqId,
      code: errorCode,
      message: error.message,
      statusCode,
    }, 'Handled client error');

    return reply.status(statusCode).send({
      success: false,
      error: {
        code: errorCode,
        message: error.message,
      },
    });
  }

  // Generic unhandled exceptions
  logger.error({
    requestId: reqId,
    err: error,
    stack: error.stack,
    url: request.raw.url,
    method: request.raw.method,
  }, 'Unhandled internal server error');

  return reply.status(500).send({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected internal error occurred',
    },
  });
}
