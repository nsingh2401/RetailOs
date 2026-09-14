"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TallyExportQuerySchema = exports.ExportQuerySchema = exports.ReportBaseQuerySchema = exports.TopProductsQuerySchema = exports.DateRangeQuerySchema = void 0;
const zod_1 = require("zod");
// ── Date range with optional groupBy ──────────────────────────
exports.DateRangeQuerySchema = zod_1.z.object({
    from: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'from must be YYYY-MM-DD' }),
    to: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'to must be YYYY-MM-DD' }),
    groupBy: zod_1.z.enum(['day', 'week', 'month']).optional().default('day'),
});
// ── Top products with sort option ─────────────────────────────
exports.TopProductsQuerySchema = zod_1.z.object({
    from: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'from must be YYYY-MM-DD' }),
    to: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'to must be YYYY-MM-DD' }),
    limit: zod_1.z.coerce.number().int().min(1).max(50).default(10),
    sortBy: zod_1.z.enum(['revenue', 'quantity']).default('revenue'),
});
// ── Simple date range (no groupBy) ────────────────────────────
exports.ReportBaseQuerySchema = zod_1.z.object({
    from: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'from must be YYYY-MM-DD' }),
    to: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'to must be YYYY-MM-DD' }),
});
// ── Export query ──────────────────────────────────────────────
exports.ExportQuerySchema = zod_1.z.object({
    type: zod_1.z.enum(['gstr1', 'gstr3b', 'sales']),
    format: zod_1.z.enum(['json', 'excel']),
    from: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'from must be YYYY-MM-DD' }),
    to: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'to must be YYYY-MM-DD' }),
});
// ── Tally export query ────────────────────────────────────────
exports.TallyExportQuerySchema = zod_1.z.object({
    format: zod_1.z.enum(['xml', 'csv']),
    tallyVersion: zod_1.z.enum(['erp9', 'prime']).default('prime'),
    from: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'from must be YYYY-MM-DD' }),
    to: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'to must be YYYY-MM-DD' }),
});
//# sourceMappingURL=schema.js.map