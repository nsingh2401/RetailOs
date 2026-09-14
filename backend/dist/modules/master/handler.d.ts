import { FastifyRequest, FastifyReply } from 'fastify';
export declare function getMasterDataVersion(request: FastifyRequest, reply: FastifyReply): Promise<never>;
export declare function getMasterDataFull(request: FastifyRequest, reply: FastifyReply): Promise<never>;
export declare function getStoreConfig(request: FastifyRequest, reply: FastifyReply): Promise<never>;
export declare function searchHsn(request: FastifyRequest<{
    Querystring: {
        q?: string;
    };
}>, reply: FastifyReply): Promise<never>;
export declare function getMasterIndustries(request: FastifyRequest, reply: FastifyReply): Promise<never>;
//# sourceMappingURL=handler.d.ts.map