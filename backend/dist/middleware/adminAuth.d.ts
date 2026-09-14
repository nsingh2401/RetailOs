import { FastifyRequest, FastifyReply } from 'fastify';
export interface AdminJwtPayload {
    platformUserId: string;
    email: string;
    permissions: string[];
    jti: string;
    iat: number;
    exp: number;
}
declare module 'fastify' {
    interface FastifyRequest {
        platformUser: AdminJwtPayload;
    }
}
export declare function adminAuthMiddleware(request: FastifyRequest, reply: FastifyReply): Promise<undefined>;
//# sourceMappingURL=adminAuth.d.ts.map