import { z } from 'zod';
export declare const CreateProductSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    categoryId: z.ZodOptional<z.ZodString>;
    brandId: z.ZodOptional<z.ZodString>;
    internalSku: z.ZodOptional<z.ZodString>;
    barcode: z.ZodOptional<z.ZodString>;
    barcodeType: z.ZodOptional<z.ZodEnum<["EAN13", "EAN8", "QR", "CODE128", "UPC", "GS1", "INTERNAL"]>>;
    hsnCode: z.ZodOptional<z.ZodString>;
    taxRuleId: z.ZodOptional<z.ZodString>;
    pricingType: z.ZodDefault<z.ZodEnum<["FIXED", "WEIGHT", "LOOSE", "NEGOTIABLE", "MRP"]>>;
    sellingPrice: z.ZodDefault<z.ZodNumber>;
    purchasePrice: z.ZodDefault<z.ZodNumber>;
    mrp: z.ZodOptional<z.ZodNumber>;
    unitOfMeasure: z.ZodDefault<z.ZodEnum<["PCS", "KG", "GM", "LTR", "ML", "MTR", "BOX", "PAIR", "DOZEN", "SQFT", "PACK"]>>;
    hasVariants: z.ZodDefault<z.ZodBoolean>;
    hasBatches: z.ZodDefault<z.ZodBoolean>;
    lowStockThreshold: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    name: string;
    sellingPrice: number;
    pricingType: "FIXED" | "WEIGHT" | "LOOSE" | "NEGOTIABLE" | "MRP";
    purchasePrice: number;
    unitOfMeasure: "PCS" | "KG" | "GM" | "LTR" | "ML" | "MTR" | "BOX" | "PAIR" | "DOZEN" | "SQFT" | "PACK";
    hasVariants: boolean;
    hasBatches: boolean;
    hsnCode?: string | undefined;
    lowStockThreshold?: number | undefined;
    internalSku?: string | undefined;
    barcode?: string | undefined;
    description?: string | undefined;
    categoryId?: string | undefined;
    brandId?: string | undefined;
    barcodeType?: "EAN13" | "EAN8" | "QR" | "CODE128" | "UPC" | "GS1" | "INTERNAL" | undefined;
    taxRuleId?: string | undefined;
    mrp?: number | undefined;
}, {
    name: string;
    hsnCode?: string | undefined;
    lowStockThreshold?: number | undefined;
    internalSku?: string | undefined;
    barcode?: string | undefined;
    sellingPrice?: number | undefined;
    description?: string | undefined;
    categoryId?: string | undefined;
    brandId?: string | undefined;
    barcodeType?: "EAN13" | "EAN8" | "QR" | "CODE128" | "UPC" | "GS1" | "INTERNAL" | undefined;
    taxRuleId?: string | undefined;
    pricingType?: "FIXED" | "WEIGHT" | "LOOSE" | "NEGOTIABLE" | "MRP" | undefined;
    purchasePrice?: number | undefined;
    mrp?: number | undefined;
    unitOfMeasure?: "PCS" | "KG" | "GM" | "LTR" | "ML" | "MTR" | "BOX" | "PAIR" | "DOZEN" | "SQFT" | "PACK" | undefined;
    hasVariants?: boolean | undefined;
    hasBatches?: boolean | undefined;
}>;
export declare const UpdateProductSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    categoryId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    brandId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    internalSku: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    barcode: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    barcodeType: z.ZodOptional<z.ZodOptional<z.ZodEnum<["EAN13", "EAN8", "QR", "CODE128", "UPC", "GS1", "INTERNAL"]>>>;
    hsnCode: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    taxRuleId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    pricingType: z.ZodOptional<z.ZodDefault<z.ZodEnum<["FIXED", "WEIGHT", "LOOSE", "NEGOTIABLE", "MRP"]>>>;
    sellingPrice: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    purchasePrice: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    mrp: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
    unitOfMeasure: z.ZodOptional<z.ZodDefault<z.ZodEnum<["PCS", "KG", "GM", "LTR", "ML", "MTR", "BOX", "PAIR", "DOZEN", "SQFT", "PACK"]>>>;
    hasVariants: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
    hasBatches: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
    lowStockThreshold: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    hsnCode?: string | undefined;
    name?: string | undefined;
    lowStockThreshold?: number | undefined;
    internalSku?: string | undefined;
    barcode?: string | undefined;
    sellingPrice?: number | undefined;
    description?: string | undefined;
    categoryId?: string | undefined;
    brandId?: string | undefined;
    barcodeType?: "EAN13" | "EAN8" | "QR" | "CODE128" | "UPC" | "GS1" | "INTERNAL" | undefined;
    taxRuleId?: string | undefined;
    pricingType?: "FIXED" | "WEIGHT" | "LOOSE" | "NEGOTIABLE" | "MRP" | undefined;
    purchasePrice?: number | undefined;
    mrp?: number | undefined;
    unitOfMeasure?: "PCS" | "KG" | "GM" | "LTR" | "ML" | "MTR" | "BOX" | "PAIR" | "DOZEN" | "SQFT" | "PACK" | undefined;
    hasVariants?: boolean | undefined;
    hasBatches?: boolean | undefined;
}, {
    hsnCode?: string | undefined;
    name?: string | undefined;
    lowStockThreshold?: number | undefined;
    internalSku?: string | undefined;
    barcode?: string | undefined;
    sellingPrice?: number | undefined;
    description?: string | undefined;
    categoryId?: string | undefined;
    brandId?: string | undefined;
    barcodeType?: "EAN13" | "EAN8" | "QR" | "CODE128" | "UPC" | "GS1" | "INTERNAL" | undefined;
    taxRuleId?: string | undefined;
    pricingType?: "FIXED" | "WEIGHT" | "LOOSE" | "NEGOTIABLE" | "MRP" | undefined;
    purchasePrice?: number | undefined;
    mrp?: number | undefined;
    unitOfMeasure?: "PCS" | "KG" | "GM" | "LTR" | "ML" | "MTR" | "BOX" | "PAIR" | "DOZEN" | "SQFT" | "PACK" | undefined;
    hasVariants?: boolean | undefined;
    hasBatches?: boolean | undefined;
}>;
export declare const CreateVariantSchema: z.ZodObject<{
    variantSku: z.ZodString;
    barcode: z.ZodOptional<z.ZodString>;
    variantAttributes: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    priceOverride: z.ZodOptional<z.ZodNumber>;
    purchasePrice: z.ZodOptional<z.ZodNumber>;
    initialStock: z.ZodDefault<z.ZodNumber>;
    expiryDate: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    variantSku: string;
    variantAttributes: Record<string, unknown>;
    initialStock: number;
    barcode?: string | undefined;
    purchasePrice?: number | undefined;
    priceOverride?: number | undefined;
    expiryDate?: string | undefined;
}, {
    variantSku: string;
    barcode?: string | undefined;
    purchasePrice?: number | undefined;
    variantAttributes?: Record<string, unknown> | undefined;
    priceOverride?: number | undefined;
    initialStock?: number | undefined;
    expiryDate?: string | undefined;
}>;
export declare const UpdateVariantSchema: z.ZodObject<{
    variantSku: z.ZodOptional<z.ZodString>;
    barcode: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    variantAttributes: z.ZodOptional<z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    priceOverride: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
    purchasePrice: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
    initialStock: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    expiryDate: z.ZodOptional<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    barcode?: string | undefined;
    purchasePrice?: number | undefined;
    variantSku?: string | undefined;
    variantAttributes?: Record<string, unknown> | undefined;
    priceOverride?: number | undefined;
    initialStock?: number | undefined;
    expiryDate?: string | undefined;
}, {
    barcode?: string | undefined;
    purchasePrice?: number | undefined;
    variantSku?: string | undefined;
    variantAttributes?: Record<string, unknown> | undefined;
    priceOverride?: number | undefined;
    initialStock?: number | undefined;
    expiryDate?: string | undefined;
}>;
export declare const ProductListQuerySchema: z.ZodObject<{
    categoryId: z.ZodOptional<z.ZodString>;
    brandId: z.ZodOptional<z.ZodString>;
    pricingType: z.ZodOptional<z.ZodEnum<["FIXED", "WEIGHT", "LOOSE", "NEGOTIABLE", "MRP"]>>;
    isActive: z.ZodDefault<z.ZodBoolean>;
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    isActive: boolean;
    page: number;
    limit: number;
    categoryId?: string | undefined;
    brandId?: string | undefined;
    pricingType?: "FIXED" | "WEIGHT" | "LOOSE" | "NEGOTIABLE" | "MRP" | undefined;
}, {
    isActive?: boolean | undefined;
    page?: number | undefined;
    limit?: number | undefined;
    categoryId?: string | undefined;
    brandId?: string | undefined;
    pricingType?: "FIXED" | "WEIGHT" | "LOOSE" | "NEGOTIABLE" | "MRP" | undefined;
}>;
export declare const ProductSearchQuerySchema: z.ZodObject<{
    q: z.ZodString;
    limit: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    q: string;
}, {
    q: string;
    limit?: number | undefined;
}>;
export declare const CreateCategorySchema: z.ZodObject<{
    name: z.ZodString;
    parentId: z.ZodOptional<z.ZodString>;
    industryType: z.ZodOptional<z.ZodEnum<["APPAREL", "FOOTWEAR", "GROCERY", "PHARMACY", "ELECTRONICS", "HARDWARE", "OPTICAL", "KITCHENWARE", "STATIONERY", "TOYS", "GIFT", "BAKERY", "PAINT", "FURNITURE", "JEWELRY", "BAGS", "TEA_CAFE", "PAAN_CIGARETTE", "PAN_SHOP", "IT_HARDWARE", "GENERAL"]>>;
    sortOrder: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    name: string;
    sortOrder: number;
    industryType?: "APPAREL" | "FOOTWEAR" | "GROCERY" | "PHARMACY" | "ELECTRONICS" | "HARDWARE" | "OPTICAL" | "KITCHENWARE" | "STATIONERY" | "TOYS" | "GIFT" | "BAKERY" | "PAINT" | "FURNITURE" | "JEWELRY" | "BAGS" | "TEA_CAFE" | "PAAN_CIGARETTE" | "GENERAL" | "PAN_SHOP" | "IT_HARDWARE" | undefined;
    parentId?: string | undefined;
}, {
    name: string;
    industryType?: "APPAREL" | "FOOTWEAR" | "GROCERY" | "PHARMACY" | "ELECTRONICS" | "HARDWARE" | "OPTICAL" | "KITCHENWARE" | "STATIONERY" | "TOYS" | "GIFT" | "BAKERY" | "PAINT" | "FURNITURE" | "JEWELRY" | "BAGS" | "TEA_CAFE" | "PAAN_CIGARETTE" | "GENERAL" | "PAN_SHOP" | "IT_HARDWARE" | undefined;
    parentId?: string | undefined;
    sortOrder?: number | undefined;
}>;
export declare const CreateBrandSchema: z.ZodObject<{
    name: z.ZodString;
    manufacturer: z.ZodOptional<z.ZodString>;
    contactInfo: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    manufacturer?: string | undefined;
    contactInfo?: Record<string, unknown> | undefined;
}, {
    name: string;
    manufacturer?: string | undefined;
    contactInfo?: Record<string, unknown> | undefined;
}>;
export declare const SaveProductImageSchema: z.ZodObject<{
    imageUrl: z.ZodString;
    thumbnailUrl: z.ZodOptional<z.ZodString>;
    isPrimary: z.ZodDefault<z.ZodBoolean>;
    cameraAngle: z.ZodOptional<z.ZodEnum<["FRONT", "BACK", "SIDE", "BARCODE", "LABEL", "TOP"]>>;
    lighting: z.ZodOptional<z.ZodEnum<["NATURAL", "FLUORESCENT", "POOR", "BRIGHT"]>>;
    captureDevice: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    imageUrl: string;
    isPrimary: boolean;
    thumbnailUrl?: string | undefined;
    cameraAngle?: "FRONT" | "BACK" | "SIDE" | "BARCODE" | "LABEL" | "TOP" | undefined;
    lighting?: "NATURAL" | "FLUORESCENT" | "POOR" | "BRIGHT" | undefined;
    captureDevice?: string | undefined;
}, {
    imageUrl: string;
    thumbnailUrl?: string | undefined;
    isPrimary?: boolean | undefined;
    cameraAngle?: "FRONT" | "BACK" | "SIDE" | "BARCODE" | "LABEL" | "TOP" | undefined;
    lighting?: "NATURAL" | "FLUORESCENT" | "POOR" | "BRIGHT" | undefined;
    captureDevice?: string | undefined;
}>;
export type CreateProductInput = z.infer<typeof CreateProductSchema>;
export type UpdateProductInput = z.infer<typeof UpdateProductSchema>;
export type CreateVariantInput = z.infer<typeof CreateVariantSchema>;
export type UpdateVariantInput = z.infer<typeof UpdateVariantSchema>;
export type ProductListQuery = z.infer<typeof ProductListQuerySchema>;
export type ProductSearchQuery = z.infer<typeof ProductSearchQuerySchema>;
export type CreateCategoryInput = z.infer<typeof CreateCategorySchema>;
export type CreateBrandInput = z.infer<typeof CreateBrandSchema>;
export type SaveProductImageInput = z.infer<typeof SaveProductImageSchema>;
//# sourceMappingURL=schema.d.ts.map