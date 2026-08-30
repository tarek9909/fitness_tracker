import pino from 'pino';
import { env } from './env.js';

export const logger = pino({
  level: env.logLevel,
  transport:
    env.nodeEnv === 'development'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
  formatters: {
    level(label) {
      return { level: label };
    },
  },
  redact: [
    'req.headers.authorization',
    'req.headers.cookie',
    'req.headers["set-cookie"]',
    'password',
    'passwordHash',
    'password_hash',
    'token',
    'refreshToken',
    'tokenHash',
    'pushToken',
    'secret',
    'apiKey',
    'smtpPassword',
    'databasePassword',
  ],
});
