import { FastifyInstance } from 'fastify';
import { AuthController } from './auth.controller.js';

export async function authRoutes(fastify: FastifyInstance) {
  const controller = new AuthController();

  fastify.get('/auth/csrf', (req, res) => controller.csrf(req, res));
  fastify.post('/auth/login', (req, res) => controller.login(req, res));
  fastify.post('/auth/refresh', (req, res) => controller.refresh(req, res));
  fastify.post('/auth/logout', (req, res) => controller.logout(req, res));
  fastify.post('/auth/request-password-reset', (req, res) => controller.forgotPassword(req, res));
  fastify.post('/auth/forgot-password', (req, res) => controller.forgotPassword(req, res));
  fastify.post('/auth/reset-password', (req, res) => controller.resetPassword(req, res));
}
