import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../../lib/prisma';
import { cacheGet, cacheSet, cacheDelete } from '../../lib/redis';
import {
  StockAdjustmentSchema,
  CreatePurchaseSchema,
  InventoryMovementQuerySchema,
  BatchListQuerySchema,
} from './schema';

// ── Helpers ────────────────────────────────────────────────────

function isManager(role: string) {
  return role === 'OWNER' || role === 'MANAGER';
}

// ── Stock level handlers ───────────────────────────────────────

// GET /:storeId/inventory
export async function getStockLevels(
  request: FastifyRequest<{
    Params: { storeId: string };
    Querystring: Record<string, unknown>
  }>,
  reply: FastifyReply,
) {
  const storeId      = request.storeId;
  const lowStockOnly =
    request.query['lowStockOnly'] === 'true'
    || request.query['lowStockOnly'] === true;

  type StockRow = {
    store_id:           string;
    variant_id:         string;
    product_id:         string;
    product_name:       string;
    product_sku:        string;
    variant_sku:        string;
    variant_attributes: unknown;
    unit_of_measure:    string;
    current_stock:      number;
    reserved_qty:       number;
    available_stock:    number;
    reorder_point:      number | null;
    is_low_stock:       boolean;
    last_counted_at:    Date | null;
    updated_at:         Date;
    category_name:      string | null;
    category_id:        string | null;
    expiry_date:        Date | null;
    image_url:          string | null;
  };

  const rows = lowStockOnly
    ? await prisma.$queryRaw<StockRow[]>`
        SELECT
          v.*,
          p.category_id,
          c.name AS category_name,
          p2.pricing_type,
          b.expiry_date,
          img.image_url
        FROM v_stock_levels v
        LEFT JOIN product_variants pv
          ON pv.variant_id = v.variant_id
        LEFT JOIN products p
          ON p.product_id = pv.product_id
        LEFT JOIN categories c
          ON c.category_id = p.category_id
        LEFT JOIN products p2
          ON p2.product_id = pv.product_id
        LEFT JOIN LATERAL (
          SELECT expiry_date
          FROM batches
          WHERE variant_id = v.variant_id
            AND store_id = v.store_id
            AND is_expired = false
          ORDER BY expiry_date ASC NULLS LAST
          LIMIT 1
        ) b ON true
        LEFT JOIN LATERAL (
          SELECT image_url
          FROM product_images
          WHERE product_id = p.product_id
            AND is_primary = true
          LIMIT 1
        ) img ON true
        WHERE v.store_id = ${storeId}::uuid
          AND v.is_low_stock = true
        ORDER BY v.updated_at DESC`
    : await prisma.$queryRaw<StockRow[]>`
        SELECT
          v.*,
          p.category_id,
          c.name AS category_name,
          p2.pricing_type,
          b.expiry_date,
          img.image_url
        FROM v_stock_levels v
        LEFT JOIN product_variants pv
          ON pv.variant_id = v.variant_id
        LEFT JOIN products p
          ON p.product_id = pv.product_id
        LEFT JOIN categories c
          ON c.category_id = p.category_id
        LEFT JOIN products p2
          ON p2.product_id = pv.product_id
        LEFT JOIN LATERAL (
          SELECT expiry_date
          FROM batches
          WHERE variant_id = v.variant_id
            AND store_id = v.store_id
            AND is_expired = false
          ORDER BY expiry_date ASC NULLS LAST
          LIMIT 1
        ) b ON true
        LEFT JOIN LATERAL (
          SELECT image_url
          FROM product_images
          WHERE product_id = p.product_id
            AND is_primary = true
          LIMIT 1
        ) img ON true
        WHERE v.store_id = ${storeId}::uuid
        ORDER BY v.updated_at DESC`;

  return reply.send({ success: true, data: rows });
}

// GET /:storeId/inventory/low-stock
export async function getLowStock(
  request: FastifyRequest<{ Params: { storeId: string } }>,
  reply: FastifyReply,
) {
  const storeId  = request.storeId;
  const cacheKey = `low_stock:${storeId}`;

  const cached = await cacheGet<unknown[]>(cacheKey);
  if (cached) return reply.send({ success: true, data: cached });

  type StockRow = {
    store_id: string; variant_id: string; product_id: string;
    product_name: string; product_sku: string; variant_sku: string;
    variant_attributes: unknown; unit_of_measure: string;
    current_stock: number; reserved_qty: number; available_stock: number;
    reorder_point: number | null; is_low_stock: boolean;
    last_counted_at: Date | null; updated_at: Date;
  };

  const rows = await prisma.$queryRaw<StockRow[]>`
    SELECT * FROM v_stock_levels
    WHERE store_id = ${storeId}::uuid AND is_low_stock = true`;

  await cacheSet(cacheKey, rows, 60);
  return reply.send({ success: true, data: rows });
}

// GET /:storeId/inventory/:variantId
export async function getVariantStock(
  request: FastifyRequest<{ Params: { storeId: string; variantId: string } }>,
  reply: FastifyReply,
) {
  const storeId   = request.storeId;
  const { variantId } = request.params;

  const inv = await prisma.inventory.findUnique({
    where:   { storeId_variantId: { storeId, variantId } },
    include: {
      variant: {
        select: {
          variantSku: true,
          product:    { select: { name: true } },
        },
      },
    },
  });

  if (!inv) {
    return reply.status(404).send({
      success: false,
      error: { code: 'INVENTORY_NOT_FOUND', message: 'No inventory record found for this variant', statusCode: 404 },
    });
  }

  return reply.send({
    success: true,
    data: {
      currentStock:  Number(inv.quantity),
      reservedQty:   Number(inv.reservedQty),
      availableStock: Number(inv.quantity) - Number(inv.reservedQty),
      reorderPoint:  inv.reorderPoint ? Number(inv.reorderPoint) : null,
      lastCountedAt: inv.lastCountedAt,
      variant:       inv.variant,
    },
  });
}

// POST /:storeId/inventory/adjust
export async function adjustStock(
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

  const parsed = StockAdjustmentSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parsed.error.message, statusCode: 400 },
    });
  }
  const body = parsed.data;

  try {
    const movement = await prisma.$transaction(async (tx) => {
      const inv = await tx.inventory.findUnique({
        where: { storeId_variantId: { storeId, variantId: body.variantId } },
      });

      if (!inv) {
        throw Object.assign(new Error('No inventory record for this variant'), {
          code: 'INVENTORY_NOT_FOUND', status: 404,
        });
      }

      const quantityBefore = Number(inv.quantity);
      const quantityAfter  = quantityBefore + body.quantityDelta;

      if (quantityAfter < 0) {
        throw Object.assign(new Error('Adjustment would result in negative stock'), {
          code: 'INSUFFICIENT_STOCK', status: 422,
        });
      }

      await tx.inventory.update({
        where: { storeId_variantId: { storeId, variantId: body.variantId } },
        data:  { quantity: quantityAfter },
      });

      return tx.inventoryMovement.create({
        data: {
          storeId,
          variantId:      body.variantId,
          movementType:   body.adjustmentType,
          quantityDelta:  body.quantityDelta,
          quantityBefore,
          quantityAfter,
          performedBy:    request.authUser.userId,
          referenceType:  'MANUAL',
          notes:          body.notes,
          batchId:        body.batchId,
        },
      });
    });

    await cacheDelete(`low_stock:${storeId}`);
    return reply.send({ success: true, data: movement });
  } catch (err: any) {
    if (err.code === 'INVENTORY_NOT_FOUND') {
      return reply.status(404).send({ success: false, error: { code: err.code, message: err.message, statusCode: 404 } });
    }
    if (err.code === 'INSUFFICIENT_STOCK') {
      return reply.status(422).send({ success: false, error: { code: err.code, message: err.message, statusCode: 422 } });
    }
    throw err;
  }
}

// GET /:storeId/inventory/:variantId/movements
export async function getMovementHistory(
  request: FastifyRequest<{ Params: { storeId: string; variantId: string }; Querystring: Record<string, unknown> }>,
  reply: FastifyReply,
) {
  const storeId       = request.storeId;
  const { variantId } = request.params;

  if (!isManager(request.storeRole)) {
    return reply.status(403).send({
      success: false,
      error: { code: 'FORBIDDEN', message: 'MANAGER role required', statusCode: 403 },
    });
  }

  const parsed = InventoryMovementQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    return reply.status(400).send({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parsed.error.message, statusCode: 400 },
    });
  }
  const { page, limit, from, to, movementType } = parsed.data;

  const where: any = { storeId, variantId };
  if (movementType) where.movementType = movementType;
  if (from || to) {
    where.createdAt = {
      ...(from && { gte: new Date(from) }),
      ...(to   && { lte: new Date(to) }),
    };
  }

  const [movements, total] = await Promise.all([
    prisma.inventoryMovement.findMany({
      where,
      include: { performedByUser: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      skip:    (page - 1) * limit,
      take:    limit,
    }),
    prisma.inventoryMovement.count({ where }),
  ]);

  return reply.send({
    success: true,
    data:    movements,
    meta:    { page, limit, total, hasMore: page * limit < total },
  });
}

// ── Purchase handlers ──────────────────────────────────────────

// POST /:storeId/purchases
export async function createPurchase(
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

  const parsed = CreatePurchaseSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parsed.error.message, statusCode: 400 },
    });
  }
  const body = parsed.data;

  // Pre-calculate totals from body data
  const totalAmount     = body.items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);
  const totalAmountBase = totalAmount * body.exchangeRate;
  const today           = new Date();

  try {
    const result = await prisma.$transaction(async (tx) => {
      // a. Create purchase entry
      const purchaseEntry = await tx.purchaseEntry.create({
        data: {
          storeId,
          supplierName:   body.supplierName,
          brandId:        body.brandId,
          invoiceNumber:  body.invoiceNumber,
          purchaseDate:   new Date(body.purchaseDate),
          currencyCode:   body.currencyCode,
          exchangeRate:   body.exchangeRate,
          totalAmount,
          totalAmountBase,
          notes:          body.notes,
          createdBy:      request.authUser.userId,
        },
      });

      const createdItems = [];

      // b. Process each item
      for (const item of body.items) {
        // Read current inventory (before upsert)
        const currentInv = await tx.inventory.findUnique({
          where: { storeId_variantId: { storeId, variantId: item.variantId } },
        });
        const quantityBefore = currentInv ? Number(currentInv.quantity) : 0;
        const quantityAfter  = quantityBefore + item.quantity;

        // Create batch if batchNumber provided
        let batchId: string | undefined;
        if (item.batchNumber) {
          const batch = await tx.batch.create({
            data: {
              variantId:         item.variantId,
              storeId,
              batchNumber:       item.batchNumber,
              quantity:          item.quantity,
              remainingQty:      item.quantity,
              purchasePrice:     item.unitCost,
              manufacturingDate: item.manufacturingDate ? new Date(item.manufacturingDate) : undefined,
              expiryDate:        item.expiryDate        ? new Date(item.expiryDate)        : undefined,
              isExpired:         item.expiryDate ? new Date(item.expiryDate) < today : false,
            },
          });
          batchId = batch.batchId;
        }

        // Create purchase entry item
        const entryItem = await tx.purchaseEntryItem.create({
          data: {
            purchaseId: purchaseEntry.purchaseId,
            variantId:  item.variantId,
            batchId,
            quantity:   item.quantity,
            unitCost:   item.unitCost,
            totalCost:  item.quantity * item.unitCost,
          },
        });
        createdItems.push(entryItem);

        // Upsert inventory
        await tx.inventory.upsert({
          where:  { storeId_variantId: { storeId, variantId: item.variantId } },
          create: { storeId, variantId: item.variantId, quantity: item.quantity },
          update: { quantity: { increment: item.quantity } },
        });

        // Create inventory movement
        await tx.inventoryMovement.create({
          data: {
            storeId,
            variantId:      item.variantId,
            movementType:   'PURCHASE',
            quantityDelta:  item.quantity,
            quantityBefore,
            quantityAfter,
            referenceType:  'PURCHASE_ENTRY',
            referenceId:    purchaseEntry.purchaseId,
            performedBy:    request.authUser.userId,
            batchId,
          },
        });
      }

      return { purchaseEntry, items: createdItems };
    });

    // Invalidate low-stock cache (purchase may resolve low stock)
    await cacheDelete(`low_stock:${storeId}`);

    return reply.status(201).send({ success: true, data: result });
  } catch (err: any) {
    if (err.code === 'P2002') {
      return reply.status(409).send({
        success: false,
        error: { code: 'DUPLICATE_BATCH', message: 'Batch number already exists for this variant in this store', statusCode: 409 },
      });
    }
    throw err;
  }
}

// GET /:storeId/purchases
export async function getPurchaseHistory(
  request: FastifyRequest<{ Params: { storeId: string }; Querystring: Record<string, unknown> }>,
  reply: FastifyReply,
) {
  const storeId = request.storeId;

  if (!isManager(request.storeRole)) {
    return reply.status(403).send({
      success: false,
      error: { code: 'FORBIDDEN', message: 'MANAGER role required', statusCode: 403 },
    });
  }

  const page  = Math.max(1, Number(request.query['page']  ?? 1));
  const limit = Math.min(100, Math.max(1, Number(request.query['limit'] ?? 20)));

  const where = { storeId };

  const [purchases, total] = await Promise.all([
    prisma.purchaseEntry.findMany({
      where,
      include: {
        brand:  { select: { name: true } },
        _count: { select: { items: true } },
      },
      orderBy: { purchaseDate: 'desc' },
      skip:    (page - 1) * limit,
      take:    limit,
    }),
    prisma.purchaseEntry.count({ where }),
  ]);

  return reply.send({
    success: true,
    data:    purchases,
    meta:    { page, limit, total, hasMore: page * limit < total },
  });
}

// GET /:storeId/purchases/:purchaseId
export async function getPurchaseDetail(
  request: FastifyRequest<{ Params: { storeId: string; purchaseId: string } }>,
  reply: FastifyReply,
) {
  const storeId      = request.storeId;
  const { purchaseId } = request.params;

  if (!isManager(request.storeRole)) {
    return reply.status(403).send({
      success: false,
      error: { code: 'FORBIDDEN', message: 'MANAGER role required', statusCode: 403 },
    });
  }

  const purchase = await prisma.purchaseEntry.findFirst({
    where:   { purchaseId, storeId },
    include: {
      brand: { select: { name: true } },
      items: {
        include: {
          variant: {
            select: {
              variantSku: true,
              product:    { select: { name: true } },
            },
          },
        },
      },
    },
  });

  if (!purchase) {
    return reply.status(404).send({
      success: false,
      error: { code: 'PURCHASE_NOT_FOUND', message: 'Purchase not found', statusCode: 404 },
    });
  }

  return reply.send({ success: true, data: purchase });
}

// ── Batch handlers ─────────────────────────────────────────────

// GET /:storeId/batches/expiring
export async function getExpiringBatches(
  request: FastifyRequest<{ Params: { storeId: string } }>,
  reply: FastifyReply,
) {
  const storeId = request.storeId;

  type ExpiringRow = {
    store_id: string; batch_id: string; batch_number: string;
    variant_sku: string; product_name: string; remaining_qty: number;
    expiry_date: Date; days_to_expiry: number;
  };

  const rows = await prisma.$queryRaw<ExpiringRow[]>`
    SELECT * FROM v_expiring_batches
    WHERE store_id = ${storeId}::uuid`;

  return reply.send({ success: true, data: rows });
}

// GET /:storeId/batches/:variantId
export async function getVariantBatches(
  request: FastifyRequest<{ Params: { storeId: string; variantId: string }; Querystring: Record<string, unknown> }>,
  reply: FastifyReply,
) {
  const storeId       = request.storeId;
  const { variantId } = request.params;

  const parsed = BatchListQuerySchema.safeParse(request.query);
  const includeExpired = parsed.success ? parsed.data.includeExpired : false;

  const batches = await prisma.batch.findMany({
    where: {
      variantId,
      storeId,
      ...(!includeExpired && { isExpired: false }),
    },
    orderBy: { expiryDate: { sort: 'asc', nulls: 'last' } },
  });

  return reply.send({ success: true, data: batches });
}
