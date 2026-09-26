import { z } from 'zod';

// ── Enums (must match Prisma schema exactly) ───────────────────

const PricingTypeEnum    = z.enum(['FIXED', 'WEIGHT', 'LOOSE', 'NEGOTIABLE', 'MRP']);
const BarcodeTypeEnum    = z.enum(['EAN13', 'EAN8', 'QR', 'CODE128', 'UPC', 'GS1', 'INTERNAL']);
const UnitOfMeasureEnum  = z.enum(['PCS', 'KG', 'GM', 'LTR', 'ML', 'MTR', 'BOX', 'PAIR', 'DOZEN', 'SQFT', 'PACK']);
const IndustryTypeEnum   = z.enum([
  'APPAREL', 'FOOTWEAR', 'GROCERY', 'PHARMACY', 'ELECTRONICS',
  'HARDWARE', 'OPTICAL', 'KITCHENWARE', 'STATIONERY', 'TOYS',
  'GIFT', 'BAKERY', 'PAINT', 'FURNITURE', 'JEWELRY',
  'BAGS', 'TEA_CAFE', 'PAAN_CIGARETTE', 'PAN_SHOP', 'GENERAL',
]);
const CameraAngleEnum    = z.enum(['FRONT', 'BACK', 'SIDE', 'BARCODE', 'LABEL', 'TOP']);
const LightingEnum       = z.enum(['NATURAL', 'FLUORESCENT', 'POOR', 'BRIGHT']);

// ── Product schemas ────────────────────────────────────────────

export const CreateProductSchema = z.object({
  name:              z.string().min(1).max(300),
  description:       z.string().optional(),
  categoryId:        z.string().uuid().optional(),
  brandId:           z.string().uuid().optional(),
  internalSku:       z.string().min(1).max(100).optional(),
  barcode:           z.string().optional(),
  barcodeType:       BarcodeTypeEnum.optional(),
  hsnCode:           z.string().optional(),
  taxRuleId:         z.string().uuid().optional(),
  pricingType:       PricingTypeEnum.default('FIXED'),
  sellingPrice:      z.number().nonnegative().default(0),
  purchasePrice:     z.number().nonnegative().default(0),
  mrp:               z.number().nonnegative().optional(),
  unitOfMeasure:     UnitOfMeasureEnum.default('PCS'),
  hasVariants:       z.boolean().default(false),
  hasBatches:        z.boolean().default(false),
  lowStockThreshold: z.number().int().optional(),
});

export const UpdateProductSchema = CreateProductSchema.partial();

// ── Variant schemas ────────────────────────────────────────────

export const CreateVariantSchema = z.object({
  variantSku:        z.string().min(1).max(150),
  barcode:           z.string().optional(),
  variantAttributes: z.record(z.unknown()).default({}),
  priceOverride:     z.number().nonnegative().optional(),
  purchasePrice:     z.number().nonnegative().optional(),
  initialStock:      z.number().nonnegative().default(0),
  expiryDate:        z.string().optional(), // YYYY-MM-DD, creates initial Batch record
});

export const UpdateVariantSchema = CreateVariantSchema.partial();

// ── Query schemas ──────────────────────────────────────────────

export const ProductListQuerySchema = z.object({
  categoryId:  z.string().uuid().optional(),
  brandId:     z.string().uuid().optional(),
  pricingType: PricingTypeEnum.optional(),
  isActive:    z.coerce.boolean().default(true),
  page:        z.coerce.number().int().positive().default(1),
  limit:       z.coerce.number().int().min(1).max(100).default(20),
});

export const ProductSearchQuerySchema = z.object({
  q:     z.string().min(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

// ── Category schemas ───────────────────────────────────────────

export const CreateCategorySchema = z.object({
  name:         z.string().min(1).max(150),
  parentId:     z.string().uuid().optional(),
  industryType: IndustryTypeEnum.optional(),
  sortOrder:    z.number().int().default(0),
});

// ── Brand schemas ──────────────────────────────────────────────

export const CreateBrandSchema = z.object({
  name:         z.string().min(1).max(150),
  manufacturer: z.string().optional(),
  contactInfo:  z.record(z.unknown()).optional(),
});

// ── Image schema ───────────────────────────────────────────────

export const SaveProductImageSchema = z.object({
  imageUrl:      z.string().min(1),
  thumbnailUrl:  z.string().optional(),
  isPrimary:     z.boolean().default(false),
  cameraAngle:   CameraAngleEnum.optional(),
  lighting:      LightingEnum.optional(),
  captureDevice: z.string().optional(),
});

// ── TypeScript types ───────────────────────────────────────────

export type CreateProductInput    = z.infer<typeof CreateProductSchema>;
export type UpdateProductInput    = z.infer<typeof UpdateProductSchema>;
export type CreateVariantInput    = z.infer<typeof CreateVariantSchema>;
export type UpdateVariantInput    = z.infer<typeof UpdateVariantSchema>;
export type ProductListQuery      = z.infer<typeof ProductListQuerySchema>;
export type ProductSearchQuery    = z.infer<typeof ProductSearchQuerySchema>;
export type CreateCategoryInput   = z.infer<typeof CreateCategorySchema>;
export type CreateBrandInput      = z.infer<typeof CreateBrandSchema>;
export type SaveProductImageInput = z.infer<typeof SaveProductImageSchema>;
