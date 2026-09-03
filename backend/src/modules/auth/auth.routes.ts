import { FastifyInstance } from 'fastify';
import { AuthController } from './auth.controller.js';

export async function authRoutes(fastify: FastifyInstance) {
  const controller = new AuthController();

  fastify.get('/auth/csrf', (req, res) => controller.csrf(req, res));
  fastify.post('/auth/login', (req, res) => controller.login(req, res));
  fastify.post('/auth/refresh', (req, res) => controller.refresh(req, res));
  fastify.post('/auth/logout', (req, res) => controller.logout(req, res));
  // Legacy aliases use the OTP-only password recovery flow.
  fastify.post('/auth/request-password-reset', (req, res) => controller.passwordResetRequest(req, res));
  fastify.post('/auth/forgot-password', (req, res) => controller.passwordResetRequest(req, res));
  fastify.post('/auth/reset-password', (req, res) => controller.passwordResetVerify(req, res));
  fastify.post('/auth/password-reset/request', (req, res) => controller.passwordResetRequest(req, res));
  fastify.post('/auth/password-reset/verify', (req, res) => controller.passwordResetVerify(req, res));
}
