"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = authMiddleware;
const redis_1 = require("../lib/redis");
const prisma_1 = require("../lib/prisma");
/**
 * Verifies Bearer token (session token from Redis).
 * Attaches authUser to request.
 */
async function authMiddleware(request, reply) {
    const authHeader = request.headers['authorization'];
    if (!authHeader?.startsWith('Bearer ')) {
        return reply.status(401).send({
            success: false,
            error: { code: 'UNAUTHORIZED', message: 'Missing authorization header', statusCode: 401 },
        });
    }
    const token = authHeader.slice(7);
    // Check session in Redis
    const userId = await (0, redis_1.getSession)(token);
    if (!userId) {
        return reply.status(401).send({
            success: false,
            error: { code: 'UNAUTHORIZED', message: 'Invalid or expired session', statusCode: 401 },
        });
    }
    // Load user from cache or DB
    const cacheKey = `user:${userId}`;
    let user = await (0, redis_1.cacheGet)(cacheKey);
    if (!user) {
        const dbUser = await prisma_1.prisma.user.findUnique({
            where: { userId },
            select: { userId: true, orgId: true, userType: true, name: true, isActive: true },
        });
        if (!dbUser || !dbUser.isActive) {
            return reply.status(401).send({
                success: false,
                error: { code: 'UNAUTHORIZED', message: 'User not found or deactivated', statusCode: 401 },
            });
        }
        user = {
            userId: dbUser.userId,
            orgId: dbUser.orgId,
            userType: dbUser.userType,
            name: dbUser.name,
        };
        await (0, redis_1.cacheSet)(cacheKey, user, 300); // 5 min cache
    }
    request.authUser = user;
}
//# sourceMappingURL=auth.js.map