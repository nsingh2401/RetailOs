import { FastifyRequest, FastifyReply } from 'fastify';
export declare function listProducts(request: FastifyRequest<{
    Params: {
        storeId: string;
    };
    Querystring: Record<string, unknown>;
}>, reply: FastifyReply): Promise<never>;
export declare function createProduct(request: FastifyRequest<{
    Params: {
        storeId: string;
    };
    Body: unknown;
}>, reply: FastifyReply): Promise<never>;
export declare function searchProducts(request: FastifyRequest<{
    Params: {
        storeId: string;
    };
    Querystring: Record<string, unknown>;
}>, reply: FastifyReply): Promise<never>;
export declare function lookupByBarcode(request: FastifyRequest<{
    Params: {
        storeId: string;
        code: string;
    };
}>, reply: FastifyReply): Promise<never>;
export declare function getProduct(request: FastifyRequest<{
    Params: {
        storeId: string;
        productId: string;
    };
}>, reply: FastifyReply): Promise<never>;
export declare function updateProduct(request: FastifyRequest<{
    Params: {
        storeId: string;
        productId: string;
    };
    Body: unknown;
}>, reply: FastifyReply): Promise<never>;
export declare function deleteProduct(request: FastifyRequest<{
    Params: {
        storeId: string;
        productId: string;
    };
}>, reply: FastifyReply): Promise<never>;
export declare function createVariant(request: FastifyRequest<{
    Params: {
        storeId: string;
        productId: string;
    };
    Body: unknown;
}>, reply: FastifyReply): Promise<never>;
export declare function updateVariant(request: FastifyRequest<{
    Params: {
        storeId: string;
        productId: string;
        variantId: string;
    };
    Body: unknown;
}>, reply: FastifyReply): Promise<never>;
export declare function listCategories(request: FastifyRequest<{
    Params: {
        storeId: string;
    };
}>, reply: FastifyReply): Promise<never>;
export declare function createCategory(request: FastifyRequest<{
    Params: {
        storeId: string;
    };
    Body: unknown;
}>, reply: FastifyReply): Promise<never>;
export declare function updateCategory(request: FastifyRequest<{
    Params: {
        storeId: string;
        categoryId: string;
    };
    Body: unknown;
}>, reply: FastifyReply): Promise<never>;
export declare function deleteCategory(request: FastifyRequest<{
    Params: {
        storeId: string;
        categoryId: string;
    };
}>, reply: FastifyReply): Promise<never>;
export declare function listBrands(request: FastifyRequest<{
    Params: {
        storeId: string;
    };
}>, reply: FastifyReply): Promise<never>;
export declare function createBrand(request: FastifyRequest<{
    Params: {
        storeId: string;
    };
    Body: unknown;
}>, reply: FastifyReply): Promise<never>;
export declare function saveProductImage(request: FastifyRequest<{
    Params: {
        storeId: string;
        productId: string;
    };
    Body: unknown;
}>, reply: FastifyReply): Promise<never>;
//# sourceMappingURL=handler.d.ts.map