"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreditLedgerQuerySchema = exports.RecordCreditPaymentSchema = exports.CustomerListQuerySchema = exports.CustomerSearchQuerySchema = exports.UpdateCustomerSchema = exports.CreateCustomerSchema = void 0;
const zod_1 = require("zod");
// ── Address sub-schema ─────────────────────────────────────────
const AddressSchema = zod_1.z.object({
    line1: zod_1.z.string().optional(),
    city: zod_1.z.string().optional(),
    state: zod_1.z.string().optional(),
    pincode: zod_1.z.string().optional(),
    country: zod_1.z.string().optional(),
});
// ── Create ─────────────────────────────────────────────────────
exports.CreateCustomerSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(200),
    phone: zod_1.z.string().regex(/^\+[1-9]\d{7,14}$/).optional(),
    email: zod_1.z.string().email().optional(),
    address: AddressSchema.optional(),
    creditLimit: zod_1.z.number().nonnegative().default(0),
    notes: zod_1.z.string().optional(),
});
// ── Update ─────────────────────────────────────────────────────
exports.UpdateCustomerSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(200).optional(),
    phone: zod_1.z.string().regex(/^\+[1-9]\d{7,14}$/).optional(),
    email: zod_1.z.string().email().optional(),
    address: AddressSchema.optional(),
    creditLimit: zod_1.z.number().nonnegative().optional(),
    notes: zod_1.z.string().optional(),
    isActive: zod_1.z.boolean().optional(),
});
// ── Search ─────────────────────────────────────────────────────
exports.CustomerSearchQuerySchema = zod_1.z.object({
    q: zod_1.z.string().min(1),
    limit: zod_1.z.coerce.number().int().min(1).max(50).default(10),
});
// ── List ───────────────────────────────────────────────────────
exports.CustomerListQuerySchema = zod_1.z.object({
    hasBalance: zod_1.z.coerce.boolean().optional(),
    page: zod_1.z.coerce.number().int().positive().default(1),
    limit: zod_1.z.coerce.number().int().min(1).max(100).default(20),
});
// ── Credit payment ─────────────────────────────────────────────
exports.RecordCreditPaymentSchema = zod_1.z.object({
    amount: zod_1.z.number().positive(),
    paymentMethod: zod_1.z.enum(['CASH', 'UPI', 'CARD', 'CHEQUE', 'OTHER']),
    referenceNo: zod_1.z.string().optional(),
    notes: zod_1.z.string().optional(),
});
// ── Credit ledger query ────────────────────────────────────────
exports.CreditLedgerQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().positive().default(1),
    limit: zod_1.z.coerce.number().int().min(1).max(100).default(20),
});
//# sourceMappingURL=schema.js.map