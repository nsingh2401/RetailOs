import { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { cacheGet } from '../lib/redis';

export interface AdminJwtPayload {
  platformUserId: string;
  email:          string;
  permissions:    string[];
  jti:            string;
  iat:            number;
  exp:            number;
}

const JWT_SECRET = process.env.ADMIN_JWT_SECRET ?? 'change-me-in-production';

declare module 'fastify' {
  interface FastifyRequest {
    platformUser: AdminJwtPayload;
  }
}

export async function adminAuthMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const authHeader = request.headers['authorization'];
  if (!authHeader?.startsWith('Bearer ')) {
    return reply.status(401).send({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Missing authorization header', statusCode: 401 },
    });
  }

  const token = authHeader.slice(7);
  let payload: AdminJwtPayload;

  try {
    payload = jwt.verify(token, JWT_SECRET) as AdminJwtPayload;
  } catch {
    return reply.status(401).send({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token', statusCode: 401 },
    });
  }

  if (payload.jti) {
    const blacklisted = await cacheGet<string>(`admin_blacklist:${payload.jti}`);
    if (blacklisted) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Token has been revoked', statusCode: 401 },
      });
    }
  }

  request.platformUser = payload;
}
