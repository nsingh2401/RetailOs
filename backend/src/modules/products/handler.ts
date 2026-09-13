import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../../lib/prisma';
import { cacheGet, cacheSet, cacheDelete } from '../../lib/redis';
import {
  indexProduct,
  deleteProductIndex,
  searchProducts as tsSearchProducts,
} from '../../lib/typesense';
import {
  CreateProductSchema,
  UpdateProductSchema,
  CreateVariantSchema,
  UpdateVariantSchema,
  ProductListQuerySchema,
  ProductSearchQuerySchema,
  CreateBrandSchema,
  SaveProductImageSchema,
} from './schema';

// ── Helpers ────────────────────────────────────────────────────

function isManager(role: string) {
  return role === 'OWNER' || role === 'MANAGER';
}

function canManageProduct(request: FastifyRequest): boolean {
  if (isManager(request.storeRole)) return true;
  if (request.storeRole === 'OPERATOR') {
    return request.storePermissions?.can_manage_product === true;
  }
  return false;
}

function buildBarcodeResult(variant: any, product: any, inventory: any): Record<string, unknown> {
  return {
    productId:         product.productId,
    productName:       product.name,
    variantId:         variant.variantId,
    variantSku:        variant.variantSku,
    variantAttributes: variant.variantAttributes,
    sellingPrice:      Number(variant.priceOverride ?? product.sellingPrice),
    mrp:               product.mrp ? Number(product.mrp) : null,
    pricingType:       product.pricingType,
    taxRuleId:         product.taxRuleId ?? null,
    taxRate:           product.taxRule ? Number(product.taxRule.totalRate) : null,
    taxRule:           product.taxRule ? {
      name:        product.taxRule.name,
      totalRate:   Number(product.taxRule.totalRate),
      isInclusive: product.taxRule.isInclusive,
    } : null,
    currentStock:  inventory ? Number(inventory.quantity) : 0,
    unitOfMeasure: product.unitOfMeasure,
    hsnCode:       product.hsnCode,
  };
}

async function buildIndexDoc(productId: string): Promise<Record<string, unknown> | null> {
  const p = await prisma.product.findUnique({
    where:   { productId },
    include: { category: { select: { name: true } }, brand: { select: { name: true } } },
  });
  if (!p) return null;
  return {
    productId:    p.productId,
    storeId:      p.storeId,
    name:         p.name,
    internalSku:  p.internalSku,
    ...(p.barcode        && { barcode:      p.barcode }),
    ...(p.category?.name && { categoryName: p.category.name }),
    ...(p.brand?.name    && { brandName:    p.brand.name }),
    sellingPrice: Number(p.sellingPrice),
    isActive:     p.isActive,
  };
}

// ── Product handlers ───────────────────────────────────────────

// GET /:storeId/products
export async function listProducts(
  request: FastifyRequest<{ Params: { storeId: string }; Querystring: Record<string, unknown> }>,
  reply: FastifyReply,
) {
  const { storeId } = request.params;

  const parsed = ProductListQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.message, statusCode: 400 } });
  }
  const { categoryId, brandId, pricingType, isActive, page, limit } = parsed.data;

  const where: any = {
    storeId,
    isActive,
    ...(categoryId  && { categoryId }),
    ...(brandId     && { brandId }),
    ...(pricingType && { pricingType }),
  };

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: { _count: { select: { variants: true } } },
      orderBy: { name: 'asc' },
      skip:    (page - 1) * limit,
      take:    limit,
    }),
    prisma.product.count({ where }),
  ]);

  return reply.send({
    success: true,
    data:    products,
    meta:    { page, limit, total, hasMore: page * limit < total },
  });
}

// POST /:storeId/products
export async function createProduct(
  request: FastifyRequest<{ Params: { storeId: string }; Body: unknown }>,
  reply: FastifyReply,
) {
  const { storeId } = request.params;

  if (!canManageProduct(request)) {
    return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'MANAGER or OPERATOR with product permission required', statusCode: 403 } });
  }

  const parsed = CreateProductSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.message, statusCode: 400 } });
  }
  const body = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          storeId,
          name:              body.name,
          description:       body.description,
          categoryId:        body.categoryId,
          brandId:           body.brandId,
          internalSku:       body.internalSku,
          barcode:           body.barcode,
          barcodeType:       body.barcodeType,
          hsnCode:           body.hsnCode,
          taxRuleId:         body.taxRuleId,
          pricingType:       body.pricingType,
          sellingPrice:      body.sellingPrice,
          purchasePrice:     body.purchasePrice,
          mrp:               body.mrp,
          unitOfMeasure:     body.unitOfMeasure,
          hasVariants:       body.hasVariants,
          hasBatches:        body.hasBatches,
          lowStockThreshold: body.lowStockThreshold,
          aiMetadata:        {},
        },
      });

      return { product };
    });

    // Index in Typesense (non-blocking)
    buildIndexDoc(result.product.productId).then((doc) => {
      if (doc) void indexProduct(doc);
    }).catch(() => {});

    return reply.status(201).send({ success: true, data: result });
  } catch (err: any) {
    if (err.code === 'P2002') {
      return reply.status(409).send({ success: false, error: { code: 'DUPLICATE_SKU', message: 'A product with this SKU already exists in this store', statusCode: 409 } });
    }
    throw err;
  }
}

// GET /:storeId/products/search
export async function searchProducts(
  request: FastifyRequest<{
    Params: { storeId: string };
    Querystring: Record<string, unknown>
  }>,
  reply: FastifyReply,
) {
  const { storeId } = request.params;
  const parsed =
      ProductSearchQuerySchema.safeParse(
        request.query);
  if (!parsed.success) {
    return reply.status(400).send({
      success: false,
      error: {
        code:       'VALIDATION_ERROR',
        message:    parsed.error.message,
        statusCode: 400,
      },
    });
  }
  const { q, limit } = parsed.data;

  try {
    const hits = await tsSearchProducts(
        storeId, q, limit);
    // Typesense available — enrich with
    // default variantId
    const products = hits.map(
        (h: any) => h.document);
    const enriched = await Promise.all(
      products.map(async (p: any) => {
        const [variant, product] =
            await Promise.all([
          prisma.productVariant.findFirst({
            where: {
              productId: p.productId,
              storeId,
              isActive: true,
            },
            select: {
              variantId:         true,
              variantAttributes: true,
            },
          }),
          prisma.product.findUnique({
            where:  { productId: p.productId },
            select: {
              pricingType: true,
              taxRuleId:   true,
              taxRule: {
                select: { totalRate: true },
              },
            },
          }),
        ]);
        return {
          ...p,
          variantId:         variant?.variantId ?? null,
          variantAttributes: variant?.variantAttributes ?? null,
          pricingType: product?.pricingType ?? 'FIXED',
          taxRuleId:   product?.taxRuleId  ?? null,
          taxRate:     product?.taxRule
              ? Number(product.taxRule.totalRate)
              : null,
        };
      }),
    );
    if (enriched.length > 0) {
      console.log('[searchProducts/ts] first row keys:', Object.keys(enriched[0]));
      console.log('[searchProducts/ts] first row:', JSON.stringify(enriched[0]));
    }
    return reply.send({
      success: true,
      data: enriched,
    });
  } catch {
    // Fallback to PostgreSQL if Typesense
    // unavailable
    const rawProducts =
        await prisma.$queryRaw<any[]>`
      SELECT
        p.product_id      AS "productId",
        p.name,
        p.internal_sku    AS "internalSku",
        p.hsn_code        AS "hsnCode",
        p.selling_price   AS "sellingPrice",
        p.mrp,
        p.tax_rule_id     AS "taxRuleId",
        p.unit_of_measure AS "unitOfMeasure",
        p.pricing_type    AS "pricingType",
        tr.total_rate     AS "taxRate",
        (SELECT pv.variant_id
         FROM product_variants pv
         WHERE pv.product_id = p.product_id
           AND pv.store_id = ${storeId}::uuid
           AND pv.is_active = true
         LIMIT 1) AS "variantId",
        (SELECT pv.variant_attributes
         FROM product_variants pv
         WHERE pv.product_id = p.product_id
           AND pv.store_id = ${storeId}::uuid
           AND pv.is_active = true
         LIMIT 1) AS "variantAttributes"
      FROM products p
      LEFT JOIN tax_rules tr
        ON tr.tax_rule_id = p.tax_rule_id
      WHERE p.store_id = ${storeId}::uuid
        AND p.is_active = true
        AND (
          p.name         ILIKE ${'%' + q + '%'}
          OR p.internal_sku ILIKE ${'%' + q + '%'}
        )
      ORDER BY p.name ASC
      LIMIT ${limit}
    `;
    const products = rawProducts;
    if (products.length > 0) {
      console.log('[searchProducts] first row keys:', Object.keys(products[0]));
      console.log('[searchProducts] first row:', JSON.stringify(products[0]));
    }

    return reply.send({
      success: true,
      data: products,
    });
  }
}

// GET /:storeId/products/barcode/:code  — CRITICAL PATH
export async function lookupByBarcode(
  request: FastifyRequest<{ Params: { storeId: string; code: string } }>,
  reply: FastifyReply,
) {
  const { storeId, code } = request.params;
  const cacheKey = `barcode:${storeId}:${code}`;

  // 1. Redis cache
  const cached = await cacheGet<Record<string, unknown>>(cacheKey);
  if (cached) return reply.send({ success: true, data: cached });

  // 2. Variant-level barcode
  const variant = await prisma.productVariant.findFirst({
    where:   { barcode: code, storeId, isActive: true },
    include: {
      product: { include: { taxRule: true } },
    },
  });

  let result: Record<string, unknown> | null = null;

  if (variant) {
    const inventory = await prisma.inventory.findUnique({
      where: { storeId_variantId: { storeId, variantId: variant.variantId } },
    });
    result = buildBarcodeResult(variant, variant.product, inventory);
  } else {
    // 3. Product-level barcode fallback
    const product = await prisma.product.findFirst({
      where:   { barcode: code, storeId, isActive: true },
      include: {
        taxRule:  true,
        variants: { where: { isActive: true }, take: 1 },
      },
    });

    if (product && product.variants.length > 0) {
      const firstVariant = product.variants[0];
      const inventory = await prisma.inventory.findUnique({
        where: { storeId_variantId: { storeId, variantId: firstVariant.variantId } },
      });
      result = buildBarcodeResult(firstVariant, product, inventory);
    }
  }

  if (!result) {
    return reply.status(404).send({
      success: false,
      error: { code: 'PRODUCT_NOT_FOUND', message: `No product found for barcode ${code}`, statusCode: 404 },
    });
  }

  // 4. Cache 5 min
  await cacheSet(cacheKey, result, 300);
  return reply.send({ success: true, data: result });
}

// GET /:storeId/products/:productId
export async function getProduct(
  request: FastifyRequest<{ Params: { storeId: string; productId: string } }>,
  reply: FastifyReply,
) {
  const { storeId, productId } = request.params;

  const product = await prisma.product.findFirst({
    where:   { productId, storeId, isActive: true },
    include: {
      variants:  { where: { isActive: true } },
      images:    true,
      category:  { select: { categoryId: true, name: true } },
      brand:     { select: { brandId: true, name: true } },
      taxRule:   { select: { taxRuleId: true, name: true, totalRate: true, isInclusive: true } },
    },
  });

  if (!product) {
    return reply.status(404).send({ success: false, error: { code: 'PRODUCT_NOT_FOUND', message: 'Product not found', statusCode: 404 } });
  }

  return reply.send({ success: true, data: product });
}

// PATCH /:storeId/products/:productId
export async function updateProduct(
  request: FastifyRequest<{ Params: { storeId: string; productId: string }; Body: unknown }>,
  reply: FastifyReply,
) {
  const { storeId, productId } = request.params;

  if (!canManageProduct(request)) {
    return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'MANAGER or OPERATOR with product permission required', statusCode: 403 } });
  }

  const parsed = UpdateProductSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.message, statusCode: 400 } });
  }
  const body = parsed.data;

  // Ensure product belongs to this store
  const existing = await prisma.product.findFirst({ where: { productId, storeId } });
  if (!existing) {
    return reply.status(404).send({ success: false, error: { code: 'PRODUCT_NOT_FOUND', message: 'Product not found', statusCode: 404 } });
  }

  try {
    const product = await prisma.product.update({
      where: { productId },
      data:  {
        ...(body.name              !== undefined && { name:              body.name }),
        ...(body.description       !== undefined && { description:       body.description }),
        ...(body.categoryId        !== undefined && { categoryId:        body.categoryId }),
        ...(body.brandId           !== undefined && { brandId:           body.brandId }),
        ...(body.internalSku       !== undefined && { internalSku:       body.internalSku }),
        ...(body.barcode           !== undefined && { barcode:           body.barcode }),
        ...(body.barcodeType       !== undefined && { barcodeType:       body.barcodeType }),
        ...(body.hsnCode           !== undefined && { hsnCode:           body.hsnCode }),
        ...(body.taxRuleId         !== undefined && { taxRuleId:         body.taxRuleId }),
        ...(body.pricingType       !== undefined && { pricingType:       body.pricingType }),
        ...(body.sellingPrice      !== undefined && { sellingPrice:      body.sellingPrice }),
        ...(body.purchasePrice     !== undefined && { purchasePrice:     body.purchasePrice }),
        ...(body.mrp               !== undefined && { mrp:               body.mrp }),
        ...(body.unitOfMeasure     !== undefined && { unitOfMeasure:     body.unitOfMeasure }),
        ...(body.hasVariants       !== undefined && { hasVariants:       body.hasVariants }),
        ...(body.hasBatches        !== undefined && { hasBatches:        body.hasBatches }),
        ...(body.lowStockThreshold !== undefined && { lowStockThreshold: body.lowStockThreshold }),
      },
    });

    // Re-index
    buildIndexDoc(productId).then((doc) => {
      if (doc) void indexProduct(doc);
    }).catch(() => {});

    return reply.send({ success: true, data: product });
  } catch (err: any) {
    if (err.code === 'P2002') {
      return reply.status(409).send({ success: false, error: { code: 'DUPLICATE_SKU', message: 'SKU already exists', statusCode: 409 } });
    }
    throw err;
  }
}

// DELETE /:storeId/products/:productId
export async function deleteProduct(
  request: FastifyRequest<{ Params: { storeId: string; productId: string } }>,
  reply: FastifyReply,
) {
  const { storeId, productId } = request.params;

  if (!canManageProduct(request)) {
    return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'MANAGER or OPERATOR with product permission required', statusCode: 403 } });
  }

  const existing = await prisma.product.findFirst({ where: { productId, storeId } });
  if (!existing) {
    return reply.status(404).send({ success: false, error: { code: 'PRODUCT_NOT_FOUND', message: 'Product not found', statusCode: 404 } });
  }

  await prisma.product.update({
    where: { productId },
    data:  { isActive: false },
  });

  // Remove from Typesense (non-blocking)
  void deleteProductIndex(productId);

  return reply.send({ success: true, data: { productId, deleted: true } });
}

// ── Variant handlers ───────────────────────────────────────────

// POST /:storeId/products/:productId/variants
export async function createVariant(
  request: FastifyRequest<{ Params: { storeId: string; productId: string }; Body: unknown }>,
  reply: FastifyReply,
) {
  const { storeId, productId } = request.params;

  if (!canManageProduct(request)) {
    return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'MANAGER or OPERATOR with product permission required', statusCode: 403 } });
  }

  const parsed = CreateVariantSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.message, statusCode: 400 } });
  }
  const body = parsed.data;

  const product = await prisma.product.findFirst({ where: { productId, storeId, isActive: true } });
  if (!product) {
    return reply.status(404).send({ success: false, error: { code: 'PRODUCT_NOT_FOUND', message: 'Product not found', statusCode: 404 } });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const variant = await tx.productVariant.create({
        data: {
          productId,
          storeId,
          variantSku:        body.variantSku,
          barcode:           body.barcode,
          variantAttributes: body.variantAttributes,
          priceOverride:     body.priceOverride,
          purchasePrice:     body.purchasePrice,
          stockQuantity:     body.initialStock,
        },
      });

      const inventory = await tx.inventory.create({
        data: { storeId, variantId: variant.variantId, quantity: body.initialStock },
      });

      if (body.initialStock > 0) {
        await tx.inventoryMovement.create({
          data: {
            storeId,
            variantId:      variant.variantId,
            movementType:   'PURCHASE',
            quantityDelta:  body.initialStock,
            quantityBefore: 0,
            quantityAfter:  body.initialStock,
            performedBy:    request.authUser.userId,
            referenceType:  'VARIANT_CREATION',
          },
        });
      }

      return { variant, inventory };
    });

    return reply.status(201).send({ success: true, data: result });
  } catch (err: any) {
    if (err.code === 'P2002') {
      return reply.status(409).send({ success: false, error: { code: 'DUPLICATE_SKU', message: 'Variant SKU already exists in this store', statusCode: 409 } });
    }
    throw err;
  }
}

// PATCH /:storeId/products/:productId/variants/:variantId
export async function updateVariant(
  request: FastifyRequest<{ Params: { storeId: string; productId: string; variantId: string }; Body: unknown }>,
  reply: FastifyReply,
) {
  const { storeId, productId, variantId } = request.params;

  if (!canManageProduct(request)) {
    return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'MANAGER or OPERATOR with product permission required', statusCode: 403 } });
  }

  const parsed = UpdateVariantSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.message, statusCode: 400 } });
  }
  const body = parsed.data;

  const existing = await prisma.productVariant.findFirst({
    where: { variantId, productId, storeId, isActive: true },
  });
  if (!existing) {
    return reply.status(404).send({ success: false, error: { code: 'VARIANT_NOT_FOUND', message: 'Variant not found', statusCode: 404 } });
  }

  // Invalidate old barcode cache if barcode is changing
  if (body.barcode !== undefined && existing.barcode && body.barcode !== existing.barcode) {
    await cacheDelete(`barcode:${storeId}:${existing.barcode}`);
  }
  // Invalidate new barcode cache too (stale data may exist)
  if (body.barcode) {
    await cacheDelete(`barcode:${storeId}:${body.barcode}`);
  }

  try {
    const variant = await prisma.productVariant.update({
      where: { variantId },
      data:  {
        ...(body.variantSku        !== undefined && { variantSku:        body.variantSku }),
        ...(body.barcode           !== undefined && { barcode:           body.barcode }),
        ...(body.variantAttributes !== undefined && { variantAttributes: body.variantAttributes }),
        ...(body.priceOverride     !== undefined && { priceOverride:     body.priceOverride }),
        ...(body.purchasePrice     !== undefined && { purchasePrice:     body.purchasePrice }),
      },
    });

    return reply.send({ success: true, data: variant });
  } catch (err: any) {
    if (err.code === 'P2002') {
      return reply.status(409).send({ success: false, error: { code: 'DUPLICATE_SKU', message: 'Variant SKU already exists', statusCode: 409 } });
    }
    throw err;
  }
}

// ── Category handlers ──────────────────────────────────────────

// GET /:storeId/categories
export async function listCategories(
  request: FastifyRequest<{ Params: { storeId: string } }>,
  reply: FastifyReply,
) {
  const { storeId } = request.params;
  const cacheKey = `categories:${storeId}`;

  const cached = await cacheGet<unknown[]>(cacheKey);
  if (cached) return reply.send({ success: true, data: cached });

  const allCategories = await prisma.category.findMany({
    where:   { storeId, isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });

  // Build tree in code
  type CatNode = typeof allCategories[0] & { children: CatNode[] };
  const map    = new Map<string, CatNode>();
  const roots: CatNode[] = [];

  for (const cat of allCategories) {
    map.set(cat.categoryId, { ...cat, children: [] });
  }
  for (const cat of allCategories) {
    const node = map.get(cat.categoryId)!;
    if (cat.parentId) {
      const parent = map.get(cat.parentId);
      if (parent) parent.children.push(node);
      else        roots.push(node);      // orphaned — surface as root
    } else {
      roots.push(node);
    }
  }

  await cacheSet(cacheKey, roots, 600);
  return reply.send({ success: true, data: roots });
}

// POST /:storeId/categories
export async function createCategory(
  request: FastifyRequest<{ Params: { storeId: string }; Body: unknown }>,
  reply: FastifyReply,
) {
  const { storeId } = request.params;

  if (!isManager(request.storeRole)) {
    return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'OWNER or MANAGER required', statusCode: 403 } });
  }

  const body = request.body as { name?: string; parentId?: string } | null;
  const name = body?.name?.trim();
  if (!name) {
    return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: 'name is required', statusCode: 400 } });
  }

  // Derive industry type from store
  const store = await prisma.store.findUnique({
    where:  { storeId },
    select: { industryType: true },
  });

  try {
    const category = await prisma.category.create({
      data: {
        storeId,
        name,
        parentId:         body?.parentId ?? null,
        isCustom:         true,
        masterCategoryId: null,
        industryType:     store?.industryType ?? null,
        isActive:         true,
      },
    });

    await cacheDelete(`categories:${storeId}`);
    return reply.status(201).send({ success: true, data: category });
  } catch (err: any) {
    if (err.code === 'P2002') {
      return reply.status(409).send({ success: false, error: { code: 'DUPLICATE_CATEGORY', message: 'A category with this name already exists in this parent', statusCode: 409 } });
    }
    throw err;
  }
}

// PATCH /:storeId/categories/:categoryId
export async function updateCategory(
  request: FastifyRequest<{
    Params: { storeId: string; categoryId: string };
    Body:   unknown;
  }>,
  reply: FastifyReply,
) {
  const { storeId, categoryId } = request.params;

  if (!isManager(request.storeRole)) {
    return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'OWNER or MANAGER required', statusCode: 403 } });
  }

  const body = request.body as { name?: string } | null;
  const name = body?.name?.trim();
  if (!name) {
    return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: 'name is required', statusCode: 400 } });
  }

  const existing = await prisma.category.findFirst({ where: { categoryId, storeId } });
  if (!existing) {
    return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Category not found', statusCode: 404 } });
  }
  if (!existing.isCustom) {
    return reply.status(403).send({ success: false, error: { code: 'CANNOT_EDIT_MASTER', message: 'Master categories cannot be renamed', statusCode: 403 } });
  }

  try {
    const updated = await prisma.category.update({
      where: { categoryId },
      data:  { name },
    });
    await cacheDelete(`categories:${storeId}`);
    return reply.send({ success: true, data: updated });
  } catch (err: any) {
    if (err.code === 'P2002') {
      return reply.status(409).send({ success: false, error: { code: 'DUPLICATE_CATEGORY', message: 'A category with this name already exists', statusCode: 409 } });
    }
    throw err;
  }
}

// DELETE /:storeId/categories/:categoryId
export async function deleteCategory(
  request: FastifyRequest<{ Params: { storeId: string; categoryId: string } }>,
  reply: FastifyReply,
) {
  const { storeId, categoryId } = request.params;

  if (!isManager(request.storeRole)) {
    return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'OWNER or MANAGER required', statusCode: 403 } });
  }

  const existing = await prisma.category.findFirst({
    where:   { categoryId, storeId },
    include: { _count: { select: { products: true, children: true } } },
  });
  if (!existing) {
    return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Category not found', statusCode: 404 } });
  }
  if (!existing.isCustom) {
    return reply.status(403).send({ success: false, error: { code: 'CANNOT_DELETE_MASTER', message: 'Master categories cannot be deleted', statusCode: 403 } });
  }
  if (existing._count.products > 0) {
    return reply.status(409).send({ success: false, error: { code: 'CATEGORY_HAS_PRODUCTS', message: `Cannot delete: ${existing._count.products} product(s) still assigned to this category`, statusCode: 409 } });
  }
  if (existing._count.children > 0) {
    return reply.status(409).send({ success: false, error: { code: 'CATEGORY_HAS_CHILDREN', message: 'Cannot delete: category has sub-categories. Delete them first.', statusCode: 409 } });
  }

  await prisma.category.delete({ where: { categoryId } });
  await cacheDelete(`categories:${storeId}`);
  return reply.send({ success: true, data: { deleted: true } });
}

// ── Brand handlers ─────────────────────────────────────────────

// GET /:storeId/brands
export async function listBrands(
  request: FastifyRequest<{ Params: { storeId: string } }>,
  reply: FastifyReply,
) {
  const { storeId } = request.params;

  const brands = await prisma.brand.findMany({
    where:   { storeId, isActive: true },
    orderBy: { name: 'asc' },
  });

  return reply.send({ success: true, data: brands });
}

// POST /:storeId/brands
export async function createBrand(
  request: FastifyRequest<{ Params: { storeId: string }; Body: unknown }>,
  reply: FastifyReply,
) {
  const { storeId } = request.params;

  if (!canManageProduct(request)) {
    return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'MANAGER or OPERATOR with product permission required', statusCode: 403 } });
  }

  const parsed = CreateBrandSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.message, statusCode: 400 } });
  }
  const body = parsed.data;

  try {
    const brand = await prisma.brand.create({
      data: {
        storeId,
        name:         body.name,
        manufacturer: body.manufacturer,
        contactInfo:  body.contactInfo,
      },
    });

    return reply.status(201).send({ success: true, data: brand });
  } catch (err: any) {
    if (err.code === 'P2002') {
      return reply.status(409).send({ success: false, error: { code: 'DUPLICATE_BRAND', message: 'Brand with this name already exists in this store', statusCode: 409 } });
    }
    throw err;
  }
}

// ── Image handler ──────────────────────────────────────────────

// POST /:storeId/products/:productId/images
export async function saveProductImage(
  request: FastifyRequest<{ Params: { storeId: string; productId: string }; Body: unknown }>,
  reply: FastifyReply,
) {
  const { storeId, productId } = request.params;

  const parsed = SaveProductImageSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.message, statusCode: 400 } });
  }
  const body = parsed.data;

  const product = await prisma.product.findFirst({ where: { productId, storeId, isActive: true } });
  if (!product) {
    return reply.status(404).send({ success: false, error: { code: 'PRODUCT_NOT_FOUND', message: 'Product not found', statusCode: 404 } });
  }

  const image = await prisma.productImage.create({
    data: {
      productId,
      storeId,
      imageUrl:      body.imageUrl,
      thumbnailUrl:  body.thumbnailUrl,
      isPrimary:     body.isPrimary,
      cameraAngle:   body.cameraAngle,
      lighting:      body.lighting,
      captureDevice: body.captureDevice,
    },
  });

  return reply.status(201).send({ success: true, data: image });
}
