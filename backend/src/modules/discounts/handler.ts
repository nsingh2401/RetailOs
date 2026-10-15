import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { searchProducts as tsSearchProducts } from '../../lib/typesense';

// ── Helpers ────────────────────────────────────────────────────

function isManager(role: string) {
  return role === 'OWNER' || role === 'MANAGER';
}

// ── Schemas ────────────────────────────────────────────────────

const DiscountRuleSchema = z.object({
  type:               z.enum(['PRODUCT', 'CATEGORY', 'LOYALTY', 'FESTIVE']),
  name:               z.string().min(1).max(200),
  discountType:       z.enum(['PERCENTAGE', 'FIXED']),
  discountValue:      z.number().positive(),
  minPurchaseAmount:  z.number().nonnegative().optional(),
  productId:          z.string().uuid().optional(),
  categoryId:         z.string().uuid().optional(),
  startDate:          z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate:            z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  isActive:           z.boolean().optional(),
});

const UpdateDiscountRuleSchema = DiscountRuleSchema.partial();

// ── GET /:storeId/discounts ────────────────────────────────────
export async function listDiscounts(
  request: FastifyRequest<{ Params: { storeId: string }; Querystring: Record<string, unknown> }>,
  reply: FastifyReply,
) {
  const storeId = request.storeId;
  const type    = request.query['type'] as string | undefined;

  const rules = await prisma.discountRule.findMany({
    where: {
      storeId,
      ...(type ? { type: type as any } : {}),
    },
    include: {
      product:  { select: { productId: true, name: true, internalSku: true } },
      category: { select: { categoryId: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return reply.send({ success: true, data: rules });
}

// ── POST /:storeId/discounts ───────────────────────────────────
export async function createDiscount(
  request: FastifyRequest<{ Params: { storeId: string }; Body: unknown }>,
  reply: FastifyReply,
) {
  const storeId = request.storeId;

  if (!isManager(request.storeRole)) {
    return reply.status(403).send({
      success: false,
      error: { code: 'FORBIDDEN', message: 'MANAGER role required', statusCode: 403 },
    });
  }

  const parsed = DiscountRuleSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message, statusCode: 400 },
    });
  }
  const body = parsed.data;

  const rule = await prisma.discountRule.create({
    data: {
      storeId,
      type:               body.type,
      name:               body.name,
      discountType:       body.discountType,
      discountValue:      body.discountValue,
      minPurchaseAmount:  body.minPurchaseAmount ?? null,
      productId:          body.productId  ?? null,
      categoryId:         body.categoryId ?? null,
      startDate:          body.startDate  ? new Date(body.startDate)  : null,
      endDate:            body.endDate    ? new Date(body.endDate)    : null,
      isActive:           body.isActive   ?? true,
    },
    include: {
      product:  { select: { productId: true, name: true } },
      category: { select: { categoryId: true, name: true } },
    },
  });

  return reply.status(201).send({ success: true, data: rule });
}

// ── PATCH /:storeId/discounts/:id ─────────────────────────────
export async function updateDiscount(
  request: FastifyRequest<{ Params: { storeId: string; id: string }; Body: unknown }>,
  reply: FastifyReply,
) {
  const { storeId, id } = request.params;

  if (!isManager(request.storeRole)) {
    return reply.status(403).send({
      success: false,
      error: { code: 'FORBIDDEN', message: 'MANAGER role required', statusCode: 403 },
    });
  }

  const existing = await prisma.discountRule.findFirst({ where: { id, storeId } });
  if (!existing) {
    return reply.status(404).send({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Discount rule not found', statusCode: 404 },
    });
  }

  const parsed = UpdateDiscountRuleSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message, statusCode: 400 },
    });
  }
  const body = parsed.data;

  const rule = await prisma.discountRule.update({
    where: { id },
    data: {
      ...(body.type               !== undefined && { type:              body.type }),
      ...(body.name               !== undefined && { name:              body.name }),
      ...(body.discountType       !== undefined && { discountType:      body.discountType }),
      ...(body.discountValue      !== undefined && { discountValue:     body.discountValue }),
      ...(body.minPurchaseAmount  !== undefined && { minPurchaseAmount: body.minPurchaseAmount }),
      ...(body.productId          !== undefined && { productId:         body.productId }),
      ...(body.categoryId         !== undefined && { categoryId:        body.categoryId }),
      ...(body.startDate          !== undefined && { startDate:         body.startDate ? new Date(body.startDate) : null }),
      ...(body.endDate            !== undefined && { endDate:           body.endDate   ? new Date(body.endDate)   : null }),
      ...(body.isActive           !== undefined && { isActive:          body.isActive }),
    },
    include: {
      product:  { select: { productId: true, name: true } },
      category: { select: { categoryId: true, name: true } },
    },
  });

  return reply.send({ success: true, data: rule });
}

// ── DELETE /:storeId/discounts/:id ────────────────────────────
export async function deleteDiscount(
  request: FastifyRequest<{ Params: { storeId: string; id: string } }>,
  reply: FastifyReply,
) {
  const { storeId, id } = request.params;

  if (!isManager(request.storeRole)) {
    return reply.status(403).send({
      success: false,
      error: { code: 'FORBIDDEN', message: 'MANAGER role required', statusCode: 403 },
    });
  }

  const existing = await prisma.discountRule.findFirst({ where: { id, storeId } });
  if (!existing) {
    return reply.status(404).send({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Discount rule not found', statusCode: 404 },
    });
  }

  // Soft delete
  await prisma.discountRule.update({
    where: { id },
    data:  { isActive: false },
  });

  return reply.send({ success: true, data: { deleted: true } });
}

// ── GET /:storeId/discounts/products/search ───────────────────
export async function searchProductsForDiscount(
  request: FastifyRequest<{ Params: { storeId: string }; Querystring: Record<string, unknown> }>,
  reply: FastifyReply,
) {
  const storeId = request.storeId;
  const q       = (request.query['q'] as string ?? '').trim();

  if (q.length < 1) {
    return reply.send({ success: true, data: [] });
  }

  // Try Typesense first, fall back to Postgres ILIKE
  try {
    const hits = await tsSearchProducts(storeId, q, 10);
    if (hits.length > 0) {
      return reply.send({
        success: true,
        data: hits.map((h) => ({
          productId:   h.productId,
          name:        h.name,
          internalSku: h.internalSku,
        })),
      });
    }
  } catch (_) {}

  const products = await prisma.$queryRaw<{ product_id: string; name: string; internal_sku: string }[]>`
    SELECT DISTINCT p.product_id, p.name, p.internal_sku
    FROM products p
    WHERE p.store_id = ${storeId}::uuid
      AND p.is_active = true
      AND (p.name ILIKE ${'%' + q + '%'} OR p.internal_sku ILIKE ${'%' + q + '%'})
    ORDER BY p.name ASC
    LIMIT 10
  `;

  return reply.send({
    success: true,
    data: products.map((p) => ({
      productId:   p.product_id,
      name:        p.name,
      internalSku: p.internal_sku,
    })),
  });
}
