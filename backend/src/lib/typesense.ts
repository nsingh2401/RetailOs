import Typesense from 'typesense';
import type { CollectionCreateSchema } from 'typesense/lib/Typesense/Collections';

export const typesense = new Typesense.Client({
  nodes: [{
    host:     process.env.TYPESENSE_HOST!,
    port:     Number(process.env.TYPESENSE_PORT ?? 8108),
    protocol: process.env.TYPESENSE_PROTOCOL ?? 'http',
  }],
  apiKey:                   process.env.TYPESENSE_API_KEY!,
  connectionTimeoutSeconds: 5,
});

// ── Collection schemas ─────────────────────────────────────────

export const PRODUCTS_SCHEMA: CollectionCreateSchema = {
  name: 'products',
  fields: [
    { name: 'id',           type: 'string' },
    { name: 'storeId',      type: 'string', facet: true },
    { name: 'name',         type: 'string' },
    { name: 'internalSku',  type: 'string' },
    { name: 'barcode',      type: 'string', optional: true },
    { name: 'categoryName', type: 'string', optional: true },
    { name: 'brandName',    type: 'string', optional: true },
    { name: 'sellingPrice', type: 'float' },
    { name: 'isActive',     type: 'bool',   facet: true },
  ],
};

export const CUSTOMERS_SCHEMA: CollectionCreateSchema = {
  name: 'customers',
  fields: [
    { name: 'id',       type: 'string' },
    { name: 'storeId',  type: 'string', facet: true },
    { name: 'name',     type: 'string' },
    { name: 'phone',    type: 'string', optional: true },
    { name: 'email',    type: 'string', optional: true },
    { name: 'isActive', type: 'bool',   facet: true },
  ],
};

// ── Startup — call once from server.ts ─────────────────────────

export async function ensureCollections(): Promise<void> {
  for (const schema of [PRODUCTS_SCHEMA, CUSTOMERS_SCHEMA]) {
    try {
      await typesense.collections(schema.name).retrieve();
      console.log(`Typesense: collection '${schema.name}' exists`);
    } catch (err: any) {
      if (err?.httpStatus === 404 || err?.name === 'ObjectNotFound') {
        await typesense.collections().create(schema);
        console.log(`Typesense: collection '${schema.name}' created`);
      } else {
        console.error(`Typesense: failed to ensure '${schema.name}':`, err?.message);
      }
    }
  }
}

// ── Products ───────────────────────────────────────────────────

export async function indexProduct(product: Record<string, unknown>): Promise<void> {
  try {
    await typesense.collections('products').documents().upsert({
      ...product,
      id: product['productId'] as string,
    });
  } catch (err: any) {
    console.error('Typesense indexProduct error:', err?.message);
  }
}

export async function deleteProductIndex(productId: string): Promise<void> {
  try {
    await typesense.collections('products').documents(productId).delete();
  } catch (err: any) {
    console.error('Typesense deleteProductIndex error:', err?.message);
  }
}

export async function searchProducts(storeId: string, q: string, limit: number) {
  const result = await typesense.collections('products').documents().search({
    q,
    query_by:  'name,internalSku,barcode',
    filter_by: `storeId:=${storeId} && isActive:=true`,
    per_page:  limit,
  });
  return result.hits ?? [];
}

// ── Customers ──────────────────────────────────────────────────

export async function indexCustomer(customer: Record<string, unknown>): Promise<void> {
  try {
    await typesense.collections('customers').documents().upsert({
      ...customer,
      id: customer['customerId'] as string,
    });
  } catch (err: any) {
    console.error('Typesense indexCustomer error:', err?.message);
  }
}

export async function searchCustomers(storeId: string, q: string, limit: number) {
  const result = await typesense.collections('customers').documents().search({
    q,
    query_by:  'name,phone,email',
    filter_by: `storeId:=${storeId} && isActive:=true`,
    per_page:  limit,
  });
  return result.hits ?? [];
}

export default typesense;
