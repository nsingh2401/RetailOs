import { FastifyRequest, FastifyReply } from 'fastify';
/**
 * Validates X-Store-ID header and checks the authenticated user has a role in that store.
 * Sets PostgreSQL RLS context variable for the session.
 * Must run AFTER authMiddleware.
 */
export declare function storeMiddleware(request: FastifyRequest, reply: FastifyReply): Promise<undefined>;
/**
 * Role-based access check factory.
 * Usage: preHandler: [authMiddleware, storeMiddleware, requireRole('MANAGER')]
 */
export declare function requireRole(...allowedRoles: string[]): (request: FastifyRequest, reply: FastifyReply) => Promise<undefined>;
//# sourceMappingURL=store.d.ts.map