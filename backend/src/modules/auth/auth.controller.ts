import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { AuthService } from './auth.service.js';
import { env } from '../../config/env.js';
import { generateCsrfToken, setCsrfCookie } from '../../middleware/csrf.js';
import { recordAuditEvent } from '../../shared/utils/audit-utils.js';

const registerSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required').max(100),
  lastName: z.string().trim().max(100).optional(),
  email: z.string().trim().email('Invalid email address').max(255),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
  phone: z.string().trim().max(30).optional(),
  gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say']).optional(),
  heightCm: z.number().min(50).max(300).optional(),
  timezone: z.string().optional(),
  locale: z.string().optional(),
  deviceName: z.string().optional(),
  clientType: z.enum(['web', 'mobile']).optional(),
});

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

  async register(request: FastifyRequest, reply: FastifyReply) {
    const body = registerSchema.parse(request.body);
    const ip = request.ip;
    const userAgent = request.headers['user-agent'];

    const result = await this.service.register({
      ...body,
      ipAddress: ip,
      userAgent,
    });

    await recordAuditEvent(request, 'auth.user_registered', 'user', result.user.id, {
      email: result.user.email,
      role: result.user.role,
    });

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

    return reply.status(201).send({
      success: true,
      data: responseData,
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

  // --- Self-Service OTP Security Endpoints ---

  async passwordResetRequest(request: FastifyRequest, reply: FastifyReply) {
    const body = z.object({ email: z.string().email() }).parse(request.body);
    const result = await this.service.requestPasswordResetOtp(body.email);
    await recordAuditEvent(request, 'security.password_reset_otp_requested', 'auth_otp_challenge', result.challengeId, {
      purpose: 'password_reset',
    });
    return reply.status(200).send({
      success: true,
      data: {
        challengeId: result.challengeId,
        message: 'If the account exists, a 6-digit verification code has been sent.',
      },
    });
  }

  async passwordResetVerify(request: FastifyRequest, reply: FastifyReply) {
    const body = z.object({
      challengeId: z.string().min(1),
      otp: z.string().min(4).max(10),
      newPassword: z.string().min(8).max(128),
    }).parse(request.body);
    await this.service.verifyPasswordResetOtp(body.challengeId, body.otp, body.newPassword);
    await recordAuditEvent(request, 'security.password_reset_completed', 'auth_otp_challenge', body.challengeId, {
      purpose: 'password_reset',
    });
    return reply.status(200).send({
      success: true,
      data: { message: 'Password has been successfully reset. Please log in with your new password.' },
    });
  }

  async passwordChangeRequest(request: FastifyRequest, reply: FastifyReply) {
    const userId = (request as any).user.userId;
    const result = await this.service.requestPasswordChangeOtp(userId);
    await recordAuditEvent(request, 'security.password_change_otp_requested', 'auth_otp_challenge', result.challengeId, {
      purpose: 'password_change',
    });
    return reply.status(200).send({
      success: true,
      data: {
        challengeId: result.challengeId,
        message: 'Verification code sent to your email address.',
      },
    });
  }

  async passwordChangeVerify(request: FastifyRequest, reply: FastifyReply) {
    const userId = (request as any).user.userId;
    const body = z.object({
      challengeId: z.string().min(1),
      otp: z.string().min(4).max(10),
      currentPassword: z.string().min(1),
      newPassword: z.string().min(8).max(128),
    }).parse(request.body);
    await this.service.verifyPasswordChangeOtp(
      userId,
      body.challengeId,
      body.otp,
      body.currentPassword,
      body.newPassword
    );
    await recordAuditEvent(request, 'security.password_changed', 'user', userId, { purpose: 'password_change' });
    return reply.status(200).send({
      success: true,
      data: { message: 'Password has been successfully changed.' },
    });
  }

  async emailChangeRequest(request: FastifyRequest, reply: FastifyReply) {
    const userId = (request as any).user.userId;
    const body = z.object({ newEmail: z.string().email() }).parse(request.body);
    const result = await this.service.requestEmailChange(userId, body.newEmail);
    await recordAuditEvent(request, 'security.email_change_otp_requested', 'user', userId, {
      purpose: 'email_change',
      newEmailDomain: body.newEmail.toLowerCase().split('@')[1],
    });
    return reply.status(200).send({
      success: true,
      data: {
        currentEmailChallengeId: result.currentEmailChallengeId,
        newEmailChallengeId: result.newEmailChallengeId,
        message: 'Verification codes sent to your current and new email addresses.',
      },
    });
  }

  async emailChangeVerify(request: FastifyRequest, reply: FastifyReply) {
    const userId = (request as any).user.userId;
    const body = z.object({
      currentEmailOtp: z.string().min(4).max(10),
      newEmailOtp: z.string().min(4).max(10),
      password: z.string().min(1),
    }).parse(request.body);
    const result = await this.service.verifyEmailChange(
      userId,
      body.currentEmailOtp,
      body.newEmailOtp,
      body.password
    );
    await recordAuditEvent(request, 'security.email_changed', 'user', userId, {
      purpose: 'email_change',
      newEmailDomain: result.email.split('@')[1],
    });
    return reply.status(200).send({
      success: true,
      data: {
        email: result.email,
        message: 'Email address updated successfully.',
      },
    });
  }
}
