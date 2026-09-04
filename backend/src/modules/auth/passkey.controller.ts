import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { PasskeyService } from './passkey.service.js';
import { AuthenticatedRequest } from '../../shared/types/index.js';
import { recordAuditEvent } from '../../shared/utils/audit-utils.js';
import { parsePositiveInt } from '../../shared/utils/request-utils.js';
import { env } from '../../config/env.js';
import { generateCsrfToken, setCsrfCookie } from '../../middleware/csrf.js';
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from '@simplewebauthn/server';

const loginOptionsSchema = z.object({
  email: z.string().email().optional(),
}).optional();

const loginVerifySchema = z.object({
  challengeId: z.string().min(1),
  response: z.object({
    id: z.string().min(1),
    rawId: z.string().min(1),
    type: z.literal('public-key'),
    authenticatorAttachment: z.string().optional(),
    clientExtensionResults: z.record(z.unknown()).default({}),
    response: z.object({
      authenticatorData: z.string().min(1),
      clientDataJSON: z.string().min(1),
      signature: z.string().min(1),
      userHandle: z.string().min(1).optional(),
    }),
  }),
  deviceName: z.string().max(150).optional(),
  clientType: z.enum(['web', 'mobile']).optional(),
});

const registerVerifySchema = z.object({
  challengeId: z.string().min(1),
  response: z.object({
    id: z.string().min(1),
    rawId: z.string().min(1),
    type: z.literal('public-key'),
    authenticatorAttachment: z.string().optional(),
    clientExtensionResults: z.record(z.unknown()).default({}),
    response: z.object({
      clientDataJSON: z.string().min(1),
      attestationObject: z.string().min(1),
      authenticatorData: z.string().min(1).optional(),
      transports: z.array(z.string()).optional(),
      publicKeyAlgorithm: z.number().int().optional(),
      publicKey: z.string().optional(),
    }),
  }),
  deviceName: z.string().max(150).optional(),
  clientType: z.enum(['web', 'mobile']).optional(),
});

export class PasskeyController {
  private service = new PasskeyService();

  async registerOptions(request: FastifyRequest, reply: FastifyReply) {
    const auth = (request as AuthenticatedRequest).user;
    const options = await this.service.generateRegistrationOptions(auth.userId);
    return reply.status(200).send({ success: true, data: options });
  }

  async registerVerify(request: FastifyRequest, reply: FastifyReply) {
    const auth = (request as AuthenticatedRequest).user;
    const body = registerVerifySchema.parse(request.body);
    const result = await this.service.verifyRegistration(auth.userId, {
      challengeId: body.challengeId,
      response: body.response as RegistrationResponseJSON,
      deviceName: body.deviceName,
    });

    await recordAuditEvent(request, 'auth.passkey_registered', 'user_passkey', result.id, {
      deviceName: result.deviceName,
      credentialId: result.credentialId,
    });

    return reply.status(201).send({ success: true, data: result });
  }

  async loginOptions(request: FastifyRequest, reply: FastifyReply) {
    const body = request.body ? loginOptionsSchema.parse(request.body) : undefined;
    const options = await this.service.generateLoginOptions(body?.email);
    return reply.status(200).send({ success: true, data: options });
  }

  async loginVerify(request: FastifyRequest, reply: FastifyReply) {
    const body = loginVerifySchema.parse(request.body);
    const ip = request.ip;
    const userAgent = request.headers['user-agent'];

    const result = await this.service.verifyLogin(
      {
        challengeId: body.challengeId,
        response: body.response as AuthenticationResponseJSON,
        deviceName: body.deviceName,
      },
      ip,
      userAgent
    );

    // Set HttpOnly Secure SameSite session cookies for web clients
    reply.setCookie('access_token', result.accessToken, {
      path: '/',
      httpOnly: true,
      secure: env.nodeEnv === 'production',
      sameSite: env.cookieSameSite,
      maxAge: env.accessTokenTtlSeconds,
    });
    reply.setCookie('refresh_token', result.refreshToken, {
      path: '/api/v1/auth',
      httpOnly: true,
      secure: env.nodeEnv === 'production',
      sameSite: env.cookieSameSite,
      maxAge: env.refreshTokenTtlDays * 86400,
    });

    const csrfToken = generateCsrfToken();
    setCsrfCookie(reply, csrfToken);

    await recordAuditEvent(request, 'auth.passkey_login', 'user', result.user.id, {
      email: result.user.email,
      credentialId: body.response.id,
    });

    const isWebClient = body.clientType === 'web' || request.headers['x-client-type'] === 'web';
    const responseData = isWebClient
      ? { user: result.user, expiresInSeconds: result.expiresInSeconds, csrfToken }
      : result;

    return reply.status(200).send({
      success: true,
      data: responseData,
    });
  }

  async listPasskeys(request: FastifyRequest, reply: FastifyReply) {
    const auth = (request as AuthenticatedRequest).user;
    const passkeys = await this.service.listUserPasskeys(auth.userId);
    return reply.status(200).send({ success: true, data: passkeys });
  }

  async deletePasskey(request: FastifyRequest, reply: FastifyReply) {
    const auth = (request as AuthenticatedRequest).user;
    const params = request.params as { id: string };
    const passkeyId = parsePositiveInt(params.id, 'passkeyId');

    await this.service.deleteUserPasskey(auth.userId, passkeyId);

    await recordAuditEvent(request, 'auth.passkey_revoked', 'user_passkey', passkeyId, {
      userId: auth.userId,
    });

    return reply.status(200).send({
      success: true,
      data: { message: 'Passkey revoked successfully' },
    });
  }
}
