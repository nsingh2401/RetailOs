"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateStoreTaxRuleSchema = exports.HsnSearchQuerySchema = exports.UpdateTaxRuleSchema = exports.CreateTaxRuleSchema = void 0;
const zod_1 = require("zod");
const TaxComponentSchema = zod_1.z.object({
    componentName: zod_1.z.string().min(1).max(50),
    rate: zod_1.z.number().nonnegative(),
    ledgerAccount: zod_1.z.string().max(50).optional(),
});
exports.CreateTaxRuleSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(100),
    taxRegime: zod_1.z.enum(['GST', 'VAT', 'SALES_TAX', 'EXEMPT', 'CUSTOM']),
    countryCode: zod_1.z.string().length(2).default('IN'),
    totalRate: zod_1.z.number().nonnegative(),
    isInclusive: zod_1.z.boolean().default(false),
    components: zod_1.z.array(TaxComponentSchema).default([]),
});
exports.UpdateTaxRuleSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(100).optional(),
    totalRate: zod_1.z.number().nonnegative().optional(),
    isInclusive: zod_1.z.boolean().optional(),
    isActive: zod_1.z.boolean().optional(),
});
exports.HsnSearchQuerySchema = zod_1.z.object({
    q: zod_1.z.string().min(1),
    limit: zod_1.z.coerce.number().int().min(1).max(50).default(20),
});
exports.CreateStoreTaxRuleSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(100),
    totalRate: zod_1.z.number().nonnegative(),
    isInclusive: zod_1.z.boolean().default(false),
});
//# sourceMappingURL=schema.js.map