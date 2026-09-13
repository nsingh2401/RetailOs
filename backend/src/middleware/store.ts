import { FastifyRequest, FastifyReply } from 'fastify';
import { cacheGet, cacheSet } from '../lib/redis';
import { prisma } from '../lib/prisma';

/**
 * Validates X-Store-ID header and checks the authenticated user has a role in that store.
 * Sets PostgreSQL RLS context variable for the session.
 * Must run AFTER authMiddleware.
 */
export async function storeMiddleware(request: FastifyRequest, reply: FastifyReply) {
  const storeId = request.headers['x-store-id'] as string;
  if (!storeId) {
    return reply.status(400).send({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'X-Store-ID header is required', statusCode: 400 },
    });
  }

  const { userId } = request.authUser;

  // Load role + permissions from cache
  const cacheKey = `role:${userId}:${storeId}`;
  let cached = await cacheGet<{ role: string; permissions: Record<string, boolean> | null }>(cacheKey);

  if (!cached) {
    const roleRow = await prisma.userStoreRole.findFirst({
      where:  { userId, storeId, isActive: true },
      select: { role: true, permissions: true },
    });

    if (!roleRow) {
      return reply.status(403).send({
        success: false,
        error: { code: 'STORE_ACCESS_DENIED', message: 'You do not have access to this store', statusCode: 403 },
      });
    }

    cached = {
      role:        roleRow.role as string,
      permissions: (roleRow.permissions ?? null) as Record<string, boolean> | null,
    };
    await cacheSet(cacheKey, cached, 300);
  }

  request.storeId          = storeId;
  request.storeRole        = cached.role;
  request.storePermissions = cached.permissions;

  // Set PostgreSQL RLS context — second layer of store isolation
  await prisma.$executeRawUnsafe(`SET app.current_store_id = '${storeId}'`);
}

/**
 * Role-based access check factory.
 * Usage: preHandler: [authMiddleware, storeMiddleware, requireRole('MANAGER')]
 */
export function requireRole(...allowedRoles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!allowedRoles.includes(request.storeRole)) {
      return reply.status(403).send({
        success: false,
        error: {
          code:       'FORBIDDEN',
          message:    `This action requires ${allowedRoles.join(' or ')} role`,
          statusCode: 403,
        },
      });
    }
  };
}
