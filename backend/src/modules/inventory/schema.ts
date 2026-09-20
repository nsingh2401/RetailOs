import { z } from 'zod';

// ── Adjustment ─────────────────────────────────────────────────

export const StockAdjustmentSchema = z.object({
  variantId:      z.string().uuid(),
  adjustmentType: z.enum(['ADJUSTMENT', 'DAMAGE', 'AUDIT', 'RETURN']),
  quantityDelta:  z.number().refine((n) => n !== 0, { message: 'quantityDelta must not be zero' }),
  notes:          z.string().min(1),
  batchId:        z.string().uuid().optional(),
});

// ── Purchase ───────────────────────────────────────────────────

const PurchaseItemSchema = z.object({
  variantId:         z.string().uuid(),
  quantity:          z.number().positive(),
  unitCost:          z.number().nonnegative(),
  batchNumber:       z.string().optional(),
  manufacturingDate: z.string().optional(),
  expiryDate:        z.string().optional(),
});

export const CreatePurchaseSchema = z.object({
  supplierName:  z.string().max(200).optional(),
  brandId:       z.string().uuid().optional(),
  invoiceNumber: z.string().optional(),
  purchaseDate:  z.string().default(() => new Date().toISOString().split('T')[0]),
  currencyCode:  z.string().length(3).default('INR'),
  exchangeRate:  z.number().positive().default(1),
  notes:         z.string().optional(),
  items:         z.array(PurchaseItemSchema).min(1),
});

// ── Movement query ─────────────────────────────────────────────

export const InventoryMovementQuerySchema = z.object({
  page:         z.coerce.number().int().positive().default(1),
  limit:        z.coerce.number().int().min(1).max(100).default(20),
  from:         z.string().optional(),
  to:           z.string().optional(),
  movementType: z.enum(['PURCHASE', 'SALE', 'ADJUSTMENT', 'AUDIT', 'RETURN', 'DAMAGE', 'TRANSFER']).optional(),
});

// ── Batch query ────────────────────────────────────────────────

export const BatchListQuerySchema = z.object({
  variantId:      z.string().uuid().optional(),
  includeExpired: z.coerce.boolean().default(false),
});

// ── Types ──────────────────────────────────────────────────────

export type StockAdjustmentInput      = z.infer<typeof StockAdjustmentSchema>;
export type CreatePurchaseInput       = z.infer<typeof CreatePurchaseSchema>;
export type InventoryMovementQuery    = z.infer<typeof InventoryMovementQuerySchema>;
export type BatchListQuery            = z.infer<typeof BatchListQuerySchema>;
