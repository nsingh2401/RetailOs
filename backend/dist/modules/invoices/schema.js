"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CancelInvoiceSchema = exports.InvoiceListQuerySchema = exports.RecordPaymentSchema = exports.CreateInvoiceSchema = exports.LineItemSchema = void 0;
const zod_1 = require("zod");
exports.LineItemSchema = zod_1.z.object({
    variantId: zod_1.z.string().uuid(),
    hsnCode: zod_1.z.string().optional(),
    batchId: zod_1.z.string().uuid().optional(),
    quantity: zod_1.z.number().positive(),
    unitPrice: zod_1.z.number().nonnegative(),
    discountPct: zod_1.z.number().min(0).max(100).default(0),
    discountAmount: zod_1.z.number().nonnegative().default(0),
    taxRuleId: zod_1.z.string().uuid().optional(),
});
exports.CreateInvoiceSchema = zod_1.z.object({
    invoiceDate: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    customerId: zod_1.z.string().uuid().optional(),
    invoiceNumber: zod_1.z.string().optional(), // Auto-generated if omitted
    currencyCode: zod_1.z.string().length(3).default('INR'),
    paymentMode: zod_1.z.enum(['CASH', 'UPI', 'CREDIT', 'CARD', 'CHEQUE', 'OTHER']).optional(),
    notes: zod_1.z.string().optional(),
    localId: zod_1.z.string().optional(), // WatermelonDB/Drift offline UUID
    lineItems: zod_1.z.array(exports.LineItemSchema).min(1, 'At least one line item required'),
});
exports.RecordPaymentSchema = zod_1.z.object({
    paymentMethod: zod_1.z.enum(['CASH', 'UPI', 'CREDIT', 'CARD', 'CHEQUE', 'OTHER']),
    amount: zod_1.z.number().positive(),
    currencyCode: zod_1.z.string().length(3).default('INR'),
    referenceNo: zod_1.z.string().optional(), // UPI txn ID, cheque no, etc.
});
exports.InvoiceListQuerySchema = zod_1.z.object({
    status: zod_1.z.enum(['DRAFT', 'CONFIRMED', 'PAID', 'PARTIAL', 'CANCELLED']).optional(),
    from: zod_1.z.string().datetime().optional(),
    to: zod_1.z.string().datetime().optional(),
    customerId: zod_1.z.string().uuid().optional(),
    page: zod_1.z.coerce.number().int().positive().default(1),
    limit: zod_1.z.coerce.number().int().min(1).max(100).default(20),
});
exports.CancelInvoiceSchema = zod_1.z.object({
    reason: zod_1.z.string().min(1),
});
//# sourceMappingURL=schema.js.map