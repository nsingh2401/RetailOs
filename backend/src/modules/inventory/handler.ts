import { FastifyRequest, FastifyReply } from 'fastify';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { cacheGet, cacheSet, cacheDelete } from '../../lib/redis';
import { searchProducts as tsSearchProducts } from '../../lib/typesense';
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
  const productIdFilter = request.query['productId'] as string | undefined;

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

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const in30  = new Date(today);
  in30.setDate(in30.getDate() + 30);

  const enriched = rows.map((r) => ({
    ...r,
    isExpired:      r.expiry_date != null && r.expiry_date < today,
    isExpiringSoon: r.expiry_date != null && r.expiry_date >= today && r.expiry_date <= in30,
  }));

  const data = productIdFilter
    ? enriched.filter((r) => r.product_id === productIdFilter)
    : enriched;

  return reply.send({ success: true, data });
}

// GET /:storeId/inventory/expired
export async function getExpiredItems(
  request: FastifyRequest<{ Params: { storeId: string } }>,
  reply: FastifyReply,
) {
  const storeId = request.storeId;

  type ExpiredRow = {
    batch_id:     string;
    variant_id:   string;
    product_name: string;
    variant_sku:  string;
    batch_number: string | null;
    expiry_date:  Date;
    remaining_qty: number;
  };

  const rows = await prisma.$queryRaw<ExpiredRow[]>`
    SELECT
      b.batch_id,
      b.variant_id,
      p.name        AS product_name,
      pv.variant_sku,
      b.batch_number,
      b.expiry_date,
      b.remaining_qty
    FROM batches b
    JOIN product_variants pv
      ON pv.variant_id = b.variant_id
    JOIN products p
      ON p.product_id = pv.product_id
    WHERE b.store_id     = ${storeId}::uuid
      AND b.expiry_date  < NOW()
      AND b.remaining_qty > 0
      AND b.is_expired   = false
    ORDER BY b.expiry_date ASC
  `;

  return reply.send({ success: true, data: rows });
}

// DELETE /:storeId/inventory/expired
export async function clearExpiredStock(
  request: FastifyRequest<{ Params: { storeId: string } }>,
  reply: FastifyReply,
) {
  const storeId = request.storeId;

  if (!isManager(request.storeRole)) {
    return reply.status(403).send({
      success: false,
      error: { code: 'FORBIDDEN', message: 'MANAGER role required', statusCode: 403 },
    });
  }

  type ExpiredBatch = {
    batch_id:     string;
    variant_id:   string;
    remaining_qty: number;
  };

  const expired = await prisma.$queryRaw<ExpiredBatch[]>`
    SELECT batch_id, variant_id, remaining_qty
    FROM batches
    WHERE store_id     = ${storeId}::uuid
      AND expiry_date  < NOW()
      AND remaining_qty > 0
      AND is_expired   = false
  `;

  if (expired.length === 0) {
    return reply.send({ success: true, data: { batchesCleared: 0, unitsRemoved: 0 } });
  }

  // Write off per batch so every EXPIRED_CLEARANCE movement carries batchId
  let totalUnits = 0;
  for (const b of expired) {
    const writeOff = Number(b.remaining_qty);
    await prisma.$transaction(async (tx) => {
      await writeBatchOff(tx, storeId, b.batch_id, b.variant_id, writeOff);
      await tx.batch.update({
        where: { batchId: b.batch_id },
        data:  { isExpired: true, remainingQty: 0 },
      });
    });
    totalUnits += writeOff;
  }

  await cacheDelete(`low_stock:${storeId}`);
  return reply.send({ success: true, data: { batchesCleared: expired.length, unitsRemoved: totalUnits } });
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

// POST /:storeId/purchases/scan-bill
// Accepts a multipart vendor bill image → LLaVA OCR → per-item
// product match → returns structured bill + matched products.
export async function scanVendorBill(
  request: FastifyRequest<{ Params: { storeId: string } }>,
  reply:   FastifyReply,
) {
  const storeId       = request.storeId;
  const MOONDREAM_URL = process.env.MOONDREAM_SERVER_URL ?? 'http://localhost:8001';

  // ── 1. Read uploaded image ──────────────────────────────────
  const data = await (request as any).file();
  if (!data) {
    return reply.status(400).send({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Image file required', statusCode: 400 },
    });
  }
  const chunks: Buffer[] = [];
  for await (const chunk of data.file) chunks.push(chunk);
  const fileBuffer = Buffer.concat(chunks);

  if (fileBuffer.length === 0) {
    return reply.status(400).send({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Empty file received', statusCode: 400 },
    });
  }

  // ── 2. Send to OCR service (Tesseract + Qwen 2.5 7B) ──────────
  let billData: Record<string, unknown>;
  try {
    const formData = new FormData();
    const blob     = new Blob([fileBuffer], { type: data.mimetype ?? 'image/jpeg' });
    formData.append('file', blob, data.filename ?? 'bill.jpg');

    const resp = await fetch(`${MOONDREAM_URL}/extract-bill-ocr`, {
      method: 'POST',
      body:   formData,
      signal: AbortSignal.timeout(300_000),
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      throw new Error(`OCR service HTTP ${resp.status}: ${errText.slice(0, 200)}`);
    }

    // /extract-bill-ocr returns { success: bool, data: {...}, raw_ocr: string }
    const envelope = (await resp.json()) as Record<string, unknown>;
    if (!envelope['success']) {
      const err = (envelope['_error'] ?? envelope['_parse_error'] ?? 'OCR failed') as string;
      throw new Error(`OCR parse failed: ${err}`);
    }
    billData = (envelope['data'] as Record<string, unknown>) ?? {};
  } catch (err: unknown) {
    request.log.warn({ err }, 'LLaVA bill scan failed');
    return reply.status(503).send({
      success: false,
      error: {
        code:       'AI_SERVICE_UNAVAILABLE',
        message:    'AI bill scan service is offline. Run scripts/ai/start_ai_server.bat first.',
        statusCode: 503,
      },
    });
  }

  // ── 3. Per-item product matching ────────────────────────────
  const rawItems = (billData['items'] as unknown[]) ?? [];

  const enrichedItems = await Promise.all(
    rawItems.map(async (rawItem: unknown) => {
      const item   = rawItem as Record<string, unknown>;
      const name   = String(item['name'] ?? '').trim();
      let matchedProduct: object | null = null;

      if (name.length >= 2) {
        try {
          // Try Typesense first (fast fuzzy search)
          const hits = await tsSearchProducts(storeId, name, 3);

          if (hits.length > 0) {
            const topHit = (hits[0] as any);
            // Typesense text_match is a score; threshold ~0.7 means first hit
            const doc = topHit.document as Record<string, unknown>;

            // Get current stock for the variant
            const variant = await prisma.productVariant.findFirst({
              where:  { productId: doc['productId'] as string, isActive: true },
              select: { variantId: true },
            });
            const inv = variant
              ? await prisma.inventory.findFirst({
                  where:  { variantId: variant.variantId, storeId },
                  select: { quantity: true },
                })
              : null;

            matchedProduct = {
              productId:       doc['productId'],
              variantId:       variant?.variantId ?? null,
              name:            doc['name'],
              internalSku:     doc['internalSku'],
              sellingPrice:    doc['sellingPrice'],
              existingStock:   inv ? Number(inv.quantity) : 0,
              matchConfidence: Number((topHit.text_match_info?.score ?? 0.8)),
            };
          }
        } catch {
          // Typesense unavailable — fallback to Prisma ILIKE
          try {
            const prod = await (prisma as any).product.findFirst({
              where: {
                storeId,
                name:     { contains: name, mode: 'insensitive' },
                isActive: true,
              },
              include: {
                variants: {
                  where:  { isActive: true },
                  take:   1,
                  select: { variantId: true },
                },
              },
            });
            if (prod) {
              const variantId = prod.variants[0]?.variantId ?? null;
              const inv = variantId
                ? await prisma.inventory.findFirst({
                    where:  { variantId, storeId },
                    select: { quantity: true },
                  })
                : null;
              matchedProduct = {
                productId:       prod.productId,
                variantId,
                name:            prod.name,
                internalSku:     prod.internalSku,
                sellingPrice:    Number(prod.sellingPrice),
                existingStock:   inv ? Number(inv.quantity) : 0,
                matchConfidence: 0.75,
              };
            }
          } catch {
            // Match failed — return null, user will create manually
          }
        }
      }

      return {
        name:         name,
        quantity:     Number(item['quantity'] ?? 1),
        unit:         String(item['unit']     ?? 'PCS'),
        rate:         Number(item['rate']     ?? 0),
        amount:       Number(item['amount']   ?? 0),
        batchNumber:  (item['batch_number']   as string | null) ?? null,
        expiryDate:   (item['expiry_date']    as string | null) ?? null,
        factoryCode:  (item['factory_code']   as string | null) ?? null,
        gstRate:      item['gst_rate']  != null ? Number(item['gst_rate'])  : null,
        hsnCode:      (item['hsn_code']       as string | null) ?? null,
        matchedProduct,
      };
    }),
  );

  // ── 4. Return enriched bill ──────────────────────────────────
  return reply.send({
    success: true,
    data: {
      vendorName:  String(billData['vendor_name']  ?? ''),
      vendorGstin: billData['vendor_gstin'] != null
                     ? String(billData['vendor_gstin']) : null,
      billDate:    String(billData['bill_date']     ?? ''),
      billNumber:  String(billData['bill_number']   ?? ''),
      totalAmount: Number(billData['total_amount']  ?? 0),
      gstTotal:    billData['gst_total'] != null
                     ? Number(billData['gst_total']) : null,
      items:       enrichedItems,
    },
  });
}

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
          vendorGstin:    body.vendorGstin ?? null,
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

        // Create batch if batchNumber provided; dedup by expiry_date
        let batchId: string | undefined;
        if (item.batchNumber) {
          const expiryDate = item.expiryDate ? new Date(item.expiryDate) : undefined;
          const existingBatch = expiryDate
            ? await tx.batch.findFirst({
                where: { variantId: item.variantId, storeId, expiryDate, isExpired: false },
              })
            : null;
          if (existingBatch) {
            const updated = await tx.batch.update({
              where: { batchId: existingBatch.batchId },
              data:  { quantity: { increment: item.quantity }, remainingQty: { increment: item.quantity } },
            });
            batchId = updated.batchId;
          } else {
            const batch = await tx.batch.create({
              data: {
                variantId:         item.variantId,
                storeId,
                batchNumber:       item.batchNumber,
                quantity:          item.quantity,
                remainingQty:      item.quantity,
                purchasePrice:     item.unitCost,
                manufacturingDate: item.manufacturingDate ? new Date(item.manufacturingDate) : undefined,
                expiryDate,
                isExpired:         expiryDate ? expiryDate < today : false,
              },
            });
            batchId = batch.batchId;
          }
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

// ── GET /:storeId/inventory/expired-batches (E) ───────────────
export async function getExpiredBatches(
  request: FastifyRequest<{
    Params: { storeId: string };
    Querystring: Record<string, unknown>;
  }>,
  reply: FastifyReply,
) {
  const storeId = request.storeId;
  const month   = request.query['month'] as string | undefined; // 'YYYY-MM'
  const q       = request.query['q'] as string | undefined;

  type ExpiredRow = {
    batch_id:      string;
    batch_number:  string | null;
    expiry_date:   Date | null;
    remaining_qty: number;
    is_expired:    boolean;
    product_name:  string;
    variant_sku:   string;
    variant_id:    string;
  };

  const monthFilter = month ? Prisma.sql`AND TO_CHAR(b.expiry_date, 'YYYY-MM') = ${month}` : Prisma.empty;
  const qFilter     = q     ? Prisma.sql`AND p.name ILIKE ${'%' + q + '%'}`                 : Prisma.empty;

  // Show batches that still matter:
  // 1. Already flagged expired in the last 90 days (written-off history)
  // 2. Past expiry date but not yet flagged — still has stock, needs attention
  const rows = await prisma.$queryRaw<ExpiredRow[]>(Prisma.sql`
    SELECT
      b.batch_id,
      b.batch_number,
      b.expiry_date,
      b.remaining_qty,
      b.is_expired,
      p.name       AS product_name,
      pv.variant_sku,
      pv.variant_id
    FROM batches b
    JOIN product_variants pv ON pv.variant_id = b.variant_id
    JOIN products         p  ON p.product_id  = pv.product_id
    WHERE b.store_id = ${storeId}::uuid
      AND (
        (b.is_expired = true  AND (b.expiry_date IS NULL OR b.expiry_date >= NOW() - INTERVAL '90 days'))
        OR
        (b.is_expired = false AND b.expiry_date < NOW() AND b.remaining_qty > 0)
      )
      ${monthFilter}
      ${qFilter}
    ORDER BY b.expiry_date DESC, p.name ASC
  `);

  return reply.send({ success: true, data: rows });
}

// Shared write-off helper used by deleteBatch and clearExpiredBatches
async function writeBatchOff(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  storeId: string,
  batchId: string,
  variantId: string,
  writeOff: number,
) {
  if (writeOff <= 0) return;
  const inv = await tx.inventory.findUnique({
    where:  { storeId_variantId: { storeId, variantId } },
    select: { quantity: true },
  });
  const qtyBefore = Number(inv?.quantity ?? 0);
  const deducted  = Math.min(writeOff, qtyBefore);
  const qtyAfter  = qtyBefore - deducted;
  if (deducted > 0) {
    await tx.inventory.update({
      where: { storeId_variantId: { storeId, variantId } },
      data:  { quantity: qtyAfter },
    });
  }
  await tx.inventoryMovement.create({
    data: {
      storeId,
      variantId,
      batchId,
      movementType:   'EXPIRED_CLEARANCE',
      quantityDelta:  -deducted,
      quantityBefore: qtyBefore,
      quantityAfter:  qtyAfter,
      referenceType:  'BATCH',
      referenceId:    batchId,
      performedBy:    null,
    },
  });
}

// ── DELETE /:storeId/inventory/batches/:batchId (F) ───────────
export async function deleteBatch(
  request: FastifyRequest<{ Params: { storeId: string; batchId: string } }>,
  reply: FastifyReply,
) {
  if (!['OWNER', 'MANAGER'].includes(request.storeRole)) {
    return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'OWNER or MANAGER required', statusCode: 403 } });
  }

  const storeId     = request.storeId;
  const { batchId } = request.params;

  const batch = await prisma.batch.findFirst({ where: { batchId, storeId } });
  if (!batch) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Batch not found', statusCode: 404 } });

  const writeOff = Number(batch.remainingQty);

  // Check all three FK tables before deciding hard vs soft
  const [movRefs, lineRefs, purchaseRefs] = await Promise.all([
    prisma.inventoryMovement.count({ where: { batchId } }),
    prisma.invoiceLineItem.count({ where: { batchId } }),
    prisma.purchaseEntryItem.count({ where: { batchId } }),
  ]);
  const hasRefs = movRefs + lineRefs + purchaseRefs > 0;

  if (writeOff === 0 && !hasRefs) {
    await prisma.batch.delete({ where: { batchId } });
    return reply.send({ success: true, data: { deleted: true, batchId } });
  }

  // Write off remaining stock, then hide the row
  await prisma.$transaction(async (tx) => {
    await writeBatchOff(tx, storeId, batchId, batch.variantId, writeOff);
    await tx.batch.update({
      where: { batchId },
      data:  { remainingQty: 0, isExpired: true },
    });
  });
  return reply.send({ success: true, data: { deleted: false, batchId } });
}

// ── DELETE /:storeId/inventory/expired-batches (F clear-all) ──
export async function clearExpiredBatches(
  request: FastifyRequest<{
    Params: { storeId: string };
    Querystring: Record<string, unknown>;
  }>,
  reply: FastifyReply,
) {
  if (!['OWNER', 'MANAGER'].includes(request.storeRole)) {
    return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'OWNER or MANAGER required', statusCode: 403 } });
  }

  const storeId = request.storeId;
  const month   = request.query['month'] as string | undefined;
  const q       = request.query['q'] as string | undefined;

  const monthFilter2 = month ? Prisma.sql`AND TO_CHAR(b.expiry_date, 'YYYY-MM') = ${month}` : Prisma.empty;
  const qFilter2     = q     ? Prisma.sql`AND p.name ILIKE ${'%' + q + '%'}`                  : Prisma.empty;

  // Find matching expired batches — same filter as getExpiredBatches
  const batches = await prisma.$queryRaw<Array<{ batch_id: string; variant_id: string; remaining_qty: number }>>(Prisma.sql`
    SELECT b.batch_id, b.variant_id, b.remaining_qty
    FROM batches b
    JOIN product_variants pv ON pv.variant_id = b.variant_id
    JOIN products         p  ON p.product_id  = pv.product_id
    WHERE b.store_id = ${storeId}::uuid
      AND (
        (b.is_expired = true  AND (b.expiry_date IS NULL OR b.expiry_date >= NOW() - INTERVAL '90 days'))
        OR
        (b.is_expired = false AND b.expiry_date < NOW() AND b.remaining_qty > 0)
      )
      ${monthFilter2}
      ${qFilter2}
  `);

  let deleted = 0;
  let cleared = 0;
  let unitsWrittenOff = 0;

  for (const b of batches) {
    const writeOff = Number(b.remaining_qty);
    const [movRefs, lineRefs, purchaseRefs] = await Promise.all([
      prisma.inventoryMovement.count({ where: { batchId: b.batch_id } }),
      prisma.invoiceLineItem.count({ where: { batchId: b.batch_id } }),
      prisma.purchaseEntryItem.count({ where: { batchId: b.batch_id } }),
    ]);
    const hasRefs = movRefs + lineRefs + purchaseRefs > 0;

    if (writeOff === 0 && !hasRefs) {
      await prisma.batch.delete({ where: { batchId: b.batch_id } });
      deleted++;
    } else {
      await prisma.$transaction(async (tx) => {
        await writeBatchOff(tx, storeId, b.batch_id, b.variant_id, writeOff);
        await tx.batch.update({
          where: { batchId: b.batch_id },
          data:  { remainingQty: 0, isExpired: true },
        });
      });
      unitsWrittenOff += writeOff;
      cleared++;
    }
  }

  return reply.send({ success: true, data: { deleted, cleared, unitsWrittenOff } });
}

// ── PATCH /:storeId/inventory/batches/:batchId (expiry edit) ──
export async function updateBatchExpiry(
  request: FastifyRequest<{
    Params: { storeId: string; batchId: string };
    Body: unknown;
  }>,
  reply: FastifyReply,
) {
  if (!['OWNER', 'MANAGER'].includes(request.storeRole)) {
    return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'OWNER or MANAGER required', statusCode: 403 } });
  }

  const storeId     = request.storeId;
  const { batchId } = request.params;
  const body        = request.body as Record<string, unknown>;
  const rawExpiry   = body['expiryDate'];

  const batch = await prisma.batch.findFirst({ where: { batchId, storeId } });
  if (!batch) {
    return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Batch not found', statusCode: 404 } });
  }

  const newExpiry = rawExpiry == null ? null : new Date(rawExpiry as string);

  // Determine if the new date is in the past using the store's timezone
  const store = await prisma.store.findUnique({ where: { storeId }, select: { timezone: true } });
  const tz    = store?.timezone ?? 'UTC';

  const [todayRow] = await prisma.$queryRaw<Array<{ today: Date }>>`
    SELECT (NOW() AT TIME ZONE ${tz})::date AS today
  `;
  const todayDate = todayRow.today;

  const isPast = newExpiry != null && newExpiry < todayDate;

  if (isPast) {
    const confirmWriteOff = !!body['confirmWriteOff'];
    const writeOffUnits   = Number(batch.remainingQty);
    if (!confirmWriteOff) {
      return reply.status(422).send({
        success: false,
        error: {
          code:          'CONFIRM_REQUIRED',
          message:       `${writeOffUnits} unit(s) will be written off. Send confirmWriteOff: true to proceed.`,
          writeOffUnits,
          statusCode:    422,
        },
      });
    }
    // Apply expiry immediately — same logic as the hourly worker
    await prisma.$transaction(async (tx) => {
      const qty = Number(batch.remainingQty);
      await tx.batch.update({
        where: { batchId },
        data:  { expiryDate: newExpiry, isExpired: true, remainingQty: 0 },
      });
      if (qty > 0) {
        const inv = await tx.inventory.findUnique({
          where: { storeId_variantId: { storeId, variantId: batch.variantId } },
        });
        if (inv) {
          const qtyBefore = Number(inv.quantity);
          const qtyAfter  = Math.max(0, qtyBefore - qty);
          await tx.inventory.update({
            where: { storeId_variantId: { storeId, variantId: batch.variantId } },
            data:  { quantity: qtyAfter },
          });
          await tx.inventoryMovement.create({
            data: {
              storeId,
              variantId:      batch.variantId,
              batchId,
              movementType:   'EXPIRED_CLEARANCE',
              quantityDelta:  -(qtyBefore - qtyAfter),
              quantityBefore: qtyBefore,
              quantityAfter:  qtyAfter,
              referenceType:  'BATCH',
              referenceId:    batchId,
              performedBy:    null,
            },
          });
        }
      }
    });
  } else {
    await prisma.batch.update({
      where: { batchId },
      data:  { expiryDate: newExpiry, isExpired: false },
    });
  }

  return reply.send({ success: true, data: { batchId, expiryDate: newExpiry, expired: isPast } });
}

// ── POST /:storeId/inventory/batches/:batchId/restore ─────────
export async function restoreBatch(
  request: FastifyRequest<{
    Params: { storeId: string; batchId: string };
    Body: unknown;
  }>,
  reply: FastifyReply,
) {
  if (!['OWNER', 'MANAGER'].includes(request.storeRole)) {
    return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'OWNER or MANAGER required', statusCode: 403 } });
  }

  const storeId     = request.storeId;
  const { batchId } = request.params;
  const body        = request.body as Record<string, unknown>;

  const batch = await prisma.batch.findFirst({ where: { batchId, storeId } });
  if (!batch) {
    return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Batch not found', statusCode: 404 } });
  }
  if (!batch.isExpired) {
    return reply.status(409).send({ success: false, error: { code: 'ALREADY_ACTIVE', message: 'Batch is not expired — nothing to restore', statusCode: 409 } });
  }
  if (Number(batch.remainingQty) > 0) {
    return reply.status(409).send({ success: false, error: { code: 'HAS_STOCK', message: 'Batch still has remaining stock — cannot restore', statusCode: 409 } });
  }

  // Restore qty = what was cleared by the most-recent EXPIRED_CLEARANCE movement
  const clearance = await prisma.inventoryMovement.findFirst({
    where:   { batchId, storeId, movementType: 'EXPIRED_CLEARANCE' },
    orderBy: { createdAt: 'desc' },
  });
  if (!clearance) {
    return reply.status(400).send({ success: false, error: { code: 'NO_CLEARANCE_MOVEMENT', message: 'No expiry clearance movement found for this batch. It may have been hard-deleted.', statusCode: 400 } });
  }
  const restoreQty = Math.abs(Number(clearance.quantityDelta));
  if (restoreQty === 0) {
    return reply.status(400).send({ success: false, error: { code: 'NOTHING_TO_RESTORE', message: 'The clearance movement recorded 0 units — nothing to restore', statusCode: 400 } });
  }

  const rawNewExpiry = body['newExpiryDate'];
  if (!rawNewExpiry) {
    return reply.status(400).send({ success: false, error: { code: 'MISSING_EXPIRY', message: 'newExpiryDate is required', statusCode: 400 } });
  }
  const newExpiry = new Date(rawNewExpiry as string);
  if (isNaN(newExpiry.getTime())) {
    return reply.status(400).send({ success: false, error: { code: 'INVALID_DATE', message: 'newExpiryDate is not a valid date', statusCode: 400 } });
  }

  // Date must be strictly after today in the store's timezone
  const store = await prisma.store.findUnique({ where: { storeId }, select: { timezone: true } });
  const tz    = store?.timezone ?? 'UTC';
  const [todayRow] = await prisma.$queryRaw<Array<{ today: Date }>>`
    SELECT (NOW() AT TIME ZONE ${tz})::date AS today
  `;
  if (newExpiry <= todayRow.today) {
    return reply.status(400).send({ success: false, error: { code: 'EXPIRY_NOT_FUTURE', message: 'newExpiryDate must be after today', statusCode: 400 } });
  }

  const oldExpiryStr = batch.expiryDate
    ? batch.expiryDate.toISOString().substring(0, 10)
    : 'unknown';

  await prisma.$transaction(async (tx) => {
    await tx.batch.update({
      where: { batchId },
      data:  { expiryDate: newExpiry, isExpired: false, remainingQty: restoreQty },
    });

    const inv = await tx.inventory.findUnique({
      where:  { storeId_variantId: { storeId, variantId: batch.variantId } },
      select: { quantity: true },
    });
    const qtyBefore = Number(inv?.quantity ?? 0);
    const qtyAfter  = qtyBefore + restoreQty;

    if (inv) {
      await tx.inventory.update({
        where: { storeId_variantId: { storeId, variantId: batch.variantId } },
        data:  { quantity: qtyAfter },
      });
    } else {
      await tx.inventory.create({
        data: { storeId, variantId: batch.variantId, quantity: restoreQty },
      });
    }

    await tx.inventoryMovement.create({
      data: {
        storeId,
        variantId:      batch.variantId,
        batchId,
        movementType:   'ADJUSTMENT',
        quantityDelta:  restoreQty,
        quantityBefore: qtyBefore,
        quantityAfter:  qtyAfter,
        referenceType:  'BATCH_RESTORE',
        referenceId:    batchId,
        notes:          `Restored from batch expired on ${oldExpiryStr}`,
        performedBy:    request.authUser.userId,
      },
    });
  });

  return reply.send({
    success: true,
    data: {
      batchId,
      restoredQty:   restoreQty,
      newExpiryDate: newExpiry,
    },
  });
}
