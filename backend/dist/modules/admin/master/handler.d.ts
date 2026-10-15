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
export declare function listMasterBrands(request: FastifyRequest, reply: FastifyReply): Promise<never>;
export declare function createMasterBrand(request: FastifyRequest, reply: FastifyReply): Promise<never>;
export declare function updateMasterBrand(request: FastifyRequest<{
    Params: {
        id: string;
    };
}>, reply: FastifyReply): Promise<never>;
export declare function deleteMasterBrand(request: FastifyRequest<{
    Params: {
        id: string;
    };
}>, reply: FastifyReply): Promise<never>;
export declare function listBrandPromotionCandidates(request: FastifyRequest, reply: FastifyReply): Promise<never>;
export declare function promoteBrandToMaster(request: FastifyRequest, reply: FastifyReply): Promise<never>;
//# sourceMappingURL=handler.d.ts.map