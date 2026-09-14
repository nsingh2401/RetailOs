import { FastifyRequest, FastifyReply } from 'fastify';
import type { RequestUploadUrlInput, ConfirmUploadInput, ConfirmUploadQuery } from './schema';
export declare function requestUploadUrl(request: FastifyRequest<{
    Params: {
        storeId: string;
    };
    Body: RequestUploadUrlInput;
}>, reply: FastifyReply): Promise<never>;
export declare function confirmUpload(request: FastifyRequest<{
    Params: {
        storeId: string;
    };
    Body: ConfirmUploadInput;
    Querystring: ConfirmUploadQuery;
}>, reply: FastifyReply): Promise<never>;
export declare function uploadProductImageDirect(request: FastifyRequest<{
    Params: {
        storeId: string;
    };
}>, reply: FastifyReply): Promise<never>;
export declare function getUploadHistory(request: FastifyRequest<{
    Params: {
        storeId: string;
        productId: string;
    };
}>, reply: FastifyReply): Promise<never>;
//# sourceMappingURL=handler.d.ts.map