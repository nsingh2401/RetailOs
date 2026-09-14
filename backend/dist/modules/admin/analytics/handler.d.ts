import { FastifyRequest, FastifyReply } from 'fastify';
export declare function getOverview(_request: FastifyRequest, reply: FastifyReply): Promise<never>;
export declare function getRevenueSeries(request: FastifyRequest<{
    Querystring: {
        period?: string;
    };
}>, reply: FastifyReply): Promise<never>;
export declare function getIndustryBreakdown(_request: FastifyRequest, reply: FastifyReply): Promise<never>;
export declare function getTopOrgs(request: FastifyRequest<{
    Querystring: {
        limit?: string;
    };
}>, reply: FastifyReply): Promise<never>;
//# sourceMappingURL=handler.d.ts.map