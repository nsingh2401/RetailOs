import { FastifyRequest, FastifyReply } from 'fastify';
import type { CreateInvoiceInput, RecordPaymentInput, InvoiceListQuery, CancelInvoiceInput } from './schema';
export declare function createInvoice(request: FastifyRequest<{
    Params: {
        storeId: string;
    };
    Body: CreateInvoiceInput;
}>, reply: FastifyReply): Promise<never>;
export declare function confirmInvoice(request: FastifyRequest<{
    Params: {
        storeId: string;
        invoiceId: string;
    };
}>, reply: FastifyReply): Promise<never>;
export declare function recordPayment(request: FastifyRequest<{
    Params: {
        storeId: string;
        invoiceId: string;
    };
    Body: RecordPaymentInput;
}>, reply: FastifyReply): Promise<never>;
export declare function listInvoices(request: FastifyRequest<{
    Params: {
        storeId: string;
    };
    Querystring: InvoiceListQuery;
}>, reply: FastifyReply): Promise<never>;
export declare function getInvoice(request: FastifyRequest<{
    Params: {
        storeId: string;
        invoiceId: string;
    };
}>, reply: FastifyReply): Promise<never>;
export declare function cancelInvoice(request: FastifyRequest<{
    Params: {
        storeId: string;
        invoiceId: string;
    };
    Body: CancelInvoiceInput;
}>, reply: FastifyReply): Promise<never>;
//# sourceMappingURL=handler.d.ts.map