// @ts-nocheck
import { FastifyRequest, FastifyReply } from 'fastify';
import { Prisma } from '@prisma/client';
import ExcelJS from 'exceljs';
import { prisma } from '../../lib/prisma';
import {
  DateRangeQuerySchema,
  TopProductsQuerySchema,
  ReportBaseQuerySchema,
  ExportQuerySchema,
  TallyExportQuerySchema,
} from './schema';
import type {
  DateRangeQuery,
  TopProductsQuery,
  ReportBaseQuery,
  ExportQuery,
  TallyExportQuery,
} from './schema';

// â”€â”€ Role guard helper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function denyIfNotManager(request: FastifyRequest, reply: FastifyReply): boolean {
  if (request.storeRole !== 'OWNER' && request.storeRole !== 'MANAGER') {
    reply.status(403).send({
      success: false,
      error: { code: 'FORBIDDEN', message: 'MANAGER or OWNER role required', statusCode: 403 },
    });
    return true;
  }
  return false;
}

// â”€â”€ GST row types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
interface GstrB2CLargeRow {
  invoice_number:  unknown;
  invoice_date:    unknown;
  grand_total:     unknown;
  taxable_amount:  unknown;
  tax_amount:      unknown;
  blended_tax_rate: unknown;
}
interface GstrB2CSmallRow {
  tax_rate:       unknown;
  taxable_amount: unknown;
  tax_amount:     unknown;
}
interface GstrHsnRow {
  hsn_code:        unknown;
  hsn_description: unknown;
  unit_of_measure: unknown;
  total_quantity:  unknown;
  taxable_amount:  unknown;
  tax_amount:      unknown;
}
interface Gstr3bRateRow {
  tax_rate:       unknown;
  taxable_amount: unknown;
  tax_amount:     unknown;
}

// â”€â”€ Row types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
interface DailySalesRow {
  invoice_date:        unknown;
  invoice_count:       unknown;
  total_revenue_base:  unknown;
  total_tax:           unknown;
  total_discount:      unknown;
  unique_customers:    unknown;
}

interface TopProductRow {
  variant_id:    unknown;
  product_name:  unknown;
  total_revenue: unknown;
  total_quantity: unknown;
  invoice_count: unknown;
}

interface SlowMoverRow {
  variant_id:      unknown;
  product_name:    unknown;
  variant_sku:     unknown;
  current_stock:   unknown;
  unit_of_measure: unknown;
  total_sold:      unknown;
  prev_sold:       unknown;
}

interface TaxSummaryRow {
  hsn_code:        unknown;
  hsn_description: unknown;
  taxable_amount:  unknown;
  total_tax:       unknown;
  invoice_count:   unknown;
}

interface CreditAgingRow {
  customer_id:         unknown;
  customer_name:       unknown;
  phone:               unknown;
  outstanding_balance: unknown;
  oldest_entry_days:   unknown;
}

interface PurchaseSummaryRow {
  brand_id:      unknown;
  brand_name:    unknown;
  purchase_count: unknown;
  total_amount:  unknown;
}

interface PaymentModeRow {
  payment_mode:   unknown;
  invoice_count:  unknown;
  total_amount:   unknown;
}

// Convert any BigInt values in a raw SQL result row to Number
function serializeRow<T extends Record<string, unknown>>(row: T): T {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    result[key] = typeof value === 'bigint' ? Number(value) : value;
  }
  return result as T;
}

// â”€â”€ GET /:storeId/reports/sales-summary â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export async function getSalesSummary(
  request: FastifyRequest<{ Params: { storeId: string }; Querystring: DateRangeQuery }>,
  reply: FastifyReply,
) {
  if (denyIfNotManager(request, reply)) return;

  const storeId = request.storeId;

  const parsed = DateRangeQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message, statusCode: 400 } });
  }
  const { from, to } = parsed.data;
  const fromDate = new Date(from);
  const toDate   = new Date(to);

  const rawRows = await prisma.$queryRaw<DailySalesRow[]>(
    Prisma.sql`
      SELECT
        invoice_date,
        invoice_count,
        total_revenue_base,
        total_tax,
        total_discount,
        unique_customers
      FROM v_daily_sales
      WHERE store_id     = ${storeId}::uuid
        AND invoice_date >= ${fromDate}::date
        AND invoice_date <= ${toDate}::date
      ORDER BY invoice_date DESC
    `,
  );
  const rows = rawRows.map(serializeRow);

  const totals = {
    invoiceCount:      rows.reduce((s, r) => s + Number(r.invoice_count ?? 0), 0),
    totalRevenueBase:  rows.reduce((s, r) => s + Number(r.total_revenue_base ?? 0), 0),
    totalTax:          rows.reduce((s, r) => s + Number(r.total_tax ?? 0), 0),
    totalDiscount:     rows.reduce((s, r) => s + Number(r.total_discount ?? 0), 0),
    uniqueCustomers:   rows.reduce((m, r) => Math.max(m, Number(r.unique_customers ?? 0)), 0),
  };

  return reply.send({
    success: true,
    data: {
      period: { from, to },
      totals,
      breakdown: rows,
    },
  });
}

// â”€â”€ GET /:storeId/reports/top-products â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export async function getTopProducts(
  request: FastifyRequest<{ Params: { storeId: string }; Querystring: TopProductsQuery }>,
  reply: FastifyReply,
) {
  if (denyIfNotManager(request, reply)) return;

  const storeId = request.storeId;

  const parsed = TopProductsQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message, statusCode: 400 } });
  }
  const { from, to, limit, sortBy } = parsed.data;
  const fromDate  = new Date(from);
  const toDate    = new Date(to);
  const orderCol  = sortBy === 'quantity' ? Prisma.raw('total_quantity') : Prisma.raw('total_revenue');

  const rawRows = await prisma.$queryRaw<TopProductRow[]>(
    Prisma.sql`
      SELECT
        ili.variant_id,
        ili.product_name,
        SUM(ili.line_total)              AS total_revenue,
        SUM(ili.quantity)                AS total_quantity,
        COUNT(DISTINCT i.invoice_id)     AS invoice_count
      FROM invoice_line_items ili
      JOIN invoices i ON i.invoice_id = ili.invoice_id
      WHERE i.store_id     = ${storeId}::uuid
        AND i.status       IN ('PAID', 'CONFIRMED', 'PARTIAL')
        AND i.invoice_date >= ${fromDate}::date
        AND i.invoice_date <= ${toDate}::date
      GROUP BY ili.variant_id, ili.product_name
      ORDER BY ${orderCol} DESC
      LIMIT ${limit}
    `,
  );
  const rows = rawRows.map(serializeRow);

  return reply.send({ success: true, data: rows });
}

// â”€â”€ GET /:storeId/reports/slow-movers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export async function getSlowMovers(
  request: FastifyRequest<{ Params: { storeId: string }; Querystring: ReportBaseQuery }>,
  reply: FastifyReply,
) {
  if (denyIfNotManager(request, reply)) return;

  const storeId = request.storeId;

  const parsed = ReportBaseQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message, statusCode: 400 } });
  }
  const { from, to } = parsed.data;
  const fromDate = new Date(from);
  const toDate   = new Date(to);

  const storeRow = await prisma.store.findUnique({
    where:  { storeId },
    select: { slowMoverThreshold: true, lowStockThreshold: true },
  });
  const threshold       = storeRow?.slowMoverThreshold ?? 5;
  const lowStockThresh  = storeRow?.lowStockThreshold  ?? 10;

  // Previous period of same length immediately before current period
  const periodMs    = toDate.getTime() - fromDate.getTime();
  const prevToDate  = new Date(fromDate.getTime() - 86_400_000);
  const prevFromDate = new Date(prevToDate.getTime() - periodMs);

  const rawRows = await prisma.$queryRaw<SlowMoverRow[]>(
    Prisma.sql`
      WITH current_sales AS (
        SELECT ili.variant_id, SUM(ili.quantity) AS total_sold
        FROM invoice_line_items ili
        JOIN invoices i ON i.invoice_id = ili.invoice_id
        WHERE i.store_id = ${storeId}::uuid
          AND i.status   IN ('PAID', 'CONFIRMED', 'PARTIAL')
          AND DATE(i.invoice_date) >= ${fromDate}::date
          AND DATE(i.invoice_date) <= ${toDate}::date
        GROUP BY ili.variant_id
      ),
      prev_sales AS (
        SELECT ili.variant_id, SUM(ili.quantity) AS total_sold
        FROM invoice_line_items ili
        JOIN invoices i ON i.invoice_id = ili.invoice_id
        WHERE i.store_id = ${storeId}::uuid
          AND i.status   IN ('PAID', 'CONFIRMED', 'PARTIAL')
          AND DATE(i.invoice_date) >= ${prevFromDate}::date
          AND DATE(i.invoice_date) <= ${prevToDate}::date
        GROUP BY ili.variant_id
      )
      SELECT
        v.variant_id,
        v.product_name,
        v.variant_sku,
        v.current_stock,
        v.unit_of_measure,
        COALESCE(cur.total_sold,  0) AS total_sold,
        COALESCE(prev.total_sold, 0) AS prev_sold
      FROM v_stock_levels v
      LEFT JOIN current_sales cur  ON cur.variant_id  = v.variant_id
      LEFT JOIN prev_sales    prev ON prev.variant_id = v.variant_id
      WHERE v.store_id      = ${storeId}::uuid
        AND v.current_stock > 0
        AND v.current_stock > ${lowStockThresh}
        AND (
          COALESCE(cur.total_sold, 0) < ${threshold}
          OR (
            COALESCE(prev.total_sold, 0) > 0
            AND COALESCE(cur.total_sold, 0) < COALESCE(prev.total_sold, 0) * 0.5
          )
        )
      ORDER BY v.current_stock DESC
      LIMIT 20
    `,
  );
  const rows = rawRows.map(serializeRow);

  return reply.send({ success: true, data: rows });
}

// â”€â”€ GET /:storeId/reports/tax-summary â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export async function getTaxSummary(
  request: FastifyRequest<{ Params: { storeId: string }; Querystring: ReportBaseQuery }>,
  reply: FastifyReply,
) {
  if (denyIfNotManager(request, reply)) return;

  const storeId = request.storeId;

  const parsed = ReportBaseQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message, statusCode: 400 } });
  }
  const { from, to } = parsed.data;
  const fromDate = new Date(from);
  const toDate   = new Date(to);

  const rawRows = await prisma.$queryRaw<TaxSummaryRow[]>(
    Prisma.sql`
      SELECT
        ili.hsn_code,
        h.description                    AS hsn_description,
        SUM(ili.taxable_amount)          AS taxable_amount,
        SUM(ili.tax_amount)              AS total_tax,
        COUNT(DISTINCT i.invoice_id)     AS invoice_count
      FROM invoice_line_items ili
      JOIN invoices i ON i.invoice_id = ili.invoice_id
      LEFT JOIN hsn_codes h ON h.hsn_code = ili.hsn_code
      WHERE i.store_id     = ${storeId}::uuid
        AND i.status       IN ('PAID', 'CONFIRMED', 'PARTIAL')
        AND i.invoice_date >= ${fromDate}::date
        AND i.invoice_date <= ${toDate}::date
      GROUP BY ili.hsn_code, h.description
      ORDER BY total_tax DESC
    `,
  );
  const rows = rawRows.map(serializeRow);

  const totalTaxableRevenue = rows.reduce((s, r) => s + Number(r.taxable_amount ?? 0), 0);
  const totalTaxCollected   = rows.reduce((s, r) => s + Number(r.total_tax ?? 0), 0);

  return reply.send({
    success: true,
    data: {
      period: { from, to },
      totalTaxableRevenue,
      totalTaxCollected,
      breakdown: rows,
    },
  });
}

// â”€â”€ GET /:storeId/reports/credit-aging â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export async function getCreditAging(
  request: FastifyRequest<{ Params: { storeId: string }; Querystring: ReportBaseQuery }>,
  reply: FastifyReply,
) {
  if (denyIfNotManager(request, reply)) return;

  const storeId = request.storeId;

  const parsed = ReportBaseQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message, statusCode: 400 } });
  }

  const rawRows = await prisma.$queryRaw<CreditAgingRow[]>(
    Prisma.sql`
      WITH oldest_entry AS (
        SELECT
          customer_id,
          MIN(created_at) AS oldest_credit_date
        FROM customer_credit_ledger
        WHERE store_id   = ${storeId}::uuid
          AND entry_type = 'CREDIT_SALE'
        GROUP BY customer_id
      )
      SELECT
        c.customer_id,
        c.name             AS customer_name,
        c.phone,
        c.outstanding_balance,
        COALESCE(
          EXTRACT(DAY FROM NOW() - oe.oldest_credit_date)::int,
          0
        ) AS oldest_entry_days
      FROM customers c
      LEFT JOIN oldest_entry oe ON oe.customer_id = c.customer_id
      WHERE c.store_id           = ${storeId}::uuid
        AND c.outstanding_balance > 0
        AND c.is_active           = true
      ORDER BY c.outstanding_balance DESC
    `,
  );
  const rows = rawRows.map(serializeRow);

  const buckets = {
    '0_30_days':    { customerCount: 0, amount: 0 },
    '31_60_days':   { customerCount: 0, amount: 0 },
    '61_90_days':   { customerCount: 0, amount: 0 },
    'over_90_days': { customerCount: 0, amount: 0 },
  };

  const customers = rows.map((r) => {
    const days    = Number(r.oldest_entry_days ?? 0);
    const balance = Number(r.outstanding_balance ?? 0);

    let bucket: keyof typeof buckets;
    if      (days <= 30) bucket = '0_30_days';
    else if (days <= 60) bucket = '31_60_days';
    else if (days <= 90) bucket = '61_90_days';
    else                 bucket = 'over_90_days';

    buckets[bucket].customerCount += 1;
    buckets[bucket].amount        += balance;

    return { ...r, bucket };
  });

  const totalOutstanding = rows.reduce((s, r) => s + Number(r.outstanding_balance ?? 0), 0);

  return reply.send({
    success: true,
    data: {
      totalOutstanding,
      buckets,
      customers,
    },
  });
}

// â”€â”€ GET /:storeId/reports/purchase-summary â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export async function getPurchaseSummary(
  request: FastifyRequest<{ Params: { storeId: string }; Querystring: ReportBaseQuery }>,
  reply: FastifyReply,
) {
  if (denyIfNotManager(request, reply)) return;

  const storeId = request.storeId;

  const parsed = ReportBaseQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message, statusCode: 400 } });
  }
  const { from, to } = parsed.data;
  const fromDate = new Date(from);
  const toDate   = new Date(to);

  const rawRows = await prisma.$queryRaw<PurchaseSummaryRow[]>(
    Prisma.sql`
      SELECT
        pe.brand_id,
        b.name                         AS brand_name,
        COUNT(*)                        AS purchase_count,
        SUM(pe.total_amount_base)       AS total_amount
      FROM purchase_entries pe
      LEFT JOIN brands b ON b.brand_id = pe.brand_id
      WHERE pe.store_id      = ${storeId}::uuid
        AND pe.purchase_date >= ${fromDate}::date
        AND pe.purchase_date <= ${toDate}::date
      GROUP BY pe.brand_id, b.name
      ORDER BY total_amount DESC
    `,
  );
  const rows = rawRows.map(serializeRow);

  const grandTotal = rows.reduce((s, r) => s + Number(r.total_amount ?? 0), 0);

  return reply.send({
    success: true,
    data: {
      period: { from, to },
      grandTotal,
      breakdown: rows,
    },
  });
}

// â”€â”€ GET /:storeId/reports/payment-modes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export async function getPaymentModes(
  request: FastifyRequest<{ Params: { storeId: string }; Querystring: ReportBaseQuery }>,
  reply: FastifyReply,
) {
  if (denyIfNotManager(request, reply)) return;

  const storeId = request.storeId;

  const parsed = ReportBaseQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message, statusCode: 400 } });
  }
  const { from, to } = parsed.data;
  const fromDate = new Date(from);
  const toDate   = new Date(to);

  const rawRows = await prisma.$queryRaw<PaymentModeRow[]>(
    Prisma.sql`
      SELECT
        payment_mode,
        COUNT(*)            AS invoice_count,
        SUM(grand_total)    AS total_amount
      FROM invoices
      WHERE store_id     = ${storeId}::uuid
        AND status       IN ('PAID', 'CONFIRMED', 'PARTIAL')
        AND invoice_date >= ${fromDate}::date
        AND invoice_date <= ${toDate}::date
        AND payment_mode IS NOT NULL
      GROUP BY payment_mode
      ORDER BY total_amount DESC
    `,
  );
  const rows = rawRows.map(serializeRow);

  const grandTotal = rows.reduce((s, r) => s + Number(r.total_amount ?? 0), 0);

  return reply.send({
    success: true,
    data: {
      period: { from, to },
      grandTotal,
      breakdown: rows,
    },
  });
}

// â”€â”€ Shared: fetch GSTR-1 data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function fetchGstr1Data(storeId: string, fromDate: Date, toDate: Date) {
  const [b2cLargeRaw, b2cSmallRaw, hsnRaw] = await Promise.all([
    prisma.$queryRaw<GstrB2CLargeRow[]>(Prisma.sql`
      SELECT
        i.invoice_number,
        i.invoice_date,
        i.grand_total,
        SUM(ili.taxable_amount)  AS taxable_amount,
        SUM(ili.tax_amount)      AS tax_amount,
        CASE
          WHEN SUM(ili.taxable_amount) > 0
          THEN ROUND((SUM(ili.tax_amount) / SUM(ili.taxable_amount)) * 100)::int
          ELSE 0
        END                      AS blended_tax_rate
      FROM invoices i
      JOIN invoice_line_items ili ON ili.invoice_id = i.invoice_id
      WHERE i.store_id     = ${storeId}::uuid
        AND i.status       IN ('PAID', 'CONFIRMED', 'PARTIAL')
        AND i.invoice_date >= ${fromDate}::date
        AND i.invoice_date <= ${toDate}::date
        AND i.grand_total  > 250000
      GROUP BY i.invoice_id, i.invoice_number,
               i.invoice_date, i.grand_total
      ORDER BY i.invoice_date DESC
    `),
    prisma.$queryRaw<GstrB2CSmallRow[]>(Prisma.sql`
      SELECT
        line_tax_rate::int          AS tax_rate,
        SUM(taxable_amount)         AS taxable_amount,
        SUM(tax_amount)             AS tax_amount
      FROM (
        SELECT
          ili.taxable_amount,
          ili.tax_amount,
          CASE
            WHEN ili.taxable_amount > 0
            THEN ROUND((ili.tax_amount / ili.taxable_amount) * 100)
            ELSE 0
          END AS line_tax_rate
        FROM invoice_line_items ili
        JOIN invoices i ON i.invoice_id = ili.invoice_id
        WHERE i.store_id     = ${storeId}::uuid
          AND i.status       IN ('PAID', 'CONFIRMED', 'PARTIAL')
          AND i.invoice_date >= ${fromDate}::date
          AND i.invoice_date <= ${toDate}::date
          AND i.grand_total  <= 250000
      ) sub
      GROUP BY line_tax_rate
      ORDER BY line_tax_rate
    `),
    prisma.$queryRaw<GstrHsnRow[]>(Prisma.sql`
      SELECT
        COALESCE(ili.hsn_code, 'NA') AS hsn_code,
        h.description                AS hsn_description,
        p.unit_of_measure::text,
        SUM(ili.quantity)            AS total_quantity,
        SUM(ili.taxable_amount)      AS taxable_amount,
        SUM(ili.tax_amount)          AS tax_amount
      FROM invoice_line_items ili
      JOIN invoices i        ON i.invoice_id  = ili.invoice_id
      JOIN product_variants pv ON pv.variant_id = ili.variant_id
      JOIN products p        ON p.product_id  = pv.product_id
      LEFT JOIN hsn_codes h  ON h.hsn_code    = ili.hsn_code
      WHERE i.store_id     = ${storeId}::uuid
        AND i.status       IN ('PAID', 'CONFIRMED', 'PARTIAL')
        AND i.invoice_date >= ${fromDate}::date
        AND i.invoice_date <= ${toDate}::date
      GROUP BY ili.hsn_code, h.description, p.unit_of_measure::text
      ORDER BY taxable_amount DESC
    `),
  ]);

  const addGstSplit = <T extends { tax_amount: unknown }>(row: T) => {
    const tax = Number(row.tax_amount ?? 0);
    return { ...row, cgst: tax / 2, sgst: tax / 2, igst: 0 };
  };

  return {
    b2cLarge:   b2cLargeRaw.map(serializeRow).map(addGstSplit),
    b2cSmall:   b2cSmallRaw.map(serializeRow).map(addGstSplit),
    hsnSummary: hsnRaw.map(serializeRow).map(addGstSplit),
  };
}

// â”€â”€ Shared: fetch GSTR-3B data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function fetchGstr3bData(storeId: string, fromDate: Date, toDate: Date) {
  const rateRows = await prisma.$queryRaw<Gstr3bRateRow[]>(Prisma.sql`
    SELECT
      line_tax_rate::int  AS tax_rate,
      SUM(taxable_amount) AS taxable_amount,
      SUM(tax_amount)     AS tax_amount
    FROM (
      SELECT
        ili.taxable_amount,
        ili.tax_amount,
        CASE
          WHEN ili.taxable_amount > 0
          THEN ROUND((ili.tax_amount / ili.taxable_amount) * 100)
          ELSE 0
        END AS line_tax_rate
      FROM invoice_line_items ili
      JOIN invoices i ON i.invoice_id = ili.invoice_id
      WHERE i.store_id     = ${storeId}::uuid
        AND i.status       IN ('PAID', 'CONFIRMED', 'PARTIAL')
        AND i.invoice_date >= ${fromDate}::date
        AND i.invoice_date <= ${toDate}::date
    ) sub
    GROUP BY line_tax_rate
    ORDER BY line_tax_rate
  `);

  const rows      = rateRows.map(serializeRow);
  const totalTax  = rows.reduce((s, r) => s + Number(r.tax_amount ?? 0), 0);

  const table31 = rows
    .filter(r => Number(r.tax_rate ?? 0) > 0)
    .map(r => {
      const tax = Number(r.tax_amount ?? 0);
      return { taxRate: Number(r.tax_rate), taxableValue: Number(r.taxable_amount ?? 0),
               cgst: tax / 2, sgst: tax / 2, igst: 0, cess: 0 };
    });

  const nilExempt   = rows
    .filter(r => Number(r.tax_rate ?? 0) === 0)
    .reduce((s, r) => s + Number(r.taxable_amount ?? 0), 0);

  const grandTotals = {
    taxableValue: rows.reduce((s, r) => s + Number(r.taxable_amount ?? 0), 0),
    cgst: totalTax / 2, sgst: totalTax / 2, igst: 0, cess: 0,
  };

  return { table31, nilExempt, table32InterState: [], grandTotals };
}

// â”€â”€ GET /:storeId/reports/gstr1 â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export async function getGstr1(
  request: FastifyRequest<{ Params: { storeId: string }; Querystring: ReportBaseQuery }>,
  reply: FastifyReply,
) {
  if (denyIfNotManager(request, reply)) return;
  const parsed = ReportBaseQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    return reply.status(400).send({ success: false,
      error: { code: 'VALIDATION_ERROR',
        message: parsed.error.errors[0].message, statusCode: 400 } });
  }
  const { from, to } = parsed.data;
  const data = await fetchGstr1Data(request.storeId, new Date(from), new Date(to));
  return reply.send({ success: true, data: { period: { from, to }, ...data } });
}

// â”€â”€ GET /:storeId/reports/gstr3b â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export async function getGstr3b(
  request: FastifyRequest<{ Params: { storeId: string }; Querystring: ReportBaseQuery }>,
  reply: FastifyReply,
) {
  if (denyIfNotManager(request, reply)) return;
  const parsed = ReportBaseQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    return reply.status(400).send({ success: false,
      error: { code: 'VALIDATION_ERROR',
        message: parsed.error.errors[0].message, statusCode: 400 } });
  }
  const { from, to } = parsed.data;
  const data = await fetchGstr3bData(request.storeId, new Date(from), new Date(to));
  return reply.send({ success: true, data: { period: { from, to }, ...data } });
}

// â”€â”€ Excel helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function styleHeader(ws: ExcelJS.Worksheet) {
  const headerRow     = ws.getRow(1);
  headerRow.font      = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A56DB' } };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.height    = 20;
}

async function buildGstr1Excel(
  data: Awaited<ReturnType<typeof fetchGstr1Data>>,
): Promise<Buffer> {
  const wb  = new ExcelJS.Workbook();

  const ws1 = wb.addWorksheet('B2C Large');
  ws1.columns = [
    { header: 'Invoice No',    key: 'invoice_number',   width: 22 },
    { header: 'Date',          key: 'invoice_date',     width: 14 },
    { header: 'Invoice Value', key: 'grand_total',      width: 18 },
    { header: 'Taxable Value', key: 'taxable_amount',   width: 18 },
    { header: 'GST Rate %',    key: 'blended_tax_rate', width: 12 },
    { header: 'CGST',          key: 'cgst',             width: 15 },
    { header: 'SGST',          key: 'sgst',             width: 15 },
    { header: 'IGST',          key: 'igst',             width: 15 },
  ];
  styleHeader(ws1);
  for (const r of data.b2cLarge) {
    ws1.addRow({
      ...r,
      invoice_date:     r.invoice_date
        ? new Date(r.invoice_date as string).toLocaleDateString('en-IN') : '',
      grand_total:      Number(r.grand_total ?? 0),
      taxable_amount:   Number(r.taxable_amount ?? 0),
      blended_tax_rate: Number((r as any).blended_tax_rate ?? 0),
    });
  }

  const ws2 = wb.addWorksheet('B2C Small');
  ws2.columns = [
    { header: 'GST Rate %',    key: 'tax_rate',       width: 12 },
    { header: 'Taxable Value', key: 'taxable_amount', width: 18 },
    { header: 'CGST',          key: 'cgst',           width: 15 },
    { header: 'SGST',          key: 'sgst',           width: 15 },
    { header: 'IGST',          key: 'igst',           width: 15 },
  ];
  styleHeader(ws2);
  for (const r of data.b2cSmall) {
    ws2.addRow({ tax_rate: Number((r as any).tax_rate ?? 0),
      taxable_amount: Number(r.taxable_amount ?? 0),
      cgst: r.cgst, sgst: r.sgst, igst: 0 });
  }

  const ws3 = wb.addWorksheet('HSN Summary');
  ws3.columns = [
    { header: 'HSN Code',      key: 'hsn_code',       width: 14 },
    { header: 'Description',   key: 'hsn_description', width: 32 },
    { header: 'UOM',           key: 'unit_of_measure', width: 10 },
    { header: 'Total Qty',     key: 'total_quantity',  width: 12 },
    { header: 'Taxable Value', key: 'taxable_amount',  width: 18 },
    { header: 'CGST',          key: 'cgst',            width: 15 },
    { header: 'SGST',          key: 'sgst',            width: 15 },
    { header: 'IGST',          key: 'igst',            width: 15 },
  ];
  styleHeader(ws3);
  for (const r of data.hsnSummary) {
    ws3.addRow({ ...r,
      total_quantity: Number((r as any).total_quantity ?? 0),
      taxable_amount: Number(r.taxable_amount ?? 0) });
  }

  return wb.xlsx.writeBuffer() as unknown as Promise<Buffer>;
}

async function buildGstr3bExcel(
  data: Awaited<ReturnType<typeof fetchGstr3bData>>,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('GSTR-3B Table 3.1');
  ws.columns = [
    { header: 'GST Rate %',    key: 'taxRate',      width: 12 },
    { header: 'Taxable Value', key: 'taxableValue', width: 18 },
    { header: 'CGST',          key: 'cgst',         width: 15 },
    { header: 'SGST',          key: 'sgst',         width: 15 },
    { header: 'IGST',          key: 'igst',         width: 15 },
    { header: 'Cess',          key: 'cess',         width: 12 },
  ];
  styleHeader(ws);
  for (const r of data.table31) ws.addRow(r);
  ws.addRow({ taxRate: 0, taxableValue: data.nilExempt, cgst: 0, sgst: 0, igst: 0, cess: 0 });
  const tot = ws.addRow({ taxRate: 'TOTAL', ...data.grandTotals });
  tot.font = { bold: true };
  return wb.xlsx.writeBuffer() as unknown as Promise<Buffer>;
}

async function buildSalesExcel(
  storeId: string, fromDate: Date, toDate: Date,
): Promise<Buffer> {
  const rawRows = await prisma.$queryRaw<DailySalesRow[]>(Prisma.sql`
    SELECT invoice_date, invoice_count, total_revenue_base,
           total_tax, total_discount, unique_customers
    FROM v_daily_sales
    WHERE store_id     = ${storeId}::uuid
      AND invoice_date >= ${fromDate}::date
      AND invoice_date <= ${toDate}::date
    ORDER BY invoice_date DESC
  `);
  const rows = rawRows.map(serializeRow);
  const wb   = new ExcelJS.Workbook();
  const ws   = wb.addWorksheet('Sales Summary');
  ws.columns = [
    { header: 'Date',         key: 'invoice_date',       width: 14 },
    { header: 'Invoices',     key: 'invoice_count',      width: 12 },
    { header: 'Revenue',      key: 'total_revenue_base', width: 18 },
    { header: 'Tax',          key: 'total_tax',          width: 15 },
    { header: 'Discounts',    key: 'total_discount',     width: 15 },
    { header: 'Unique Cust.', key: 'unique_customers',   width: 14 },
  ];
  styleHeader(ws);
  for (const r of rows) {
    ws.addRow({ ...r,
      invoice_date: r.invoice_date
        ? new Date(r.invoice_date as string).toLocaleDateString('en-IN') : '',
      invoice_count:      Number(r.invoice_count      ?? 0),
      total_revenue_base: Number(r.total_revenue_base ?? 0),
      total_tax:          Number(r.total_tax          ?? 0),
      total_discount:     Number(r.total_discount     ?? 0),
      unique_customers:   Number(r.unique_customers   ?? 0),
    });
  }
  const tot = ws.addRow({
    invoice_date:       'TOTAL',
    invoice_count:      rows.reduce((s, r) => s + Number(r.invoice_count      ?? 0), 0),
    total_revenue_base: rows.reduce((s, r) => s + Number(r.total_revenue_base ?? 0), 0),
    total_tax:          rows.reduce((s, r) => s + Number(r.total_tax          ?? 0), 0),
    total_discount:     rows.reduce((s, r) => s + Number(r.total_discount     ?? 0), 0),
    unique_customers:   '',
  });
  tot.font = { bold: true };
  return wb.xlsx.writeBuffer() as unknown as Promise<Buffer>;
}

// â”€â”€ GET /:storeId/reports/export â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export async function exportReport(
  request: FastifyRequest<{ Params: { storeId: string }; Querystring: ExportQuery }>,
  reply: FastifyReply,
) {
  if (denyIfNotManager(request, reply)) return;
  const parsed = ExportQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    return reply.status(400).send({ success: false,
      error: { code: 'VALIDATION_ERROR',
        message: parsed.error.errors[0].message, statusCode: 400 } });
  }
  const { type, format, from, to } = parsed.data;
  const storeId  = request.storeId;
  const fromDate = new Date(from);
  const toDate   = new Date(to);
  const label    = `${type.toUpperCase()}_${from}_${to}`;

  if (format === 'json') {
    let data: unknown;
    if      (type === 'gstr1')  data = await fetchGstr1Data(storeId, fromDate, toDate);
    else if (type === 'gstr3b') data = await fetchGstr3bData(storeId, fromDate, toDate);
    else {
      const rawRows = await prisma.$queryRaw<DailySalesRow[]>(Prisma.sql`
        SELECT invoice_date, invoice_count, total_revenue_base,
               total_tax, total_discount, unique_customers
        FROM v_daily_sales
        WHERE store_id     = ${storeId}::uuid
          AND invoice_date >= ${fromDate}::date
          AND invoice_date <= ${toDate}::date
        ORDER BY invoice_date DESC
      `);
      data = rawRows.map(serializeRow);
    }
    reply.header('Content-Disposition', `attachment; filename="${label}.json"`);
    reply.header('Content-Type', 'application/json');
    return reply.send(JSON.stringify({ period: { from, to }, data }, null, 2));
  }

  // Excel
  let buffer: Buffer;
  if      (type === 'gstr1')  buffer = await buildGstr1Excel(await fetchGstr1Data(storeId, fromDate, toDate));
  else if (type === 'gstr3b') buffer = await buildGstr3bExcel(await fetchGstr3bData(storeId, fromDate, toDate));
  else                        buffer = await buildSalesExcel(storeId, fromDate, toDate);

  reply.header('Content-Disposition',
    `attachment; filename="${label}.xlsx"`);
  reply.header('Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  return reply.send(buffer);
}

// â”€â”€ Tally row type â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
interface TallyLineRow {
  invoice_number: unknown;
  invoice_date:   unknown;
  party_name:     unknown;
  item_name:      unknown;
  hsn_code:       unknown;
  quantity:       unknown;
  unit:           unknown;
  rate:           unknown;
  taxable_amount: unknown;
  tax_rate:       unknown;
  tax_amount:     unknown;
  grand_total:    unknown;
  payment_mode:   unknown;
}

// â”€â”€ Shared: fetch Tally line-item data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function fetchTallyData(storeId: string, fromDate: Date, toDate: Date) {
  const rows = await prisma.$queryRaw<TallyLineRow[]>(Prisma.sql`
    SELECT
      i.invoice_number,
      i.invoice_date,
      COALESCE(c.name, 'Walk-in Customer')   AS party_name,
      p.name                                  AS item_name,
      COALESCE(ili.hsn_code, '')              AS hsn_code,
      ili.quantity,
      COALESCE(p.unit_of_measure::text, 'NOS') AS unit,
      ili.unit_price                          AS rate,
      ili.taxable_amount,
      CASE
        WHEN ili.taxable_amount > 0
        THEN ROUND((ili.tax_amount / ili.taxable_amount) * 100)::int
        ELSE 0
      END                                     AS tax_rate,
      ili.tax_amount,
      i.grand_total,
      COALESCE(i.payment_mode::text, 'Cash')  AS payment_mode
    FROM invoices i
    JOIN invoice_line_items ili ON ili.invoice_id = i.invoice_id
    JOIN product_variants pv   ON pv.variant_id  = ili.variant_id
    JOIN products p             ON p.product_id  = pv.product_id
    LEFT JOIN customers c       ON c.customer_id = i.customer_id
    WHERE i.store_id     = ${storeId}::uuid
      AND i.status       IN ('PAID', 'CONFIRMED', 'PARTIAL')
      AND i.invoice_date >= ${fromDate}::date
      AND i.invoice_date <= ${toDate}::date
    ORDER BY i.invoice_date, i.invoice_number, ili.line_item_id
  `);
  return rows.map(serializeRow);
}

// â”€â”€ Tally XML builder â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function buildTallyXml(
  rows: ReturnType<typeof serializeRow>[],
  tallyVersion: 'erp9' | 'prime',
): string {
  const isPrime = tallyVersion === 'prime';
  const MONTHS  = ['Jan','Feb','Mar','Apr','May','Jun',
                   'Jul','Aug','Sep','Oct','Nov','Dec'];

  function fmtDate(raw: unknown): string {
    const d = raw ? new Date(raw as string) : new Date();
    if (isPrime) {
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(d.getUTCDate()).padStart(2, '0');
      return `${y}${m}${dd}`;
    }
    const dd  = String(d.getUTCDate()).padStart(2, '0');
    const mon = MONTHS[d.getUTCMonth()];
    const y   = d.getUTCFullYear();
    return `${dd}-${mon}-${y}`;
  }

  function esc(s: unknown): string {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // Group rows by invoice_number
  const invoiceMap = new Map<string, typeof rows>();
  for (const r of rows) {
    const key = String(r.invoice_number ?? '');
    if (!invoiceMap.has(key)) invoiceMap.set(key, []);
    invoiceMap.get(key)!.push(r);
  }

  const msgAttr = isPrime ? ' xmlns:UDF="TallyUDF"' : '';
  const vouchers: string[] = [];

  for (const [voucherNo, lines] of invoiceMap) {
    const first      = lines[0];
    const dateStr    = fmtDate(first.invoice_date);
    const party      = esc(first.party_name);
    const grandTotal = Number(first.grand_total ?? 0).toFixed(2);

    let totalTax    = 0;
    let totalTaxable = 0;
    const inventoryEntries: string[] = [];

    for (const l of lines) {
      const taxable  = Number(l.taxable_amount ?? 0);
      const tax      = Number(l.tax_amount ?? 0);
      const qty      = Number(l.quantity ?? 0);
      const rate     = Number(l.rate ?? 0);
      totalTax      += tax;
      totalTaxable  += taxable;

      inventoryEntries.push(`
          <ALLINVENTORYENTRIES.LIST>
            <STOCKITEMNAME>${esc(l.item_name)}</STOCKITEMNAME>
            <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
            <RATE>${rate.toFixed(2)}</RATE>
            <AMOUNT>${taxable.toFixed(2)}</AMOUNT>
            <ACTUALQTY> ${qty} ${esc(l.unit)}</ACTUALQTY>
            <BILLEDQTY> ${qty} ${esc(l.unit)}</BILLEDQTY>
            <ACCOUNTINGALLOCATIONS.LIST>
              <LEDGERNAME>Sales</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>${taxable.toFixed(2)}</AMOUNT>
            </ACCOUNTINGALLOCATIONS.LIST>
          </ALLINVENTORYENTRIES.LIST>`);
    }

    const cgst = (totalTax / 2).toFixed(2);
    const sgst = (totalTax / 2).toFixed(2);

    vouchers.push(`
        <VOUCHER REMOTEID="${esc(voucherNo)}" VCHTYPE="Sales" ACTION="Create">
          <DATE>${dateStr}</DATE>
          <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
          <VOUCHERNUMBER>${esc(voucherNo)}</VOUCHERNUMBER>
          <PARTYLEDGERNAME>${party}</PARTYLEDGERNAME>
          <EFFECTIVEDATE>${dateStr}</EFFECTIVEDATE>
          <ALLLEDGERENTRIES.LIST>
            <LEDGERNAME>${party}</LEDGERNAME>
            <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
            <AMOUNT>-${grandTotal}</AMOUNT>
          </ALLLEDGERENTRIES.LIST>
          ${inventoryEntries.join('')}
          <ALLLEDGERENTRIES.LIST>
            <LEDGERNAME>Output CGST</LEDGERNAME>
            <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
            <AMOUNT>${cgst}</AMOUNT>
          </ALLLEDGERENTRIES.LIST>
          <ALLLEDGERENTRIES.LIST>
            <LEDGERNAME>Output SGST</LEDGERNAME>
            <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
            <AMOUNT>${sgst}</AMOUNT>
          </ALLLEDGERENTRIES.LIST>
        </VOUCHER>`);
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>##SVCURRENTCOMPANY</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE${msgAttr}>${vouchers.join('')}
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;
}

// â”€â”€ Tally CSV builder â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function buildTallyCsv(rows: ReturnType<typeof serializeRow>[]): string {
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun',
                  'Jul','Aug','Sep','Oct','Nov','Dec'];
  function fmtDate(raw: unknown): string {
    const d = raw ? new Date(raw as string) : new Date();
    const dd  = String(d.getUTCDate()).padStart(2, '0');
    const mon = MONTHS[d.getUTCMonth()];
    return `${dd}-${mon}-${d.getUTCFullYear()}`;
  }
  function q(v: unknown): string {
    const s = String(v ?? '');
    return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
  }

  const header = 'Date,VoucherNo,PartyName,ItemName,HSNCode,Qty,Unit,Rate,' +
                 'TaxableAmt,GSTRate,CGSTAmt,SGSTAmt,IGSTAmt,TotalAmt,PaymentMode';
  const lines = rows.map(r => {
    const tax     = Number(r.tax_amount ?? 0);
    const taxRate = Number(r.tax_rate ?? 0);
    return [
      q(fmtDate(r.invoice_date)),
      q(r.invoice_number),
      q(r.party_name),
      q(r.item_name),
      q(r.hsn_code),
      q(r.quantity),
      q(r.unit),
      q(Number(r.rate ?? 0).toFixed(2)),
      q(Number(r.taxable_amount ?? 0).toFixed(2)),
      q(taxRate),
      q((tax / 2).toFixed(2)),
      q((tax / 2).toFixed(2)),
      q('0.00'),
      q(Number(r.grand_total ?? 0).toFixed(2)),
      q(r.payment_mode),
    ].join(',');
  });
  return [header, ...lines].join('\r\n');
}

// â”€â”€ GET /:storeId/reports/tally-export â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export async function getTallyExport(
  request: FastifyRequest<{ Params: { storeId: string }; Querystring: TallyExportQuery }>,
  reply: FastifyReply,
) {
  if (denyIfNotManager(request, reply)) return;
  const parsed = TallyExportQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    return reply.status(400).send({ success: false,
      error: { code: 'VALIDATION_ERROR',
        message: parsed.error.errors[0].message, statusCode: 400 } });
  }
  const { format, tallyVersion, from, to } = parsed.data;
  const storeId  = request.storeId;
  const fromDate = new Date(from);
  const toDate   = new Date(to);
  const label    = `Tally_${from}_${to}`;
  console.log('[TallyExport] fetchTallyData start', { storeId, from, to });
  let rows: Awaited<ReturnType<typeof fetchTallyData>>;
  try {
    rows = await fetchTallyData(storeId, fromDate, toDate);
    console.log('[TallyExport] fetchTallyData complete', { rowCount: rows.length });
  } catch (err) {
    console.error('[TallyExport] fetchTallyData error:', (err as Error).stack ?? err);
    return reply.status(500).send({
      success: false,
      error: { code: 'TALLY_FETCH_ERROR', message: (err as Error).message, statusCode: 500 },
    });
  }

  if (format === 'csv') {
    const csv = buildTallyCsv(rows);
    reply.header('Content-Disposition', `attachment; filename="${label}.csv"`);
    reply.header('Content-Type', 'text/csv; charset=utf-8');
    return reply.send(csv);
  }

  const xml = buildTallyXml(rows, tallyVersion);
  reply.header('Content-Disposition', `attachment; filename="${label}.xml"`);
  reply.header('Content-Type', 'application/xml; charset=utf-8');
  return reply.send(xml);
}

