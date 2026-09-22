"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SaveProductImageSchema = exports.CreateBrandSchema = exports.CreateCategorySchema = exports.ProductSearchQuerySchema = exports.ProductListQuerySchema = exports.UpdateVariantSchema = exports.CreateVariantSchema = exports.UpdateProductSchema = exports.CreateProductSchema = void 0;
const zod_1 = require("zod");
// ── Enums (must match Prisma schema exactly) ───────────────────
const PricingTypeEnum = zod_1.z.enum(['FIXED', 'WEIGHT', 'LOOSE', 'NEGOTIABLE', 'MRP']);
const BarcodeTypeEnum = zod_1.z.enum(['EAN13', 'EAN8', 'QR', 'CODE128', 'UPC', 'GS1', 'INTERNAL']);
const UnitOfMeasureEnum = zod_1.z.enum(['PCS', 'KG', 'GM', 'LTR', 'ML', 'MTR', 'BOX', 'PAIR', 'DOZEN', 'SQFT', 'PACK']);
const IndustryTypeEnum = zod_1.z.enum([
    'APPAREL', 'FOOTWEAR', 'GROCERY', 'PHARMACY', 'ELECTRONICS',
    'HARDWARE', 'OPTICAL', 'KITCHENWARE', 'STATIONERY', 'TOYS',
    'GIFT', 'BAKERY', 'PAINT', 'FURNITURE', 'JEWELRY',
    'BAGS', 'TEA_CAFE', 'PAAN_CIGARETTE', 'GENERAL',
]);
const CameraAngleEnum = zod_1.z.enum(['FRONT', 'BACK', 'SIDE', 'BARCODE', 'LABEL', 'TOP']);
const LightingEnum = zod_1.z.enum(['NATURAL', 'FLUORESCENT', 'POOR', 'BRIGHT']);
// ── Product schemas ────────────────────────────────────────────
exports.CreateProductSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(300),
    description: zod_1.z.string().optional(),
    categoryId: zod_1.z.string().uuid().optional(),
    brandId: zod_1.z.string().uuid().optional(),
    internalSku: zod_1.z.string().min(1).max(100).optional(),
    barcode: zod_1.z.string().optional(),
    barcodeType: BarcodeTypeEnum.optional(),
    hsnCode: zod_1.z.string().optional(),
    taxRuleId: zod_1.z.string().uuid().optional(),
    pricingType: PricingTypeEnum.default('FIXED'),
    sellingPrice: zod_1.z.number().nonnegative().default(0),
    purchasePrice: zod_1.z.number().nonnegative().default(0),
    mrp: zod_1.z.number().nonnegative().optional(),
    unitOfMeasure: UnitOfMeasureEnum.default('PCS'),
    hasVariants: zod_1.z.boolean().default(false),
    hasBatches: zod_1.z.boolean().default(false),
    lowStockThreshold: zod_1.z.number().int().optional(),
});
exports.UpdateProductSchema = exports.CreateProductSchema.partial();
// ── Variant schemas ────────────────────────────────────────────
exports.CreateVariantSchema = zod_1.z.object({
    variantSku: zod_1.z.string().min(1).max(150),
    barcode: zod_1.z.string().optional(),
    variantAttributes: zod_1.z.record(zod_1.z.unknown()).default({}),
    priceOverride: zod_1.z.number().nonnegative().optional(),
    purchasePrice: zod_1.z.number().nonnegative().optional(),
    initialStock: zod_1.z.number().nonnegative().default(0),
});
exports.UpdateVariantSchema = exports.CreateVariantSchema.partial();
// ── Query schemas ──────────────────────────────────────────────
exports.ProductListQuerySchema = zod_1.z.object({
    categoryId: zod_1.z.string().uuid().optional(),
    brandId: zod_1.z.string().uuid().optional(),
    pricingType: PricingTypeEnum.optional(),
    isActive: zod_1.z.coerce.boolean().default(true),
    page: zod_1.z.coerce.number().int().positive().default(1),
    limit: zod_1.z.coerce.number().int().min(1).max(100).default(20),
});
exports.ProductSearchQuerySchema = zod_1.z.object({
    q: zod_1.z.string().min(1),
    limit: zod_1.z.coerce.number().int().min(1).max(50).default(10),
});
// ── Category schemas ───────────────────────────────────────────
exports.CreateCategorySchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(150),
    parentId: zod_1.z.string().uuid().optional(),
    industryType: IndustryTypeEnum.optional(),
    sortOrder: zod_1.z.number().int().default(0),
});
// ── Brand schemas ──────────────────────────────────────────────
exports.CreateBrandSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(150),
    manufacturer: zod_1.z.string().optional(),
    contactInfo: zod_1.z.record(zod_1.z.unknown()).optional(),
});
// ── Image schema ───────────────────────────────────────────────
exports.SaveProductImageSchema = zod_1.z.object({
    imageUrl: zod_1.z.string().min(1),
    thumbnailUrl: zod_1.z.string().optional(),
    isPrimary: zod_1.z.boolean().default(false),
    cameraAngle: CameraAngleEnum.optional(),
    lighting: LightingEnum.optional(),
    captureDevice: zod_1.z.string().optional(),
});
//# sourceMappingURL=schema.js.map