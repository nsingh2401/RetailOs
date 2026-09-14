import { FastifyRequest, FastifyReply } from 'fastify';
export declare function listRoles(_request: FastifyRequest, reply: FastifyReply): Promise<never>;
export declare function createRole(request: FastifyRequest<{
    Body: {
        name: string;
        description?: string;
        permissions?: Record<string, boolean>;
    };
}>, reply: FastifyReply): Promise<never>;
export declare function updateRole(request: FastifyRequest<{
    Params: {
        roleId: string;
    };
    Body: {
        name?: string;
        description?: string;
        permissions?: Record<string, boolean>;
    };
}>, reply: FastifyReply): Promise<never>;
export declare function deleteRole(request: FastifyRequest<{
    Params: {
        roleId: string;
    };
}>, reply: FastifyReply): Promise<never>;
//# sourceMappingURL=handler.d.ts.map