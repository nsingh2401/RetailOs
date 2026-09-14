import { FastifyRequest, FastifyReply } from 'fastify';
export declare function listOrgs(request: FastifyRequest<{
    Querystring: {
        page?: string;
        limit?: string;
        search?: string;
        isActive?: string;
        industryType?: string;
    };
}>, reply: FastifyReply): Promise<never>;
export declare function getOrg(request: FastifyRequest<{
    Params: {
        orgId: string;
    };
}>, reply: FastifyReply): Promise<never>;
export declare function createOrg(request: FastifyRequest<{
    Body: {
        orgName: string;
        storeName: string;
        industryType: string;
        ownerName: string;
        ownerPhone: string;
        ownerPassword: string;
        planId?: string;
    };
}>, reply: FastifyReply): Promise<never>;
export declare function updateOrg(request: FastifyRequest<{
    Params: {
        orgId: string;
    };
    Body: {
        planId?: string;
        isActive?: boolean;
    };
}>, reply: FastifyReply): Promise<never>;
//# sourceMappingURL=handler.d.ts.map