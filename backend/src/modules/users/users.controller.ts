import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { UsersService } from './users.service.js';
import { AuthenticatedRequest } from '../../shared/types/index.js';
import { ForbiddenError, ValidationError } from '../../shared/errors/app-error.js';
import { parseBoundedPositiveInt, parsePositiveInt } from '../../shared/utils/request-utils.js';

const createUserSchema = z.object({
  roleId: z.number().int().positive().optional(),
  firstName: z.string().min(1),
  lastName: z.string().optional(),
  email: z.string().email(),
  password: z.string().min(6),
  phone: z.string().optional(),
  heightCm: z.number().min(50).max(300).optional(),
  gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say']).optional(),
  timezone: z.string().optional(),
  locale: z.string().optional(),
});

const updateUserSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().optional(),
  phone: z.string().optional(),
  dateOfBirth: z.string().nullable().optional(),
  heightCm: z.number().min(50).max(300).nullable().optional(),
  gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say']).nullable().optional(),
  unitSystem: z.enum(['metric', 'imperial']).optional(),
  timezone: z.string().optional(),
  locale: z.string().optional(),
  status: z.enum(['active', 'disabled', 'pending']).optional(),
});

export class UsersController {
  private service = new UsersService();

  // Admin: List Users
  async listUsers(request: FastifyRequest, reply: FastifyReply) {
    const query = (request.query || {}) as any;
    const page = parseBoundedPositiveInt(query.page, 'page', 1, 100000, 1);
    const limit = parseBoundedPositiveInt(query.limit, 'limit', 1, 100, 20);

    const result = await this.service.getUsers({
      search: query.search,
      status: query.status,
      role: query.role,
      page,
      limit,
    });

    return reply.status(200).send({
      success: true,
      data: result.users,
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages: Math.ceil(result.total / limit),
      },
    });
  }

  // Admin: Get User
  async getUser(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as { userId: string };
    const userId = parsePositiveInt(params.userId, 'userId');
    const user = await this.service.getUserById(userId);
    return reply.status(200).send({
      success: true,
      data: user,
    });
  }

  // Admin: Get User Monitoring Dossier
  async getUserMonitoring(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as { userId: string };
    const userId = parsePositiveInt(params.userId, 'userId');
    const dossier = await this.service.getUserMonitoring(userId);
    return reply.status(200).send({
      success: true,
      data: dossier,
    });
  }

  // Admin: Create User
  async createUser(request: FastifyRequest, reply: FastifyReply) {
    const body = createUserSchema.parse(request.body);
    const actor = (request as AuthenticatedRequest).user;
    const requestedRoleId = body.roleId ?? 3;
    if (![1, 2, 3].includes(requestedRoleId)) {
      throw new ValidationError('Invalid user role');
    }
    if (requestedRoleId !== 3 && actor.roleName !== 'super_admin') {
      throw new ForbiddenError('Only super administrators can create administrative users');
    }
    const user = await this.service.createUser(body);
    return reply.status(201).send({
      success: true,
      data: user,
    });
  }

  // Admin: Update User
  async updateUser(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as { userId: string };
    const userId = parsePositiveInt(params.userId, 'userId');
    const body = updateUserSchema.parse(request.body);
    const user = await this.service.updateUser(userId, body);
    return reply.status(200).send({
      success: true,
      data: user,
    });
  }

  // Admin: Enable / Disable
  async setStatus(request: FastifyRequest, reply: FastifyReply, status: 'active' | 'disabled') {
    const params = request.params as { userId: string };
    const userId = parsePositiveInt(params.userId, 'userId');
    const user = await this.service.setAccountStatus(userId, status);
    return reply.status(200).send({
      success: true,
      data: user,
    });
  }

  // Current User: GET /me
  async getMe(request: FastifyRequest, reply: FastifyReply) {
    const auth = (request as AuthenticatedRequest).user;
    const user = await this.service.getUserById(auth.userId);
    return reply.status(200).send({
      success: true,
      data: user,
    });
  }

  // Current User: PATCH /me
  async updateMe(request: FastifyRequest, reply: FastifyReply) {
    const auth = (request as AuthenticatedRequest).user;
    const body = updateUserSchema.parse(request.body);
    // Disallow regular user self-status modification
    delete body.status;
    const user = await this.service.updateUser(auth.userId, body);
    return reply.status(200).send({
      success: true,
      data: user,
    });
  }

  // Current User: Settings
  async getMySettings(request: FastifyRequest, reply: FastifyReply) {
    const auth = (request as AuthenticatedRequest).user;
    const settings = await this.service.getUserSettings(auth.userId);
    return reply.status(200).send({
      success: true,
      data: settings || { allowPush: 1, allowInApp: 1, allowReminders: 1, allowMissedTaskAlerts: 1 },
    });
  }

  async updateMySettings(request: FastifyRequest, reply: FastifyReply) {
    const auth = (request as AuthenticatedRequest).user;
    const settings = await this.service.updateUserSettings(auth.userId, request.body);
    return reply.status(200).send({
      success: true,
      data: settings,
    });
  }

  // Current User: Notification Settings (/me/notification-settings)
  async getNotificationSettings(request: FastifyRequest, reply: FastifyReply) {
    const auth = (request as AuthenticatedRequest).user;
    const settings = await this.service.getNotificationSettings(auth.userId);
    return reply.status(200).send({
      success: true,
      data: settings,
    });
  }

  async updateNotificationSettings(request: FastifyRequest, reply: FastifyReply) {
    const auth = (request as AuthenticatedRequest).user;
    const schema = z.object({
      inAppEnabled: z.boolean().optional(),
      pushEnabled: z.boolean().optional(),
      localNotificationsEnabled: z.boolean().optional(),
      quietHoursEnabled: z.boolean().optional(),
      quietHoursStart: z.string().nullable().optional(),
      quietHoursEnd: z.string().nullable().optional(),
      categories: z.record(z.boolean()).optional(),
      categoryPreferences: z.record(z.boolean()).optional(),
    });
    const body = schema.parse(request.body || {});
    const categories = body.categories || body.categoryPreferences;
    const updated = await this.service.updateNotificationSettings(auth.userId, {
      ...body,
      categories,
    });
    return reply.status(200).send({
      success: true,
      data: updated,
    });
  }

  // Current User: GET /me/fitness-configuration
  async getFitnessConfiguration(request: FastifyRequest, reply: FastifyReply) {
    const auth = (request as AuthenticatedRequest).user;
    const config = await this.service.getFitnessConfiguration(auth.userId);
    return reply.status(200).send({
      success: true,
      data: config,
    });
  }
}
