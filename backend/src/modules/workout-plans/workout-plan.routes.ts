import { FastifyInstance } from 'fastify';
import { WorkoutPlanController } from './workout-plan.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requireAdmin } from '../../middleware/authorize.js';

export async function workoutPlansRoutes(fastify: FastifyInstance) {
  const controller = new WorkoutPlanController();

  // Admin Workout Plan Endpoints
  fastify.get('/admin/workout-plans', { preHandler: [authenticate, requireAdmin] }, (req, res) => controller.listPlans(req, res));
  fastify.post('/admin/workout-plans', { preHandler: [authenticate, requireAdmin] }, (req, res) => controller.createPlan(req, res));
  fastify.get('/admin/workout-plans/:planId', { preHandler: [authenticate, requireAdmin] }, (req, res) => controller.getPlan(req, res));
  fastify.patch('/admin/workout-plans/:planId', { preHandler: [authenticate, requireAdmin] }, (req, res) => controller.updatePlan(req, res));

  // Versions
  fastify.get('/admin/workout-versions/:versionId', { preHandler: [authenticate, requireAdmin] }, (req, res) => controller.getVersion(req, res));
  fastify.post('/admin/workout-plans/:planId/versions', { preHandler: [authenticate, requireAdmin] }, (req, res) => controller.createVersion(req, res));
  fastify.post('/admin/workout-versions/:versionId/publish', { preHandler: [authenticate, requireAdmin] }, (req, res) => controller.publishVersion(req, res));

  // Days
  fastify.post('/admin/workout-versions/:versionId/days', { preHandler: [authenticate, requireAdmin] }, (req, res) => controller.addDay(req, res));
  fastify.patch('/admin/workout-days/:dayId', { preHandler: [authenticate, requireAdmin] }, (req, res) => controller.updateDay(req, res));
  fastify.delete('/admin/workout-days/:dayId', { preHandler: [authenticate, requireAdmin] }, (req, res) => controller.deleteDay(req, res));

  // Exercises
  fastify.post('/admin/workout-days/:dayId/exercises', { preHandler: [authenticate, requireAdmin] }, (req, res) => controller.addExerciseToDay(req, res));
  fastify.patch('/admin/workout-exercises/:id', { preHandler: [authenticate, requireAdmin] }, (req, res) => controller.updateExercise(req, res));
  fastify.delete('/admin/workout-exercises/:id', { preHandler: [authenticate, requireAdmin] }, (req, res) => controller.deleteExercise(req, res));
}
