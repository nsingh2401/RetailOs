import { FastifyRequest, FastifyReply } from 'fastify';
export declare function listStores(request: FastifyRequest<{
    Querystring: {
        page?: string;
        limit?: string;
        search?: string;
        isActive?: string;
        industryType?: string;
        orgId?: string;
    };
}>, reply: FastifyReply): Promise<never>;
export declare function updateStore(request: FastifyRequest<{
    Params: {
        storeId: string;
    };
    Body: {
        isActive?: boolean;
        industryType?: string;
    };
}>, reply: FastifyReply): Promise<never>;
export declare function addStoreToOrg(request: FastifyRequest<{
    Params: {
        orgId: string;
    };
    Body: {
        storeName: string;
        industryType: string;
    };
}>, reply: FastifyReply): Promise<never>;
//# sourceMappingURL=handler.d.ts.map