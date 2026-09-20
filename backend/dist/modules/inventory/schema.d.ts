import { z } from 'zod';
export declare const StockAdjustmentSchema: z.ZodObject<{
    variantId: z.ZodString;
    adjustmentType: z.ZodEnum<["ADJUSTMENT", "DAMAGE", "AUDIT", "RETURN"]>;
    quantityDelta: z.ZodEffects<z.ZodNumber, number, number>;
    notes: z.ZodString;
    batchId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    variantId: string;
    quantityDelta: number;
    notes: string;
    adjustmentType: "ADJUSTMENT" | "AUDIT" | "RETURN" | "DAMAGE";
    batchId?: string | undefined;
}, {
    variantId: string;
    quantityDelta: number;
    notes: string;
    adjustmentType: "ADJUSTMENT" | "AUDIT" | "RETURN" | "DAMAGE";
    batchId?: string | undefined;
}>;
export declare const CreatePurchaseSchema: z.ZodObject<{
    supplierName: z.ZodOptional<z.ZodString>;
    brandId: z.ZodOptional<z.ZodString>;
    invoiceNumber: z.ZodOptional<z.ZodString>;
    purchaseDate: z.ZodDefault<z.ZodString>;
    currencyCode: z.ZodDefault<z.ZodString>;
    exchangeRate: z.ZodDefault<z.ZodNumber>;
    notes: z.ZodOptional<z.ZodString>;
    items: z.ZodArray<z.ZodObject<{
        variantId: z.ZodString;
        quantity: z.ZodNumber;
        unitCost: z.ZodNumber;
        batchNumber: z.ZodOptional<z.ZodString>;
        manufacturingDate: z.ZodOptional<z.ZodString>;
        expiryDate: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        variantId: string;
        quantity: number;
        unitCost: number;
        batchNumber?: string | undefined;
        manufacturingDate?: string | undefined;
        expiryDate?: string | undefined;
    }, {
        variantId: string;
        quantity: number;
        unitCost: number;
        batchNumber?: string | undefined;
        manufacturingDate?: string | undefined;
        expiryDate?: string | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    currencyCode: string;
    purchaseDate: string;
    exchangeRate: number;
    items: {
        variantId: string;
        quantity: number;
        unitCost: number;
        batchNumber?: string | undefined;
        manufacturingDate?: string | undefined;
        expiryDate?: string | undefined;
    }[];
    brandId?: string | undefined;
    notes?: string | undefined;
    supplierName?: string | undefined;
    invoiceNumber?: string | undefined;
}, {
    items: {
        variantId: string;
        quantity: number;
        unitCost: number;
        batchNumber?: string | undefined;
        manufacturingDate?: string | undefined;
        expiryDate?: string | undefined;
    }[];
    currencyCode?: string | undefined;
    brandId?: string | undefined;
    notes?: string | undefined;
    supplierName?: string | undefined;
    invoiceNumber?: string | undefined;
    purchaseDate?: string | undefined;
    exchangeRate?: number | undefined;
}>;
export declare const InventoryMovementQuerySchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
    from: z.ZodOptional<z.ZodString>;
    to: z.ZodOptional<z.ZodString>;
    movementType: z.ZodOptional<z.ZodEnum<["PURCHASE", "SALE", "ADJUSTMENT", "AUDIT", "RETURN", "DAMAGE", "TRANSFER"]>>;
}, "strip", z.ZodTypeAny, {
    page: number;
    limit: number;
    movementType?: "PURCHASE" | "SALE" | "ADJUSTMENT" | "AUDIT" | "RETURN" | "DAMAGE" | "TRANSFER" | undefined;
    from?: string | undefined;
    to?: string | undefined;
}, {
    page?: number | undefined;
    limit?: number | undefined;
    movementType?: "PURCHASE" | "SALE" | "ADJUSTMENT" | "AUDIT" | "RETURN" | "DAMAGE" | "TRANSFER" | undefined;
    from?: string | undefined;
    to?: string | undefined;
}>;
export declare const BatchListQuerySchema: z.ZodObject<{
    variantId: z.ZodOptional<z.ZodString>;
    includeExpired: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    includeExpired: boolean;
    variantId?: string | undefined;
}, {
    variantId?: string | undefined;
    includeExpired?: boolean | undefined;
}>;
export type StockAdjustmentInput = z.infer<typeof StockAdjustmentSchema>;
export type CreatePurchaseInput = z.infer<typeof CreatePurchaseSchema>;
export type InventoryMovementQuery = z.infer<typeof InventoryMovementQuerySchema>;
export type BatchListQuery = z.infer<typeof BatchListQuerySchema>;
//# sourceMappingURL=schema.d.ts.map