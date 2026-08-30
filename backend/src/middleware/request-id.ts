import { FastifyRequest, FastifyReply } from 'fastify';
import { v4 as uuidv4 } from 'uuid';

export async function requestIdMiddleware(request: FastifyRequest, reply: FastifyReply) {
  const reqId = (request.headers['x-request-id'] as string) || `req_${uuidv4()}`;
  (request as any).requestId = reqId;
  reply.header('X-Request-ID', reqId);
}
