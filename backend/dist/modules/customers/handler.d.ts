import { FastifyRequest, FastifyReply } from 'fastify';
import type { CreateCustomerInput, UpdateCustomerInput, CustomerSearchQuery, CustomerListQuery, RecordCreditPaymentInput, CreditLedgerQuery } from './schema';
export declare function listCustomers(request: FastifyRequest<{
    Params: {
        storeId: string;
    };
    Querystring: CustomerListQuery;
}>, reply: FastifyReply): Promise<never>;
export declare function createCustomer(request: FastifyRequest<{
    Params: {
        storeId: string;
    };
    Body: CreateCustomerInput;
}>, reply: FastifyReply): Promise<never>;
export declare function searchCustomers(request: FastifyRequest<{
    Params: {
        storeId: string;
    };
    Querystring: CustomerSearchQuery;
}>, reply: FastifyReply): Promise<never>;
export declare function getOutstandingCustomers(request: FastifyRequest<{
    Params: {
        storeId: string;
    };
}>, reply: FastifyReply): Promise<never>;
export declare function getCustomer(request: FastifyRequest<{
    Params: {
        storeId: string;
        customerId: string;
    };
}>, reply: FastifyReply): Promise<never>;
export declare function updateCustomer(request: FastifyRequest<{
    Params: {
        storeId: string;
        customerId: string;
    };
    Body: UpdateCustomerInput;
}>, reply: FastifyReply): Promise<never>;
export declare function getCreditLedger(request: FastifyRequest<{
    Params: {
        storeId: string;
        customerId: string;
    };
    Querystring: CreditLedgerQuery;
}>, reply: FastifyReply): Promise<never>;
export declare function recordCreditPayment(request: FastifyRequest<{
    Params: {
        storeId: string;
        customerId: string;
    };
    Body: RecordCreditPaymentInput;
}>, reply: FastifyReply): Promise<never>;
//# sourceMappingURL=handler.d.ts.map