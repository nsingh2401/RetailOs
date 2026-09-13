import { FastifyRequest, FastifyReply } from 'fastify';
import { Prisma } from '@prisma/client';
import { prisma } from '../../../lib/prisma';

// ── GET /v1/admin/analytics/overview ─────────────────────────────
export async function getOverview(
  _request: FastifyRequest,
  reply: FastifyReply,
) {
  const now     = new Date();
  const last30  = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    totalOrgs,
    activeOrgs,
    newOrgsLast30,
    totalStores,
    activeStores,
    newStoresLast30,
    totalUsers,
    totalInvoices,
    revenueAgg,
    activeOrgIds,
  ] = await Promise.all([
    prisma.organization.count(),
    prisma.organization.count({ where: { isActive: true } }),
    prisma.organization.count({ where: { createdAt: { gte: last30 } } }),
    prisma.store.count(),
    prisma.store.count({ where: { isActive: true } }),
    prisma.store.count({ where: { createdAt: { gte: last30 } } }),
    prisma.user.count(),
    prisma.invoice.count({
      where: { status: { in: ['CONFIRMED', 'PAID', 'PARTIAL'] } },
    }),
    prisma.invoice.aggregate({
      where: { status: { in: ['CONFIRMED', 'PAID', 'PARTIAL'] } },
      _sum:  { grandTotalBase: true },
    }),
    // orgs that had at least one invoice in last 30 days
    prisma.invoice.findMany({
      where:   { createdAt: { gte: last30 } },
      select:  { store: { select: { orgId: true } } },
      distinct: ['storeId'],
    }),
  ]);

  const uniqueActiveOrgIds = new Set(activeOrgIds.map((i) => i.store.orgId));

  return reply.send({
    success: true,
    data: {
      totalOrgs,
      activeOrgs,
      inactiveOrgs:        totalOrgs - activeOrgs,
      newOrgsLast30,
      totalStores,
      activeStores,
      inactiveStores:      totalStores - activeStores,
      newStoresLast30,
      totalUsers,
      totalInvoices,
      totalRevenue:        Number(revenueAgg._sum.grandTotalBase ?? 0),
      activeOrgsLast30Days: uniqueActiveOrgIds.size,
    },
  });
}

// ── GET /v1/admin/analytics/revenue?period=7d|30d|90d|365d ───────
export async function getRevenueSeries(
  request: FastifyRequest<{ Querystring: { period?: string } }>,
  reply: FastifyReply,
) {
  const periodMap: Record<string, number> = {
    '7d':   7,
    '30d':  30,
    '90d':  90,
    '365d': 365,
  };
  const days = periodMap[request.query.period ?? '30d'] ?? 30;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const rows = await prisma.$queryRaw<
    { date: Date; revenue: string; invoice_count: string }[]
  >(Prisma.sql`
    SELECT
      DATE_TRUNC('day', invoice_date)::date   AS date,
      COALESCE(SUM(grand_total_base), 0)      AS revenue,
      COUNT(*)                                AS invoice_count
    FROM invoices
    WHERE
      invoice_date >= ${since}::date
      AND status IN ('CONFIRMED', 'PAID', 'PARTIAL')
    GROUP BY DATE_TRUNC('day', invoice_date)
    ORDER BY date ASC
  `);

  return reply.send({
    success: true,
    data: rows.map((r) => ({
      date:         r.date instanceof Date
                      ? r.date.toISOString().slice(0, 10)
                      : String(r.date),
      revenue:      Number(r.revenue),
      invoiceCount: Number(r.invoice_count),
    })),
  });
}

// ── GET /v1/admin/analytics/industry-breakdown ────────────────────
export async function getIndustryBreakdown(
  _request: FastifyRequest,
  reply: FastifyReply,
) {
  const rows = await prisma.$queryRaw<
    {
      industry_type: string;
      display_name:  string | null;
      store_count:   string;
      invoice_count: string;
      revenue:       string;
    }[]
  >(Prisma.sql`
    SELECT
      s.industry_type,
      mic.display_name,
      COUNT(DISTINCT s.store_id)                            AS store_count,
      COUNT(i.invoice_id)                                   AS invoice_count,
      COALESCE(SUM(i.grand_total_base), 0)                  AS revenue
    FROM stores s
    LEFT JOIN invoices i
      ON i.store_id = s.store_id
      AND i.status IN ('CONFIRMED', 'PAID', 'PARTIAL')
    LEFT JOIN master_industry_config mic
      ON mic.industry_type = s.industry_type::text
    GROUP BY s.industry_type, mic.display_name
    ORDER BY store_count DESC
  `);

  return reply.send({
    success: true,
    data: rows.map((r) => ({
      industryType: r.industry_type,
      displayName:  r.display_name ?? r.industry_type,
      storeCount:   Number(r.store_count),
      invoiceCount: Number(r.invoice_count),
      revenue:      Number(r.revenue),
    })),
  });
}

// ── GET /v1/admin/analytics/top-orgs?limit=10 ────────────────────
export async function getTopOrgs(
  request: FastifyRequest<{ Querystring: { limit?: string } }>,
  reply: FastifyReply,
) {
  const limit = Math.min(50, Math.max(1, parseInt(request.query.limit ?? '10', 10)));

  const rows = await prisma.$queryRaw<
    {
      org_id:        string;
      org_name:      string;
      plan_id:       string;
      store_count:   string;
      total_revenue: string;
      invoice_count: string;
    }[]
  >(Prisma.sql`
    SELECT
      o.org_id,
      o.name                                              AS org_name,
      o.plan_id,
      COUNT(DISTINCT s.store_id)                          AS store_count,
      COALESCE(SUM(i.grand_total_base), 0)                AS total_revenue,
      COUNT(i.invoice_id)                                 AS invoice_count
    FROM organizations o
    LEFT JOIN stores s       ON s.org_id = o.org_id
    LEFT JOIN invoices i
      ON i.store_id = s.store_id
      AND i.status IN ('CONFIRMED', 'PAID', 'PARTIAL')
    GROUP BY o.org_id, o.name, o.plan_id
    ORDER BY total_revenue DESC
    LIMIT ${limit}
  `);

  return reply.send({
    success: true,
    data: rows.map((r) => ({
      orgId:        r.org_id,
      orgName:      r.org_name,
      planId:       r.plan_id,
      storeCount:   Number(r.store_count),
      totalRevenue: Number(r.total_revenue),
      invoiceCount: Number(r.invoice_count),
    })),
  });
}
