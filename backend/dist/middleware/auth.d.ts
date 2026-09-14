import { FastifyRequest, FastifyReply } from 'fastify';
export interface AuthUser {
    userId: string;
    orgId: string;
    userType: string;
    name: string;
}
declare module 'fastify' {
    interface FastifyRequest {
        authUser: AuthUser;
        storeRole: string;
        storeId: string;
        storePermissions: Record<string, boolean> | null;
    }
}
/**
 * Verifies Bearer token (session token from Redis).
 * Attaches authUser to request.
 */
export declare function authMiddleware(request: FastifyRequest, reply: FastifyReply): Promise<undefined>;
//# sourceMappingURL=auth.d.ts.map