import { FastifyRequest, FastifyReply } from 'fastify';
export declare function getJewelryConfig(request: FastifyRequest<{
    Params: {
        storeId: string;
    };
}>, reply: FastifyReply): Promise<never>;
export declare function updateJewelryConfig(request: FastifyRequest<{
    Params: {
        storeId: string;
    };
    Body: {
        makingCharges?: Record<string, number>;
        festivalDiscountPct?: number;
        goldRateOverride?: number | null;
        silverRateOverride?: number | null;
    };
}>, reply: FastifyReply): Promise<never>;
//# sourceMappingURL=handler.d.ts.map