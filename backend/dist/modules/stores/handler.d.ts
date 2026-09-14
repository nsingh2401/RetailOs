import { FastifyRequest, FastifyReply } from 'fastify';
export declare function getStore(request: FastifyRequest<{
    Params: {
        storeId: string;
    };
}>, reply: FastifyReply): Promise<never>;
export declare function updateStore(request: FastifyRequest<{
    Params: {
        storeId: string;
    };
    Body: {
        name?: string;
        gstin?: string;
        industryType?: string;
        currencyCode?: string;
        timezone?: string;
        lowStockThreshold?: number;
        slowMoverThreshold?: number;
        tallyVersion?: string | null;
    };
}>, reply: FastifyReply): Promise<never>;
export declare function changeIndustryType(request: FastifyRequest<{
    Params: {
        storeId: string;
    };
    Body: unknown;
}>, reply: FastifyReply): Promise<never>;
export declare function syncMasterCategories(request: FastifyRequest<{
    Params: {
        storeId: string;
    };
}>, reply: FastifyReply): Promise<never>;
//# sourceMappingURL=handler.d.ts.map