import { FastifyRequest, FastifyReply } from 'fastify';
import type { CreateTaxRuleInput, UpdateTaxRuleInput, HsnSearchQuery, CreateStoreTaxRuleInput } from './schema';
export declare function listTaxRules(request: FastifyRequest, reply: FastifyReply): Promise<never>;
export declare function createTaxRule(request: FastifyRequest<{
    Body: CreateTaxRuleInput;
}>, reply: FastifyReply): Promise<never>;
export declare function getTaxRule(request: FastifyRequest<{
    Params: {
        taxRuleId: string;
    };
}>, reply: FastifyReply): Promise<never>;
export declare function updateTaxRule(request: FastifyRequest<{
    Params: {
        taxRuleId: string;
    };
    Body: UpdateTaxRuleInput;
}>, reply: FastifyReply): Promise<never>;
export declare function listStoreTaxRules(request: FastifyRequest, reply: FastifyReply): Promise<never>;
export declare function createStoreTaxRule(request: FastifyRequest<{
    Body: CreateStoreTaxRuleInput;
}>, reply: FastifyReply): Promise<never>;
export declare function updateStoreTaxRule(request: FastifyRequest<{
    Params: {
        taxRuleId: string;
    };
    Body: UpdateTaxRuleInput;
}>, reply: FastifyReply): Promise<never>;
export declare function deleteStoreTaxRule(request: FastifyRequest<{
    Params: {
        taxRuleId: string;
    };
}>, reply: FastifyReply): Promise<never>;
export declare function searchHsn(request: FastifyRequest<{
    Querystring: HsnSearchQuery;
}>, reply: FastifyReply): Promise<never>;
export declare function getHsnCode(request: FastifyRequest<{
    Params: {
        code: string;
    };
}>, reply: FastifyReply): Promise<never>;
export declare function listCurrencies(request: FastifyRequest, reply: FastifyReply): Promise<never>;
//# sourceMappingURL=handler.d.ts.map