import { FastifyInstance } from 'fastify';
import { authRoutes } from '../modules/auth/auth.routes.js';
import { usersRoutes } from '../modules/users/users.routes.js';
import { exercisesRoutes } from '../modules/exercises/exercises.routes.js';
import { workoutPlansRoutes } from '../modules/workout-plans/workout-plan.routes.js';
import { dietPlansRoutes } from '../modules/diet-plans/diet-plan.routes.js';
import { foodsRoutes } from '../modules/foods/foods.routes.js';
import { assignmentRoutes } from '../modules/assignments/assignment.routes.js';
import { goalsRoutes } from '../modules/goals/goals.routes.js';
import { dailyPlanRoutes } from '../modules/daily-plan/daily-plan.routes.js';
import { weightRoutes } from '../modules/weight/weight.routes.js';
import { waterRoutes } from '../modules/water/water.routes.js';
import { mealsRoutes } from '../modules/meals/meals.routes.js';
import { workoutSessionRoutes } from '../modules/workout-sessions/workout-session.routes.js';
import { cardioRoutes } from '../modules/cardio/cardio.routes.js';
import { progressRoutes } from '../modules/progress/progress.routes.js';
import { analyticsRoutes } from '../modules/analytics/analytics.routes.js';
import { notificationsRoutes } from '../modules/notifications/notifications.routes.js';
import { settingsRoutes } from '../modules/settings/settings.routes.js';
import { getDatabasePool } from '../database/pool.js';

export async function registerApiRoutes(fastify: FastifyInstance) {
  // System Health, Liveness & Readiness Probes
  fastify.get('/health', async (req, res) => {
    const db = getDatabasePool();
    const dbOk = await db.healthCheck();
    const statusCode = dbOk ? 200 : 503;
    return res.status(statusCode).send({
      success: dbOk,
      data: {
        status: dbOk ? 'ok' : 'degraded',
        timestamp: new Date().toISOString(),
        database: dbOk ? 'connected' : 'unreachable',
      },
    });
  });

  fastify.get('/health/live', async (req, res) => {
    return res.status(200).send({
      success: true,
      data: {
        status: 'alive',
        timestamp: new Date().toISOString(),
        uptimeSeconds: Math.floor(process.uptime()),
      },
    });
  });

  fastify.get('/health/ready', async (req, res) => {
    const db = getDatabasePool();
    const dbOk = await db.healthCheck();
    const statusCode = dbOk ? 200 : 503;
    return res.status(statusCode).send({
      success: dbOk,
      data: {
        status: dbOk ? 'ready' : 'unready',
        timestamp: new Date().toISOString(),
        database: dbOk ? 'connected' : 'unreachable',
      },
    });
  });

  // Register all module routes
  await fastify.register(authRoutes);
  await fastify.register(usersRoutes);
  await fastify.register(exercisesRoutes);
  await fastify.register(workoutPlansRoutes);
  await fastify.register(dietPlansRoutes);
  await fastify.register(foodsRoutes);
  await fastify.register(assignmentRoutes);
  await fastify.register(goalsRoutes);
  await fastify.register(dailyPlanRoutes);
  await fastify.register(weightRoutes);
  await fastify.register(waterRoutes);
  await fastify.register(mealsRoutes);
  await fastify.register(workoutSessionRoutes);
  await fastify.register(cardioRoutes);
  await fastify.register(progressRoutes);
  await fastify.register(analyticsRoutes);
  await fastify.register(notificationsRoutes);
  await fastify.register(settingsRoutes);
}
