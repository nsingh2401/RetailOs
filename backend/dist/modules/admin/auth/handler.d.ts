import { FastifyRequest, FastifyReply } from 'fastify';
export declare function loginAdmin(request: FastifyRequest<{
    Body: {
        email: string;
        password: string;
    };
}>, reply: FastifyReply): Promise<never>;
export declare function logoutAdmin(request: FastifyRequest, reply: FastifyReply): Promise<never>;
export declare function meAdmin(request: FastifyRequest, reply: FastifyReply): Promise<never>;
//# sourceMappingURL=handler.d.ts.map