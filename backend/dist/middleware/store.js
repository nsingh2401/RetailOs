"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.storeMiddleware = storeMiddleware;
exports.requireRole = requireRole;
const redis_1 = require("../lib/redis");
const prisma_1 = require("../lib/prisma");
/**
 * Validates X-Store-ID header and checks the authenticated user has a role in that store.
 * Sets PostgreSQL RLS context variable for the session.
 * Must run AFTER authMiddleware.
 */
async function storeMiddleware(request, reply) {
    const storeId = request.headers['x-store-id'];
    if (!storeId) {
        return reply.status(400).send({
            success: false,
            error: { code: 'VALIDATION_ERROR', message: 'X-Store-ID header is required', statusCode: 400 },
        });
    }
    const { userId } = request.authUser;
    // Load role + permissions from cache
    const cacheKey = `role:${userId}:${storeId}`;
    let cached = await (0, redis_1.cacheGet)(cacheKey);
    if (!cached) {
        const roleRow = await prisma_1.prisma.userStoreRole.findFirst({
            where: { userId, storeId, isActive: true },
            select: { role: true, permissions: true },
        });
        if (!roleRow) {
            return reply.status(403).send({
                success: false,
                error: { code: 'STORE_ACCESS_DENIED', message: 'You do not have access to this store', statusCode: 403 },
            });
        }
        cached = {
            role: roleRow.role,
            permissions: (roleRow.permissions ?? null),
        };
        await (0, redis_1.cacheSet)(cacheKey, cached, 300);
    }
    request.storeId = storeId;
    request.storeRole = cached.role;
    request.storePermissions = cached.permissions;
    // Set PostgreSQL RLS context — second layer of store isolation
    await prisma_1.prisma.$executeRawUnsafe(`SET app.current_store_id = '${storeId}'`);
}
/**
 * Role-based access check factory.
 * Usage: preHandler: [authMiddleware, storeMiddleware, requireRole('MANAGER')]
 */
function requireRole(...allowedRoles) {
    return async (request, reply) => {
        if (!allowedRoles.includes(request.storeRole)) {
            return reply.status(403).send({
                success: false,
                error: {
                    code: 'FORBIDDEN',
                    message: `This action requires ${allowedRoles.join(' or ')} role`,
                    statusCode: 403,
                },
            });
        }
    };
}
//# sourceMappingURL=store.js.map