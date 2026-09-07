import { FastifyInstance } from 'fastify';
import { ExercisesController } from './exercises.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requireAdmin } from '../../middleware/authorize.js';

export async function exercisesRoutes(fastify: FastifyInstance) {
  const controller = new ExercisesController();

  // Admin and user access for library read
  fastify.get('/exercises/metadata', { preHandler: [authenticate] }, (req, res) => controller.getMetadata(req, res));
  fastify.get('/exercises', { preHandler: [authenticate] }, (req, res) => controller.listExercises(req, res));
  fastify.post('/exercises', { preHandler: [authenticate] }, (req, res) => controller.createExercise(req, res));
  fastify.get('/admin/exercises/metadata', { preHandler: [authenticate, requireAdmin] }, (req, res) => controller.getMetadata(req, res));
  fastify.get('/admin/exercises', { preHandler: [authenticate, requireAdmin] }, (req, res) => controller.listExercises(req, res));
  fastify.post('/admin/exercises', { preHandler: [authenticate, requireAdmin] }, (req, res) => controller.createExercise(req, res));
  fastify.get('/admin/exercises/:id', { preHandler: [authenticate, requireAdmin] }, (req, res) => controller.getExercise(req, res));
  fastify.patch('/admin/exercises/:id', { preHandler: [authenticate, requireAdmin] }, (req, res) => controller.updateExercise(req, res));
  fastify.post('/admin/exercises/:id/archive', { preHandler: [authenticate, requireAdmin] }, (req, res) => controller.archiveExercise(req, res));
  fastify.post('/admin/exercises/:id/restore', { preHandler: [authenticate, requireAdmin] }, (req, res) => controller.restoreExercise(req, res));
}
