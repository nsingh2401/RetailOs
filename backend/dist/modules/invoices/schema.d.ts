import { z } from 'zod';
export declare const LineItemSchema: z.ZodObject<{
    variantId: z.ZodString;
    hsnCode: z.ZodOptional<z.ZodString>;
    batchId: z.ZodOptional<z.ZodString>;
    quantity: z.ZodNumber;
    unitPrice: z.ZodNumber;
    discountPct: z.ZodDefault<z.ZodNumber>;
    discountAmount: z.ZodDefault<z.ZodNumber>;
    taxRuleId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    variantId: string;
    quantity: number;
    unitPrice: number;
    discountPct: number;
    discountAmount: number;
    hsnCode?: string | undefined;
    taxRuleId?: string | undefined;
    batchId?: string | undefined;
}, {
    variantId: string;
    quantity: number;
    unitPrice: number;
    hsnCode?: string | undefined;
    taxRuleId?: string | undefined;
    batchId?: string | undefined;
    discountPct?: number | undefined;
    discountAmount?: number | undefined;
}>;
export declare const CreateInvoiceSchema: z.ZodObject<{
    invoiceDate: z.ZodOptional<z.ZodString>;
    customerId: z.ZodOptional<z.ZodString>;
    invoiceNumber: z.ZodOptional<z.ZodString>;
    currencyCode: z.ZodDefault<z.ZodString>;
    paymentMode: z.ZodOptional<z.ZodEnum<["CASH", "UPI", "CREDIT", "CARD", "CHEQUE", "OTHER"]>>;
    notes: z.ZodOptional<z.ZodString>;
    localId: z.ZodOptional<z.ZodString>;
    lineItems: z.ZodArray<z.ZodObject<{
        variantId: z.ZodString;
        hsnCode: z.ZodOptional<z.ZodString>;
        batchId: z.ZodOptional<z.ZodString>;
        quantity: z.ZodNumber;
        unitPrice: z.ZodNumber;
        discountPct: z.ZodDefault<z.ZodNumber>;
        discountAmount: z.ZodDefault<z.ZodNumber>;
        taxRuleId: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        variantId: string;
        quantity: number;
        unitPrice: number;
        discountPct: number;
        discountAmount: number;
        hsnCode?: string | undefined;
        taxRuleId?: string | undefined;
        batchId?: string | undefined;
    }, {
        variantId: string;
        quantity: number;
        unitPrice: number;
        hsnCode?: string | undefined;
        taxRuleId?: string | undefined;
        batchId?: string | undefined;
        discountPct?: number | undefined;
        discountAmount?: number | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    currencyCode: string;
    lineItems: {
        variantId: string;
        quantity: number;
        unitPrice: number;
        discountPct: number;
        discountAmount: number;
        hsnCode?: string | undefined;
        taxRuleId?: string | undefined;
        batchId?: string | undefined;
    }[];
    customerId?: string | undefined;
    notes?: string | undefined;
    invoiceNumber?: string | undefined;
    invoiceDate?: string | undefined;
    paymentMode?: "CASH" | "UPI" | "CREDIT" | "CARD" | "CHEQUE" | "OTHER" | undefined;
    localId?: string | undefined;
}, {
    lineItems: {
        variantId: string;
        quantity: number;
        unitPrice: number;
        hsnCode?: string | undefined;
        taxRuleId?: string | undefined;
        batchId?: string | undefined;
        discountPct?: number | undefined;
        discountAmount?: number | undefined;
    }[];
    currencyCode?: string | undefined;
    customerId?: string | undefined;
    notes?: string | undefined;
    invoiceNumber?: string | undefined;
    invoiceDate?: string | undefined;
    paymentMode?: "CASH" | "UPI" | "CREDIT" | "CARD" | "CHEQUE" | "OTHER" | undefined;
    localId?: string | undefined;
}>;
export declare const RecordPaymentSchema: z.ZodObject<{
    paymentMethod: z.ZodEnum<["CASH", "UPI", "CREDIT", "CARD", "CHEQUE", "OTHER"]>;
    amount: z.ZodNumber;
    currencyCode: z.ZodDefault<z.ZodString>;
    referenceNo: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    currencyCode: string;
    paymentMethod: "CASH" | "UPI" | "CREDIT" | "CARD" | "CHEQUE" | "OTHER";
    amount: number;
    referenceNo?: string | undefined;
}, {
    paymentMethod: "CASH" | "UPI" | "CREDIT" | "CARD" | "CHEQUE" | "OTHER";
    amount: number;
    currencyCode?: string | undefined;
    referenceNo?: string | undefined;
}>;
export declare const InvoiceListQuerySchema: z.ZodObject<{
    status: z.ZodOptional<z.ZodEnum<["DRAFT", "CONFIRMED", "PAID", "PARTIAL", "CANCELLED"]>>;
    from: z.ZodOptional<z.ZodString>;
    to: z.ZodOptional<z.ZodString>;
    customerId: z.ZodOptional<z.ZodString>;
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    page: number;
    limit: number;
    status?: "DRAFT" | "CONFIRMED" | "PAID" | "PARTIAL" | "CANCELLED" | undefined;
    customerId?: string | undefined;
    from?: string | undefined;
    to?: string | undefined;
}, {
    status?: "DRAFT" | "CONFIRMED" | "PAID" | "PARTIAL" | "CANCELLED" | undefined;
    page?: number | undefined;
    limit?: number | undefined;
    customerId?: string | undefined;
    from?: string | undefined;
    to?: string | undefined;
}>;
export declare const CancelInvoiceSchema: z.ZodObject<{
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reason: string;
}, {
    reason: string;
}>;
export type CreateInvoiceInput = z.infer<typeof CreateInvoiceSchema>;
export type RecordPaymentInput = z.infer<typeof RecordPaymentSchema>;
export type InvoiceListQuery = z.infer<typeof InvoiceListQuerySchema>;
export type CancelInvoiceInput = z.infer<typeof CancelInvoiceSchema>;
//# sourceMappingURL=schema.d.ts.map