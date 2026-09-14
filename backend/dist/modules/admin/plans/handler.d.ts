import { FastifyRequest, FastifyReply } from 'fastify';
export declare function listPlanFeatures(_request: FastifyRequest, reply: FastifyReply): Promise<never>;
export declare function listPlans(_request: FastifyRequest, reply: FastifyReply): Promise<never>;
export declare function createPlan(request: FastifyRequest<{
    Body: {
        name: string;
        displayName: string;
        price: number;
        billingCycle?: string;
        maxStores?: number;
        maxUsersPerStore?: number;
        features?: string[];
        isActive?: boolean;
    };
}>, reply: FastifyReply): Promise<never>;
export declare function updatePlan(request: FastifyRequest<{
    Params: {
        planId: string;
    };
    Body: {
        displayName?: string;
        price?: number;
        billingCycle?: string;
        maxStores?: number;
        maxUsersPerStore?: number;
        features?: string[];
        isActive?: boolean;
    };
}>, reply: FastifyReply): Promise<never>;
export declare function deletePlan(request: FastifyRequest<{
    Params: {
        planId: string;
    };
}>, reply: FastifyReply): Promise<never>;
//# sourceMappingURL=handler.d.ts.map