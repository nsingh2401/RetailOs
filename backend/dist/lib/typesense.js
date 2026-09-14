"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CUSTOMERS_SCHEMA = exports.PRODUCTS_SCHEMA = exports.typesense = void 0;
exports.ensureCollections = ensureCollections;
exports.indexProduct = indexProduct;
exports.deleteProductIndex = deleteProductIndex;
exports.searchProducts = searchProducts;
exports.indexCustomer = indexCustomer;
exports.searchCustomers = searchCustomers;
const typesense_1 = __importDefault(require("typesense"));
exports.typesense = new typesense_1.default.Client({
    nodes: [{
            host: process.env.TYPESENSE_HOST,
            port: Number(process.env.TYPESENSE_PORT ?? 8108),
            protocol: process.env.TYPESENSE_PROTOCOL ?? 'http',
        }],
    apiKey: process.env.TYPESENSE_API_KEY,
    connectionTimeoutSeconds: 5,
});
// ── Collection schemas ─────────────────────────────────────────
exports.PRODUCTS_SCHEMA = {
    name: 'products',
    fields: [
        { name: 'id', type: 'string' },
        { name: 'storeId', type: 'string', facet: true },
        { name: 'name', type: 'string' },
        { name: 'internalSku', type: 'string' },
        { name: 'barcode', type: 'string', optional: true },
        { name: 'categoryName', type: 'string', optional: true },
        { name: 'brandName', type: 'string', optional: true },
        { name: 'sellingPrice', type: 'float' },
        { name: 'isActive', type: 'bool', facet: true },
    ],
};
exports.CUSTOMERS_SCHEMA = {
    name: 'customers',
    fields: [
        { name: 'id', type: 'string' },
        { name: 'storeId', type: 'string', facet: true },
        { name: 'name', type: 'string' },
        { name: 'phone', type: 'string', optional: true },
        { name: 'email', type: 'string', optional: true },
        { name: 'isActive', type: 'bool', facet: true },
    ],
};
// ── Startup — call once from server.ts ─────────────────────────
async function ensureCollections() {
    for (const schema of [exports.PRODUCTS_SCHEMA, exports.CUSTOMERS_SCHEMA]) {
        try {
            await exports.typesense.collections(schema.name).retrieve();
            console.log(`Typesense: collection '${schema.name}' exists`);
        }
        catch (err) {
            if (err?.httpStatus === 404 || err?.name === 'ObjectNotFound') {
                await exports.typesense.collections().create(schema);
                console.log(`Typesense: collection '${schema.name}' created`);
            }
            else {
                console.error(`Typesense: failed to ensure '${schema.name}':`, err?.message);
            }
        }
    }
}
// ── Products ───────────────────────────────────────────────────
async function indexProduct(product) {
    try {
        await exports.typesense.collections('products').documents().upsert({
            ...product,
            id: product['productId'],
        });
    }
    catch (err) {
        console.error('Typesense indexProduct error:', err?.message);
    }
}
async function deleteProductIndex(productId) {
    try {
        await exports.typesense.collections('products').documents(productId).delete();
    }
    catch (err) {
        console.error('Typesense deleteProductIndex error:', err?.message);
    }
}
async function searchProducts(storeId, q, limit) {
    const result = await exports.typesense.collections('products').documents().search({
        q,
        query_by: 'name,internalSku,barcode',
        filter_by: `storeId:=${storeId} && isActive:=true`,
        per_page: limit,
    });
    return result.hits ?? [];
}
// ── Customers ──────────────────────────────────────────────────
async function indexCustomer(customer) {
    try {
        await exports.typesense.collections('customers').documents().upsert({
            ...customer,
            id: customer['customerId'],
        });
    }
    catch (err) {
        console.error('Typesense indexCustomer error:', err?.message);
    }
}
async function searchCustomers(storeId, q, limit) {
    const result = await exports.typesense.collections('customers').documents().search({
        q,
        query_by: 'name,phone,email',
        filter_by: `storeId:=${storeId} && isActive:=true`,
        per_page: limit,
    });
    return result.hits ?? [];
}
exports.default = exports.typesense;
//# sourceMappingURL=typesense.js.map