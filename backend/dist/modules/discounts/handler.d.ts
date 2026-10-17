import { FastifyRequest, FastifyReply } from 'fastify';
export declare function listDiscounts(request: FastifyRequest<{
    Params: {
        storeId: string;
    };
    Querystring: Record<string, unknown>;
}>, reply: FastifyReply): Promise<never>;
export declare function createDiscount(request: FastifyRequest<{
    Params: {
        storeId: string;
    };
    Body: unknown;
}>, reply: FastifyReply): Promise<never>;
export declare function updateDiscount(request: FastifyRequest<{
    Params: {
        storeId: string;
        id: string;
    };
    Body: unknown;
}>, reply: FastifyReply): Promise<never>;
export declare function deleteDiscount(request: FastifyRequest<{
    Params: {
        storeId: string;
        id: string;
    };
}>, reply: FastifyReply): Promise<never>;
export declare function searchProductsForDiscount(request: FastifyRequest<{
    Params: {
        storeId: string;
    };
    Querystring: Record<string, unknown>;
}>, reply: FastifyReply): Promise<never>;
export declare function listActiveDiscounts(request: FastifyRequest<{
    Params: {
        storeId: string;
    };
}>, reply: FastifyReply): Promise<never>;
//# sourceMappingURL=handler.d.ts.map