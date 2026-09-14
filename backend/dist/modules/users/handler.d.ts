import { FastifyRequest, FastifyReply } from 'fastify';
export declare function createStoreUser(request: FastifyRequest<{
    Params: {
        storeId: string;
    };
    Body: {
        name: string;
        phone: string;
        password: string;
        role: 'MANAGER' | 'OPERATOR';
        permissions?: Record<string, boolean>;
    };
}>, reply: FastifyReply): Promise<never>;
export declare function listStoreUsers(request: FastifyRequest<{
    Params: {
        storeId: string;
    };
}>, reply: FastifyReply): Promise<never>;
export declare function updateStoreUser(request: FastifyRequest<{
    Params: {
        storeId: string;
        userId: string;
    };
    Body: {
        role?: 'MANAGER' | 'OPERATOR';
        permissions?: Record<string, boolean>;
    };
}>, reply: FastifyReply): Promise<never>;
export declare function removeStoreUser(request: FastifyRequest<{
    Params: {
        storeId: string;
        userId: string;
    };
}>, reply: FastifyReply): Promise<never>;
export declare function updateMe(request: FastifyRequest<{
    Body: {
        name?: string;
    };
}>, reply: FastifyReply): Promise<never>;
export declare function uploadAvatar(request: FastifyRequest, reply: FastifyReply): Promise<never>;
export declare function getMyStores(request: FastifyRequest, reply: FastifyReply): Promise<never>;
//# sourceMappingURL=handler.d.ts.map