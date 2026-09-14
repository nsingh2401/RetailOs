import { FastifyRequest, FastifyReply } from 'fastify';
export declare function listUsers(request: FastifyRequest<{
    Querystring: {
        page?: string;
        limit?: string;
        search?: string;
        isActive?: string;
    };
}>, reply: FastifyReply): Promise<never>;
export declare function createUser(request: FastifyRequest<{
    Body: {
        name: string;
        email: string;
        password: string;
        roleIds?: string[];
    };
}>, reply: FastifyReply): Promise<never>;
export declare function updateUser(request: FastifyRequest<{
    Params: {
        userId: string;
    };
    Body: {
        name?: string;
        email?: string;
        isActive?: boolean;
        roleIds?: string[];
    };
}>, reply: FastifyReply): Promise<never>;
export declare function resetPassword(request: FastifyRequest<{
    Params: {
        userId: string;
    };
    Body: {
        newPassword: string;
    };
}>, reply: FastifyReply): Promise<never>;
export declare function deleteUser(request: FastifyRequest<{
    Params: {
        userId: string;
    };
}>, reply: FastifyReply): Promise<never>;
//# sourceMappingURL=handler.d.ts.map