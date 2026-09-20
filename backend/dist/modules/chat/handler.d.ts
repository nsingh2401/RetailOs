import { FastifyRequest, FastifyReply } from 'fastify';
export declare function chat(request: FastifyRequest<{
    Params: {
        storeId: string;
    };
    Body: {
        message: string;
        conversationId?: string;
        clientDate?: string;
        timezone?: string;
    };
}>, reply: FastifyReply): Promise<never>;
export declare function getChatHistory(request: FastifyRequest<{
    Params: {
        storeId: string;
    };
    Querystring: {
        conversationId?: string;
    };
}>, reply: FastifyReply): Promise<never>;
export declare function getExcelExport(request: FastifyRequest<{
    Params: {
        storeId: string;
        filename: string;
    };
}>, reply: FastifyReply): Promise<never>;
//# sourceMappingURL=handler.d.ts.map