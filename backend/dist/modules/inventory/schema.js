"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BatchListQuerySchema = exports.InventoryMovementQuerySchema = exports.CreatePurchaseSchema = exports.StockAdjustmentSchema = void 0;
const zod_1 = require("zod");
// ── Adjustment ─────────────────────────────────────────────────
exports.StockAdjustmentSchema = zod_1.z.object({
    variantId: zod_1.z.string().uuid(),
    adjustmentType: zod_1.z.enum(['ADJUSTMENT', 'DAMAGE', 'AUDIT', 'RETURN']),
    quantityDelta: zod_1.z.number().refine((n) => n !== 0, { message: 'quantityDelta must not be zero' }),
    notes: zod_1.z.string().min(1),
    batchId: zod_1.z.string().uuid().optional(),
});
// ── Purchase ───────────────────────────────────────────────────
const PurchaseItemSchema = zod_1.z.object({
    variantId: zod_1.z.string().uuid(),
    quantity: zod_1.z.number().positive(),
    unitCost: zod_1.z.number().nonnegative(),
    batchNumber: zod_1.z.string().optional(),
    manufacturingDate: zod_1.z.string().optional(),
    expiryDate: zod_1.z.string().optional(),
});
exports.CreatePurchaseSchema = zod_1.z.object({
    supplierName: zod_1.z.string().max(200).optional(),
    brandId: zod_1.z.string().uuid().optional(),
    invoiceNumber: zod_1.z.string().optional(),
    purchaseDate: zod_1.z.string().default(() => new Date().toISOString().split('T')[0]),
    currencyCode: zod_1.z.string().length(3).default('INR'),
    exchangeRate: zod_1.z.number().positive().default(1),
    notes: zod_1.z.string().optional(),
    items: zod_1.z.array(PurchaseItemSchema).min(1),
});
// ── Movement query ─────────────────────────────────────────────
exports.InventoryMovementQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().positive().default(1),
    limit: zod_1.z.coerce.number().int().min(1).max(100).default(20),
    from: zod_1.z.string().optional(),
    to: zod_1.z.string().optional(),
    movementType: zod_1.z.enum(['PURCHASE', 'SALE', 'ADJUSTMENT', 'AUDIT', 'RETURN', 'DAMAGE', 'TRANSFER']).optional(),
});
// ── Batch query ────────────────────────────────────────────────
exports.BatchListQuerySchema = zod_1.z.object({
    variantId: zod_1.z.string().uuid().optional(),
    includeExpired: zod_1.z.coerce.boolean().default(false),
});
//# sourceMappingURL=schema.js.map