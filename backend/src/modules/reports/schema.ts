import { z } from 'zod';

// ── Date range with optional groupBy ──────────────────────────
export const DateRangeQuerySchema = z.object({
  from:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'from must be YYYY-MM-DD' }),
  to:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'to must be YYYY-MM-DD' }),
  groupBy: z.enum(['day', 'week', 'month']).optional().default('day'),
});

// ── Top products with sort option ─────────────────────────────
export const TopProductsQuerySchema = z.object({
  from:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'from must be YYYY-MM-DD' }),
  to:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'to must be YYYY-MM-DD' }),
  limit:  z.coerce.number().int().min(1).max(50).default(10),
  sortBy: z.enum(['revenue', 'quantity']).default('revenue'),
});

// ── Simple date range (no groupBy) ────────────────────────────
export const ReportBaseQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'from must be YYYY-MM-DD' }),
  to:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'to must be YYYY-MM-DD' }),
});

// ── Export query ──────────────────────────────────────────────
export const ExportQuerySchema = z.object({
  type:   z.enum(['gstr1', 'gstr3b', 'sales']),
  format: z.enum(['json', 'excel']),
  from:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'from must be YYYY-MM-DD' }),
  to:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'to must be YYYY-MM-DD' }),
});

// ── Tally export query ────────────────────────────────────────
export const TallyExportQuerySchema = z.object({
  format:       z.enum(['xml', 'csv']),
  tallyVersion: z.enum(['erp9', 'prime']).default('prime'),
  from:         z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'from must be YYYY-MM-DD' }),
  to:           z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'to must be YYYY-MM-DD' }),
});

// ── Types ──────────────────────────────────────────────────────
export type DateRangeQuery    = z.infer<typeof DateRangeQuerySchema>;
export type TopProductsQuery  = z.infer<typeof TopProductsQuerySchema>;
export type ReportBaseQuery   = z.infer<typeof ReportBaseQuerySchema>;
export type ExportQuery       = z.infer<typeof ExportQuerySchema>;
export type TallyExportQuery  = z.infer<typeof TallyExportQuerySchema>;
