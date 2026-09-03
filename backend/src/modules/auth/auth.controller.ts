import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { AuthService } from './auth.service.js';
import { env } from '../../config/env.js';
import { generateCsrfToken, setCsrfCookie } from '../../middleware/csrf.js';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  deviceName: z.string().optional(),
  clientType: z.enum(['web', 'mobile']).optional(),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(10),
  clientType: z.enum(['web', 'mobile']).optional(),
});

const logoutSchema = z.object({
  refreshToken: z.string().optional(),
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  token: z.string().min(32).max(191),
  password: z.string().min(8).max(128),
});

export class AuthController {
  private service = new AuthService();

  async csrf(request: FastifyRequest, reply: FastifyReply) {
    const existingToken = (request as any).cookies?.csrf_token;
    const csrfToken = existingToken || generateCsrfToken();

    // The endpoint is also used when the dashboard is hosted on a different
    // origin from the API, where JavaScript cannot read the API's cookie.
    if (!existingToken) {
      setCsrfCookie(reply, csrfToken);
    }

    return reply.status(200).send({
      success: true,
      data: { csrfToken },
    });
  }

  async login(request: FastifyRequest, reply: FastifyReply) {
    const body = loginSchema.parse(request.body);
    const ip = request.ip;
    const userAgent = request.headers['user-agent'];

    const result = await this.service.login(body.email, body.password, body.deviceName, ip, userAgent);
    
    // Set HttpOnly Secure SameSite session cookies
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

    const isWebClient = body.clientType === 'web' || request.headers['x-client-type'] === 'web';
    const responseData = isWebClient
      ? {
          user: result.user,
          expiresInSeconds: result.expiresInSeconds,
          csrfToken,
        }
      : result;

    return reply.status(200).send({
      success: true,
      data: responseData,
    });
  }

  async refresh(request: FastifyRequest, reply: FastifyReply) {
    const rawBodyToken = (request.body as any)?.refreshToken;
    const cookieToken = (request as any).cookies?.refresh_token;
    const refreshToken = rawBodyToken || cookieToken;

    const parsed = refreshSchema.parse({ 
      refreshToken,
      clientType: (request.body as any)?.clientType,
    });
    const ip = request.ip;
    const userAgent = request.headers['user-agent'];

    const result = await this.service.refreshToken(parsed.refreshToken, ip, userAgent);

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

    const isWebClient = parsed.clientType === 'web' || request.headers['x-client-type'] === 'web' || (!rawBodyToken && !!cookieToken);
    const responseData = isWebClient
      ? {
          expiresInSeconds: result.expiresInSeconds,
          csrfToken,
        }
      : result;

    return reply.status(200).send({
      success: true,
      data: responseData,
    });
  }

  async logout(request: FastifyRequest, reply: FastifyReply) {
    const rawBodyToken = (request.body as any)?.refreshToken;
    const cookieToken = (request as any).cookies?.refresh_token;
    const refreshToken = rawBodyToken || cookieToken;

    await this.service.logout(refreshToken);

    reply.clearCookie('access_token', { path: '/' });
    reply.clearCookie('refresh_token', { path: '/api/v1/auth' });
    reply.clearCookie('csrf_token', { path: '/' });

    return reply.status(200).send({
      success: true,
      data: { message: 'Successfully logged out' },
    });
  }

  async forgotPassword(request: FastifyRequest, reply: FastifyReply) {
    const body = forgotPasswordSchema.parse(request.body);
    await this.service.requestPasswordReset(body.email);
    return reply.status(202).send({
      success: true,
      data: { message: 'If the account exists, password reset instructions will be sent.' },
    });
  }

  async resetPassword(request: FastifyRequest, reply: FastifyReply) {
    const body = resetPasswordSchema.parse(request.body);
    await this.service.resetPassword(body.token, body.password);
    return reply.status(200).send({ success: true, data: { message: 'Password has been reset.' } });
  }
}
