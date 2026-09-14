import { FastifyRequest, FastifyReply } from 'fastify';
export declare function listMasterCategories(_request: FastifyRequest, reply: FastifyReply): Promise<never>;
export declare function addMasterCategory(request: FastifyRequest, reply: FastifyReply): Promise<never>;
export declare function deleteMasterCategory(request: FastifyRequest<{
    Params: {
        id: string;
    };
}>, reply: FastifyReply): Promise<never>;
export declare function listCustomCategoryPromotionCandidates(request: FastifyRequest, reply: FastifyReply): Promise<never>;
export declare function promoteToMaster(request: FastifyRequest, reply: FastifyReply): Promise<never>;
//# sourceMappingURL=handler.d.ts.map