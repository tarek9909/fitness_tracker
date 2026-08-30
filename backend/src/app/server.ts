import { buildApp } from './app.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { runMigrations } from '../database/migrate.js';
import { seedDatabase } from '../database/seed.js';
import { getDatabasePool } from '../database/pool.js';

async function startServer() {
  try {
    logger.info('Initializing fitness tracking backend server...');

    // Production may migrate an existing database, but must never seed demo
    // users, credentials, or sample plans.
    if (env.nodeEnv === 'production') {
      await runMigrations();
    } else {
      await seedDatabase();
    }

    const app = await buildApp();

    await app.listen({ port: env.appPort, host: env.appHost });
    logger.info(`REST API Server listening on http://${env.appHost}:${env.appPort}/api/v1`);

    // Graceful Shutdown handling
    const shutdown = async (signal: string) => {
      logger.info({ signal }, 'Received termination signal, starting graceful shutdown...');
      try {
        await app.close();
        const db = getDatabasePool();
        await db.close();
        logger.info('Graceful shutdown completed successfully');
        process.exit(0);
      } catch (err) {
        logger.error({ err }, 'Error during shutdown');
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    logger.fatal({ error }, 'Fatal error during server startup');
    process.exit(1);
  }
}

if (process.argv[1]?.includes('server') || !process.env.VITEST) {
  startServer();
}
