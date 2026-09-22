"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStockLevels = getStockLevels;
exports.getLowStock = getLowStock;
exports.getVariantStock = getVariantStock;
exports.adjustStock = adjustStock;
exports.getMovementHistory = getMovementHistory;
exports.scanVendorBill = scanVendorBill;
exports.createPurchase = createPurchase;
exports.getPurchaseHistory = getPurchaseHistory;
exports.getPurchaseDetail = getPurchaseDetail;
exports.getExpiringBatches = getExpiringBatches;
exports.getVariantBatches = getVariantBatches;
const prisma_1 = require("../../lib/prisma");
const redis_1 = require("../../lib/redis");
const typesense_1 = require("../../lib/typesense");
const schema_1 = require("./schema");
// ── Helpers ────────────────────────────────────────────────────
function isManager(role) {
    return role === 'OWNER' || role === 'MANAGER';
}
// ── Stock level handlers ───────────────────────────────────────
// GET /:storeId/inventory
async function getStockLevels(request, reply) {
    const storeId = request.storeId;
    const lowStockOnly = request.query['lowStockOnly'] === 'true'
        || request.query['lowStockOnly'] === true;
    const rows = lowStockOnly
        ? await prisma_1.prisma.$queryRaw `
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
        : await prisma_1.prisma.$queryRaw `
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
async function getLowStock(request, reply) {
    const storeId = request.storeId;
    const cacheKey = `low_stock:${storeId}`;
    const cached = await (0, redis_1.cacheGet)(cacheKey);
    if (cached)
        return reply.send({ success: true, data: cached });
    const rows = await prisma_1.prisma.$queryRaw `
    SELECT * FROM v_stock_levels
    WHERE store_id = ${storeId}::uuid AND is_low_stock = true`;
    await (0, redis_1.cacheSet)(cacheKey, rows, 60);
    return reply.send({ success: true, data: rows });
}
// GET /:storeId/inventory/:variantId
async function getVariantStock(request, reply) {
    const storeId = request.storeId;
    const { variantId } = request.params;
    const inv = await prisma_1.prisma.inventory.findUnique({
        where: { storeId_variantId: { storeId, variantId } },
        include: {
            variant: {
                select: {
                    variantSku: true,
                    product: { select: { name: true } },
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
            currentStock: Number(inv.quantity),
            reservedQty: Number(inv.reservedQty),
            availableStock: Number(inv.quantity) - Number(inv.reservedQty),
            reorderPoint: inv.reorderPoint ? Number(inv.reorderPoint) : null,
            lastCountedAt: inv.lastCountedAt,
            variant: inv.variant,
        },
    });
}
// POST /:storeId/inventory/adjust
async function adjustStock(request, reply) {
    const storeId = request.storeId;
    if (!isManager(request.storeRole)) {
        return reply.status(403).send({
            success: false,
            error: { code: 'FORBIDDEN', message: 'MANAGER role required', statusCode: 403 },
        });
    }
    const parsed = schema_1.StockAdjustmentSchema.safeParse(request.body);
    if (!parsed.success) {
        return reply.status(400).send({
            success: false,
            error: { code: 'VALIDATION_ERROR', message: parsed.error.message, statusCode: 400 },
        });
    }
    const body = parsed.data;
    try {
        const movement = await prisma_1.prisma.$transaction(async (tx) => {
            const inv = await tx.inventory.findUnique({
                where: { storeId_variantId: { storeId, variantId: body.variantId } },
            });
            if (!inv) {
                throw Object.assign(new Error('No inventory record for this variant'), {
                    code: 'INVENTORY_NOT_FOUND', status: 404,
                });
            }
            const quantityBefore = Number(inv.quantity);
            const quantityAfter = quantityBefore + body.quantityDelta;
            if (quantityAfter < 0) {
                throw Object.assign(new Error('Adjustment would result in negative stock'), {
                    code: 'INSUFFICIENT_STOCK', status: 422,
                });
            }
            await tx.inventory.update({
                where: { storeId_variantId: { storeId, variantId: body.variantId } },
                data: { quantity: quantityAfter },
            });
            return tx.inventoryMovement.create({
                data: {
                    storeId,
                    variantId: body.variantId,
                    movementType: body.adjustmentType,
                    quantityDelta: body.quantityDelta,
                    quantityBefore,
                    quantityAfter,
                    performedBy: request.authUser.userId,
                    referenceType: 'MANUAL',
                    notes: body.notes,
                    batchId: body.batchId,
                },
            });
        });
        await (0, redis_1.cacheDelete)(`low_stock:${storeId}`);
        return reply.send({ success: true, data: movement });
    }
    catch (err) {
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
async function getMovementHistory(request, reply) {
    const storeId = request.storeId;
    const { variantId } = request.params;
    if (!isManager(request.storeRole)) {
        return reply.status(403).send({
            success: false,
            error: { code: 'FORBIDDEN', message: 'MANAGER role required', statusCode: 403 },
        });
    }
    const parsed = schema_1.InventoryMovementQuerySchema.safeParse(request.query);
    if (!parsed.success) {
        return reply.status(400).send({
            success: false,
            error: { code: 'VALIDATION_ERROR', message: parsed.error.message, statusCode: 400 },
        });
    }
    const { page, limit, from, to, movementType } = parsed.data;
    const where = { storeId, variantId };
    if (movementType)
        where.movementType = movementType;
    if (from || to) {
        where.createdAt = {
            ...(from && { gte: new Date(from) }),
            ...(to && { lte: new Date(to) }),
        };
    }
    const [movements, total] = await Promise.all([
        prisma_1.prisma.inventoryMovement.findMany({
            where,
            include: { performedByUser: { select: { name: true } } },
            orderBy: { createdAt: 'desc' },
            skip: (page - 1) * limit,
            take: limit,
        }),
        prisma_1.prisma.inventoryMovement.count({ where }),
    ]);
    return reply.send({
        success: true,
        data: movements,
        meta: { page, limit, total, hasMore: page * limit < total },
    });
}
// ── Purchase handlers ──────────────────────────────────────────
// POST /:storeId/purchases/scan-bill
// Accepts a multipart vendor bill image → LLaVA OCR → per-item
// product match → returns structured bill + matched products.
async function scanVendorBill(request, reply) {
    const storeId = request.storeId;
    const MOONDREAM_URL = process.env.MOONDREAM_SERVER_URL ?? 'http://localhost:8001';
    // ── 1. Read uploaded image ──────────────────────────────────
    const data = await request.file();
    if (!data) {
        return reply.status(400).send({
            success: false,
            error: { code: 'VALIDATION_ERROR', message: 'Image file required', statusCode: 400 },
        });
    }
    const chunks = [];
    for await (const chunk of data.file)
        chunks.push(chunk);
    const fileBuffer = Buffer.concat(chunks);
    if (fileBuffer.length === 0) {
        return reply.status(400).send({
            success: false,
            error: { code: 'VALIDATION_ERROR', message: 'Empty file received', statusCode: 400 },
        });
    }
    // ── 2. Send to LLaVA with bill-specific prompt ──────────────
    const BILL_PROMPT = `You are analyzing an Indian vendor/supplier bill or invoice. Extract ALL line items and return ONLY a JSON object with these fields:
{
  "vendor_name": "string",
  "bill_date": "YYYY-MM-DD or empty string",
  "bill_number": "string",
  "items": [
    {
      "name": "string",
      "quantity": 1,
      "unit": "string",
      "rate": 0,
      "amount": 0,
      "batch_number": null,
      "expiry_date": null,
      "factory_code": null,
      "gst_rate": null,
      "hsn_code": null
    }
  ],
  "total_amount": 0,
  "gst_total": null
}
Return ONLY the JSON, no other text.`;
    let billData;
    try {
        const formData = new FormData();
        const blob = new Blob([fileBuffer], { type: data.mimetype ?? 'image/jpeg' });
        formData.append('file', blob, data.filename ?? 'bill.jpg');
        formData.append('prompt', BILL_PROMPT);
        const resp = await fetch(`${MOONDREAM_URL}/extract-bill`, {
            method: 'POST',
            body: formData,
            signal: AbortSignal.timeout(300_000),
        });
        if (!resp.ok) {
            const errText = await resp.text().catch(() => '');
            throw new Error(`LLaVA HTTP ${resp.status}: ${errText.slice(0, 200)}`);
        }
        // LLaVA returns { result: string } where result is the JSON text
        const raw = (await resp.json());
        const text = raw['result'] ?? JSON.stringify(raw);
        // Extract JSON from the response (strip markdown code fences if any)
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch)
            throw new Error('No JSON found in LLaVA response');
        billData = JSON.parse(jsonMatch[0]);
    }
    catch (err) {
        request.log.warn({ err }, 'LLaVA bill scan failed');
        return reply.status(503).send({
            success: false,
            error: {
                code: 'AI_SERVICE_UNAVAILABLE',
                message: 'AI bill scan service is offline. Run scripts/ai/start_ai_server.bat first.',
                statusCode: 503,
            },
        });
    }
    // ── 3. Per-item product matching ────────────────────────────
    const rawItems = billData['items'] ?? [];
    const enrichedItems = await Promise.all(rawItems.map(async (rawItem) => {
        const item = rawItem;
        const name = String(item['name'] ?? '').trim();
        let matchedProduct = null;
        if (name.length >= 2) {
            try {
                // Try Typesense first (fast fuzzy search)
                const hits = await (0, typesense_1.searchProducts)(storeId, name, 3);
                if (hits.length > 0) {
                    const topHit = hits[0];
                    // Typesense text_match is a score; threshold ~0.7 means first hit
                    const doc = topHit.document;
                    // Get current stock for the variant
                    const variant = await prisma_1.prisma.productVariant.findFirst({
                        where: { productId: doc['productId'], isActive: true },
                        select: { variantId: true },
                    });
                    const inv = variant
                        ? await prisma_1.prisma.inventory.findFirst({
                            where: { variantId: variant.variantId, storeId },
                            select: { quantity: true },
                        })
                        : null;
                    matchedProduct = {
                        productId: doc['productId'],
                        variantId: variant?.variantId ?? null,
                        name: doc['name'],
                        internalSku: doc['internalSku'],
                        sellingPrice: doc['sellingPrice'],
                        existingStock: inv ? Number(inv.quantity) : 0,
                        matchConfidence: Number((topHit.text_match_info?.score ?? 0.8)),
                    };
                }
            }
            catch {
                // Typesense unavailable — fallback to Prisma ILIKE
                try {
                    const prod = await prisma_1.prisma.product.findFirst({
                        where: {
                            storeId,
                            name: { contains: name, mode: 'insensitive' },
                            isActive: true,
                        },
                        include: {
                            variants: {
                                where: { isActive: true },
                                take: 1,
                                select: { variantId: true },
                            },
                        },
                    });
                    if (prod) {
                        const variantId = prod.variants[0]?.variantId ?? null;
                        const inv = variantId
                            ? await prisma_1.prisma.inventory.findFirst({
                                where: { variantId, storeId },
                                select: { quantity: true },
                            })
                            : null;
                        matchedProduct = {
                            productId: prod.productId,
                            variantId,
                            name: prod.name,
                            internalSku: prod.internalSku,
                            sellingPrice: Number(prod.sellingPrice),
                            existingStock: inv ? Number(inv.quantity) : 0,
                            matchConfidence: 0.75,
                        };
                    }
                }
                catch {
                    // Match failed — return null, user will create manually
                }
            }
        }
        return {
            name: name,
            quantity: Number(item['quantity'] ?? 1),
            unit: String(item['unit'] ?? 'PCS'),
            rate: Number(item['rate'] ?? 0),
            amount: Number(item['amount'] ?? 0),
            batchNumber: item['batch_number'] ?? null,
            expiryDate: item['expiry_date'] ?? null,
            factoryCode: item['factory_code'] ?? null,
            gstRate: item['gst_rate'] != null ? Number(item['gst_rate']) : null,
            hsnCode: item['hsn_code'] ?? null,
            matchedProduct,
        };
    }));
    // ── 4. Return enriched bill ──────────────────────────────────
    return reply.send({
        success: true,
        data: {
            vendorName: String(billData['vendor_name'] ?? ''),
            billDate: String(billData['bill_date'] ?? ''),
            billNumber: String(billData['bill_number'] ?? ''),
            totalAmount: Number(billData['total_amount'] ?? 0),
            gstTotal: billData['gst_total'] != null
                ? Number(billData['gst_total']) : null,
            items: enrichedItems,
        },
    });
}
// POST /:storeId/purchases
async function createPurchase(request, reply) {
    const storeId = request.storeId;
    if (!isManager(request.storeRole)) {
        return reply.status(403).send({
            success: false,
            error: { code: 'FORBIDDEN', message: 'MANAGER role required', statusCode: 403 },
        });
    }
    const parsed = schema_1.CreatePurchaseSchema.safeParse(request.body);
    if (!parsed.success) {
        return reply.status(400).send({
            success: false,
            error: { code: 'VALIDATION_ERROR', message: parsed.error.message, statusCode: 400 },
        });
    }
    const body = parsed.data;
    // Pre-calculate totals from body data
    const totalAmount = body.items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);
    const totalAmountBase = totalAmount * body.exchangeRate;
    const today = new Date();
    try {
        const result = await prisma_1.prisma.$transaction(async (tx) => {
            // a. Create purchase entry
            const purchaseEntry = await tx.purchaseEntry.create({
                data: {
                    storeId,
                    supplierName: body.supplierName,
                    brandId: body.brandId,
                    invoiceNumber: body.invoiceNumber,
                    purchaseDate: new Date(body.purchaseDate),
                    currencyCode: body.currencyCode,
                    exchangeRate: body.exchangeRate,
                    totalAmount,
                    totalAmountBase,
                    notes: body.notes,
                    createdBy: request.authUser.userId,
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
                const quantityAfter = quantityBefore + item.quantity;
                // Create batch if batchNumber provided
                let batchId;
                if (item.batchNumber) {
                    const batch = await tx.batch.create({
                        data: {
                            variantId: item.variantId,
                            storeId,
                            batchNumber: item.batchNumber,
                            quantity: item.quantity,
                            remainingQty: item.quantity,
                            purchasePrice: item.unitCost,
                            manufacturingDate: item.manufacturingDate ? new Date(item.manufacturingDate) : undefined,
                            expiryDate: item.expiryDate ? new Date(item.expiryDate) : undefined,
                            isExpired: item.expiryDate ? new Date(item.expiryDate) < today : false,
                        },
                    });
                    batchId = batch.batchId;
                }
                // Create purchase entry item
                const entryItem = await tx.purchaseEntryItem.create({
                    data: {
                        purchaseId: purchaseEntry.purchaseId,
                        variantId: item.variantId,
                        batchId,
                        quantity: item.quantity,
                        unitCost: item.unitCost,
                        totalCost: item.quantity * item.unitCost,
                    },
                });
                createdItems.push(entryItem);
                // Upsert inventory
                await tx.inventory.upsert({
                    where: { storeId_variantId: { storeId, variantId: item.variantId } },
                    create: { storeId, variantId: item.variantId, quantity: item.quantity },
                    update: { quantity: { increment: item.quantity } },
                });
                // Create inventory movement
                await tx.inventoryMovement.create({
                    data: {
                        storeId,
                        variantId: item.variantId,
                        movementType: 'PURCHASE',
                        quantityDelta: item.quantity,
                        quantityBefore,
                        quantityAfter,
                        referenceType: 'PURCHASE_ENTRY',
                        referenceId: purchaseEntry.purchaseId,
                        performedBy: request.authUser.userId,
                        batchId,
                    },
                });
            }
            return { purchaseEntry, items: createdItems };
        });
        // Invalidate low-stock cache (purchase may resolve low stock)
        await (0, redis_1.cacheDelete)(`low_stock:${storeId}`);
        return reply.status(201).send({ success: true, data: result });
    }
    catch (err) {
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
async function getPurchaseHistory(request, reply) {
    const storeId = request.storeId;
    if (!isManager(request.storeRole)) {
        return reply.status(403).send({
            success: false,
            error: { code: 'FORBIDDEN', message: 'MANAGER role required', statusCode: 403 },
        });
    }
    const page = Math.max(1, Number(request.query['page'] ?? 1));
    const limit = Math.min(100, Math.max(1, Number(request.query['limit'] ?? 20)));
    const where = { storeId };
    const [purchases, total] = await Promise.all([
        prisma_1.prisma.purchaseEntry.findMany({
            where,
            include: {
                brand: { select: { name: true } },
                _count: { select: { items: true } },
            },
            orderBy: { purchaseDate: 'desc' },
            skip: (page - 1) * limit,
            take: limit,
        }),
        prisma_1.prisma.purchaseEntry.count({ where }),
    ]);
    return reply.send({
        success: true,
        data: purchases,
        meta: { page, limit, total, hasMore: page * limit < total },
    });
}
// GET /:storeId/purchases/:purchaseId
async function getPurchaseDetail(request, reply) {
    const storeId = request.storeId;
    const { purchaseId } = request.params;
    if (!isManager(request.storeRole)) {
        return reply.status(403).send({
            success: false,
            error: { code: 'FORBIDDEN', message: 'MANAGER role required', statusCode: 403 },
        });
    }
    const purchase = await prisma_1.prisma.purchaseEntry.findFirst({
        where: { purchaseId, storeId },
        include: {
            brand: { select: { name: true } },
            items: {
                include: {
                    variant: {
                        select: {
                            variantSku: true,
                            product: { select: { name: true } },
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
async function getExpiringBatches(request, reply) {
    const storeId = request.storeId;
    const rows = await prisma_1.prisma.$queryRaw `
    SELECT * FROM v_expiring_batches
    WHERE store_id = ${storeId}::uuid`;
    return reply.send({ success: true, data: rows });
}
// GET /:storeId/batches/:variantId
async function getVariantBatches(request, reply) {
    const storeId = request.storeId;
    const { variantId } = request.params;
    const parsed = schema_1.BatchListQuerySchema.safeParse(request.query);
    const includeExpired = parsed.success ? parsed.data.includeExpired : false;
    const batches = await prisma_1.prisma.batch.findMany({
        where: {
            variantId,
            storeId,
            ...(!includeExpired && { isExpired: false }),
        },
        orderBy: { expiryDate: { sort: 'asc', nulls: 'last' } },
    });
    return reply.send({ success: true, data: batches });
}
//# sourceMappingURL=handler.js.map