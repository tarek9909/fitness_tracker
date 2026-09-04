import { FastifyInstance } from 'fastify';
import { AuthController } from './auth.controller.js';
import { PasskeyController } from './passkey.controller.js';
import { authenticate } from '../../middleware/authenticate.js';

export async function authRoutes(fastify: FastifyInstance) {
  const controller = new AuthController();
  const passkeyController = new PasskeyController();

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

  // Passkey / WebAuthn Public Authentication Ceremonies
  fastify.post('/auth/passkey/login-options', (req, res) => passkeyController.loginOptions(req, res));
  fastify.post('/auth/passkey/login-verify', (req, res) => passkeyController.loginVerify(req, res));

  // Passkey / WebAuthn Registration & Management (Authenticated)
  fastify.post('/auth/passkey/register-options', { preHandler: [authenticate] }, (req, res) => passkeyController.registerOptions(req, res));
  fastify.post('/auth/passkey/register-verify', { preHandler: [authenticate] }, (req, res) => passkeyController.registerVerify(req, res));
  fastify.get('/me/passkeys', { preHandler: [authenticate] }, (req, res) => passkeyController.listPasskeys(req, res));
  fastify.delete('/me/passkeys/:id', { preHandler: [authenticate] }, (req, res) => passkeyController.deletePasskey(req, res));
}
