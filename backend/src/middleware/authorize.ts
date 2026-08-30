import { FastifyRequest, FastifyReply } from 'fastify';
import { ForbiddenError } from '../shared/errors/app-error.js';
import { AuthenticatedRequest } from '../shared/types/index.js';

export function requireRoles(...allowedRoles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as AuthenticatedRequest).user;
    if (!user || !allowedRoles.includes(user.roleName)) {
      throw new ForbiddenError(`Access denied. Required role: ${allowedRoles.join(', ')}`);
    }
  };
}

export const requireAdmin = requireRoles('admin', 'super_admin');
export const requireSuperAdmin = requireRoles('super_admin');
