import { FastifyRequest } from 'fastify';

export interface UserAuthPayload {
  userId: number;
  roleId: number;
  roleName: string;
  email: string;
  securityVersion?: number;
  sessionId?: number;
}

export interface AuthenticatedRequest extends FastifyRequest {
  user: UserAuthPayload;
  requestId: string;
}

export interface StandardApiResponse<T = any> {
  success: boolean;
  data?: T;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
}
