import { FastifyRequest, FastifyReply } from 'fastify';
import { getSession, cacheGet, cacheSet } from '../lib/redis';
import { prisma } from '../lib/prisma';

export interface AuthUser {
  userId:   string;
  orgId:    string;
  userType: string;
  name:     string;
}

declare module 'fastify' {
  interface FastifyRequest {
    authUser:         AuthUser;
    storeRole:        string;
    storeId:          string;
    storePermissions: Record<string, boolean> | null;
  }
}

/**
 * Verifies Bearer token (session token from Redis).
 * Attaches authUser to request.
 */
export async function authMiddleware(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers['authorization'];
  if (!authHeader?.startsWith('Bearer ')) {
    return reply.status(401).send({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Missing authorization header', statusCode: 401 },
    });
  }

  const token = authHeader.slice(7);

  // Check session in Redis
  const userId = await getSession(token);
  if (!userId) {
    return reply.status(401).send({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Invalid or expired session', statusCode: 401 },
    });
  }

  // Load user from cache or DB
  const cacheKey = `user:${userId}`;
  let user = await cacheGet<AuthUser>(cacheKey);

  if (!user) {
    const dbUser = await prisma.user.findUnique({
      where:  { userId },
      select: { userId: true, orgId: true, userType: true, name: true, isActive: true },
    });

    if (!dbUser || !dbUser.isActive) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'User not found or deactivated', statusCode: 401 },
      });
    }

    user = {
      userId:   dbUser.userId,
      orgId:    dbUser.orgId,
      userType: dbUser.userType,
      name:     dbUser.name,
    };
    await cacheSet(cacheKey, user, 300); // 5 min cache
  }

  request.authUser = user;
}
