import { FastifyRequest, FastifyReply } from 'fastify';
import type { DateRangeQuery, TopProductsQuery, ReportBaseQuery, ExportQuery, TallyExportQuery } from './schema';
export declare function getSalesSummary(request: FastifyRequest<{
    Params: {
        storeId: string;
    };
    Querystring: DateRangeQuery;
}>, reply: FastifyReply): Promise<undefined>;
export declare function getTopProducts(request: FastifyRequest<{
    Params: {
        storeId: string;
    };
    Querystring: TopProductsQuery;
}>, reply: FastifyReply): Promise<undefined>;
export declare function getSlowMovers(request: FastifyRequest<{
    Params: {
        storeId: string;
    };
    Querystring: ReportBaseQuery;
}>, reply: FastifyReply): Promise<undefined>;
export declare function getTaxSummary(request: FastifyRequest<{
    Params: {
        storeId: string;
    };
    Querystring: ReportBaseQuery;
}>, reply: FastifyReply): Promise<undefined>;
export declare function getCreditAging(request: FastifyRequest<{
    Params: {
        storeId: string;
    };
    Querystring: ReportBaseQuery;
}>, reply: FastifyReply): Promise<undefined>;
export declare function getPurchaseSummary(request: FastifyRequest<{
    Params: {
        storeId: string;
    };
    Querystring: ReportBaseQuery;
}>, reply: FastifyReply): Promise<undefined>;
export declare function getPaymentModes(request: FastifyRequest<{
    Params: {
        storeId: string;
    };
    Querystring: ReportBaseQuery;
}>, reply: FastifyReply): Promise<undefined>;
export declare function getGstr1(request: FastifyRequest<{
    Params: {
        storeId: string;
    };
    Querystring: ReportBaseQuery;
}>, reply: FastifyReply): Promise<undefined>;
export declare function getGstr3b(request: FastifyRequest<{
    Params: {
        storeId: string;
    };
    Querystring: ReportBaseQuery;
}>, reply: FastifyReply): Promise<undefined>;
export declare function exportReport(request: FastifyRequest<{
    Params: {
        storeId: string;
    };
    Querystring: ExportQuery;
}>, reply: FastifyReply): Promise<undefined>;
export declare function getTallyExport(request: FastifyRequest<{
    Params: {
        storeId: string;
    };
    Querystring: TallyExportQuery;
}>, reply: FastifyReply): Promise<undefined>;
//# sourceMappingURL=handler.d.ts.map