import type { CollectionCreateSchema } from 'typesense/lib/Typesense/Collections';
export declare const typesense: import("typesense").Client;
export declare const PRODUCTS_SCHEMA: CollectionCreateSchema;
export declare const CUSTOMERS_SCHEMA: CollectionCreateSchema;
export declare function ensureCollections(): Promise<void>;
export declare function indexProduct(product: Record<string, unknown>): Promise<void>;
export declare function deleteProductIndex(productId: string): Promise<void>;
export declare function searchProducts(storeId: string, q: string, limit: number): Promise<import("typesense/lib/Typesense/Documents").SearchResponseHit<object>[]>;
export declare function indexCustomer(customer: Record<string, unknown>): Promise<void>;
export declare function searchCustomers(storeId: string, q: string, limit: number): Promise<import("typesense/lib/Typesense/Documents").SearchResponseHit<object>[]>;
export default typesense;
//# sourceMappingURL=typesense.d.ts.map