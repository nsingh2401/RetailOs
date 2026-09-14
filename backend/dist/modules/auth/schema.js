"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SignupSchema = exports.ResetPasswordSchema = exports.ForgotPasswordSchema = exports.SetPasswordSchema = exports.LoginSchema = exports.UpdateOrgSettingsSchema = exports.UpdateStoreSchema = exports.CreateStoreSchema = exports.UpdateStoreRoleSchema = exports.AssignStoreRoleSchema = exports.UpdateUserSchema = exports.InviteUserSchema = exports.VerifyTokenSchema = void 0;
const zod_1 = require("zod");
exports.VerifyTokenSchema = zod_1.z.object({
    idToken: zod_1.z.string().min(1, 'idToken is required'),
});
exports.InviteUserSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    phone: zod_1.z.string().regex(/^\+[1-9]\d{7,14}$/).optional(),
    email: zod_1.z.string().email().optional(),
    userType: zod_1.z.enum(['OWNER', 'MANAGER', 'OPERATOR']),
}).refine(d => d.phone || d.email, { message: 'phone or email is required' });
exports.UpdateUserSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).optional(),
    phone: zod_1.z.string().regex(/^\+[1-9]\d{7,14}$/).optional(),
    isActive: zod_1.z.boolean().optional(),
});
exports.AssignStoreRoleSchema = zod_1.z.object({
    userId: zod_1.z.string().uuid(),
    role: zod_1.z.enum(['OWNER', 'MANAGER', 'OPERATOR']),
});
exports.UpdateStoreRoleSchema = zod_1.z.object({
    role: zod_1.z.enum(['OWNER', 'MANAGER', 'OPERATOR']),
});
// ── Address sub-object (reused in store schemas) ──────────────
const AddressSchema = zod_1.z.object({
    line1: zod_1.z.string().optional(),
    city: zod_1.z.string().optional(),
    state: zod_1.z.string().optional(),
    pincode: zod_1.z.string().optional(),
    country: zod_1.z.string().optional(),
});
// ── Create store ───────────────────────────────────────────────
exports.CreateStoreSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(200),
    storeCode: zod_1.z.string().min(1).max(30),
    industryType: zod_1.z.enum([
        'APPAREL', 'FOOTWEAR', 'GROCERY', 'PHARMACY', 'ELECTRONICS',
        'HARDWARE', 'OPTICAL', 'KITCHENWARE', 'STATIONERY', 'TOYS',
        'GIFT', 'BAKERY', 'PAINT', 'FURNITURE', 'JEWELRY', 'BAGS',
        'TEA_CAFE', 'PAAN_CIGARETTE', 'GENERAL',
    ]).default('GENERAL'),
    phone: zod_1.z.string().optional(),
    gstin: zod_1.z.string().max(20).optional(),
    currencyCode: zod_1.z.string().length(3).default('INR'),
    timezone: zod_1.z.string().default('Asia/Kolkata'),
    lowStockThreshold: zod_1.z.number().int().default(10),
    address: AddressSchema.optional(),
});
// ── Update store ───────────────────────────────────────────────
exports.UpdateStoreSchema = zod_1.z.object({
    name: zod_1.z.string().optional(),
    phone: zod_1.z.string().optional(),
    gstin: zod_1.z.string().optional(),
    lowStockThreshold: zod_1.z.number().int().optional(),
    address: AddressSchema.optional(),
    isActive: zod_1.z.boolean().optional(),
});
// ── Update org settings ────────────────────────────────────────
exports.UpdateOrgSettingsSchema = zod_1.z.object({
    settings: zod_1.z.record(zod_1.z.unknown()),
    defaultCurrency: zod_1.z.string().length(3).optional(),
    locale: zod_1.z.string().optional(),
});
exports.LoginSchema = zod_1.z.object({
    phone: zod_1.z.string().regex(/^\+[1-9]\d{7,14}$/),
    password: zod_1.z.string().min(6),
});
exports.SetPasswordSchema = zod_1.z.object({
    password: zod_1.z.string().min(6),
    confirmPassword: zod_1.z.string().min(6),
}).refine(d => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
});
exports.ForgotPasswordSchema = zod_1.z.object({
    phone: zod_1.z.string().regex(/^\+[1-9]\d{7,14}$/),
});
exports.ResetPasswordSchema = zod_1.z.object({
    phone: zod_1.z.string().regex(/^\+[1-9]\d{7,14}$/),
    idToken: zod_1.z.string().min(1),
    newPassword: zod_1.z.string().min(6),
    confirmPassword: zod_1.z.string().min(6),
}).refine(d => d.newPassword === d.confirmPassword, {
    message: 'Passwords do not match',
});
exports.SignupSchema = zod_1.z.object({
    idToken: zod_1.z.string().min(1),
    ownerName: zod_1.z.string().min(1).max(150),
    phone: zod_1.z.string().regex(/^\+[1-9]\d{7,14}$/),
    businessName: zod_1.z.string().min(1).max(200),
    storeName: zod_1.z.string().min(1).max(200),
    password: zod_1.z.string().min(6),
    industryType: zod_1.z.enum([
        'GROCERY', 'PHARMACY', 'APPAREL', 'FOOTWEAR',
        'OPTICAL', 'BAKERY', 'HARDWARE', 'ELECTRONICS',
        'ELECTRICAL', 'JEWELRY', 'FURNITURE', 'PAINT',
        'STATIONERY', 'GIFT', 'KITCHENWARE', 'TOYS',
        'TEA_CAFE', 'BAGS', 'GENERAL',
    ]),
});
//# sourceMappingURL=schema.js.map