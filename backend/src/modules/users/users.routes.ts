import { FastifyInstance } from 'fastify';
import { UsersController } from './users.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requireAdmin } from '../../middleware/authorize.js';

export async function usersRoutes(fastify: FastifyInstance) {
  const controller = new UsersController();

  // /me Endpoints (Self-service authenticated)
  fastify.get('/me', { preHandler: [authenticate] }, (req, res) => controller.getMe(req, res));
  fastify.patch('/me', { preHandler: [authenticate] }, (req, res) => controller.updateMe(req, res));
  fastify.get('/me/settings', { preHandler: [authenticate] }, (req, res) => controller.getMySettings(req, res));
  fastify.patch('/me/settings', { preHandler: [authenticate] }, (req, res) => controller.updateMySettings(req, res));
  fastify.get('/me/notification-settings', { preHandler: [authenticate] }, (req, res) => controller.getNotificationSettings(req, res));
  fastify.patch('/me/notification-settings', { preHandler: [authenticate] }, (req, res) => controller.updateNotificationSettings(req, res));
  fastify.put('/me/notification-settings', { preHandler: [authenticate] }, (req, res) => controller.updateNotificationSettings(req, res));

  // /admin/users Endpoints (Admin only)
  fastify.get('/admin/users', { preHandler: [authenticate, requireAdmin] }, (req, res) => controller.listUsers(req, res));
  fastify.post('/admin/users', { preHandler: [authenticate, requireAdmin] }, (req, res) => controller.createUser(req, res));
  fastify.get('/admin/users/:userId', { preHandler: [authenticate, requireAdmin] }, (req, res) => controller.getUser(req, res));
  fastify.get('/admin/users/:userId/monitoring', { preHandler: [authenticate, requireAdmin] }, (req, res) => controller.getUserMonitoring(req, res));
  fastify.patch('/admin/users/:userId', { preHandler: [authenticate, requireAdmin] }, (req, res) => controller.updateUser(req, res));
  fastify.post('/admin/users/:userId/disable', { preHandler: [authenticate, requireAdmin] }, (req, res) => controller.setStatus(req, res, 'disabled'));
  fastify.post('/admin/users/:userId/enable', { preHandler: [authenticate, requireAdmin] }, (req, res) => controller.setStatus(req, res, 'active'));
}
