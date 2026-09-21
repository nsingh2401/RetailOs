import { FastifyRequest, FastifyReply } from 'fastify';
export declare function getStockLevels(request: FastifyRequest<{
    Params: {
        storeId: string;
    };
    Querystring: Record<string, unknown>;
}>, reply: FastifyReply): Promise<never>;
export declare function getLowStock(request: FastifyRequest<{
    Params: {
        storeId: string;
    };
}>, reply: FastifyReply): Promise<never>;
export declare function getVariantStock(request: FastifyRequest<{
    Params: {
        storeId: string;
        variantId: string;
    };
}>, reply: FastifyReply): Promise<never>;
export declare function adjustStock(request: FastifyRequest<{
    Params: {
        storeId: string;
    };
    Body: unknown;
}>, reply: FastifyReply): Promise<never>;
export declare function getMovementHistory(request: FastifyRequest<{
    Params: {
        storeId: string;
        variantId: string;
    };
    Querystring: Record<string, unknown>;
}>, reply: FastifyReply): Promise<never>;
export declare function scanVendorBill(request: FastifyRequest<{
    Params: {
        storeId: string;
    };
}>, reply: FastifyReply): Promise<never>;
export declare function createPurchase(request: FastifyRequest<{
    Params: {
        storeId: string;
    };
    Body: unknown;
}>, reply: FastifyReply): Promise<never>;
export declare function getPurchaseHistory(request: FastifyRequest<{
    Params: {
        storeId: string;
    };
    Querystring: Record<string, unknown>;
}>, reply: FastifyReply): Promise<never>;
export declare function getPurchaseDetail(request: FastifyRequest<{
    Params: {
        storeId: string;
        purchaseId: string;
    };
}>, reply: FastifyReply): Promise<never>;
export declare function getExpiringBatches(request: FastifyRequest<{
    Params: {
        storeId: string;
    };
}>, reply: FastifyReply): Promise<never>;
export declare function getVariantBatches(request: FastifyRequest<{
    Params: {
        storeId: string;
        variantId: string;
    };
    Querystring: Record<string, unknown>;
}>, reply: FastifyReply): Promise<never>;
//# sourceMappingURL=handler.d.ts.map