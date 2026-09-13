import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../../lib/prisma';
import {
  CreateTaxRuleSchema,
  UpdateTaxRuleSchema,
  HsnSearchQuerySchema,
  CreateStoreTaxRuleSchema,
} from './schema';
import type {
  CreateTaxRuleInput,
  UpdateTaxRuleInput,
  HsnSearchQuery,
  CreateStoreTaxRuleInput,
} from './schema';

// ── GET /v1/org/tax-rules ─────────────────────────────────────
export async function listTaxRules(request: FastifyRequest, reply: FastifyReply) {
  const { orgId } = request.authUser;

  const rules = await prisma.taxRule.findMany({
    where:   { orgId, isActive: true },
    include: { taxComponents: true },
    orderBy: { name: 'asc' },
  });

  return reply.send({ success: true, data: rules });
}

// ── POST /v1/org/tax-rules ────────────────────────────────────
export async function createTaxRule(
  request: FastifyRequest<{ Body: CreateTaxRuleInput }>,
  reply: FastifyReply,
) {
  const { orgId } = request.authUser;

  if (request.authUser.userType !== 'OWNER') {
    return reply.status(403).send({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Only OWNER can create tax rules', statusCode: 403 },
    });
  }

  const parsed = CreateTaxRuleSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message, statusCode: 400 } });
  }
  const { name, taxRegime, countryCode, totalRate, isInclusive, components } = parsed.data;

  try {
    const rule = await prisma.taxRule.create({
      data: {
        orgId,
        name,
        taxRegime,
        countryCode,
        totalRate,
        isInclusive,
        taxComponents: {
          create: components,
        },
      },
      include: { taxComponents: true },
    });

    return reply.status(201).send({ success: true, data: rule });
  } catch (err: any) {
    if (err.code === 'P2002') {
      return reply.status(409).send({
        success: false,
        error: { code: 'CONFLICT', message: 'A tax rule with this name already exists', statusCode: 409 },
      });
    }
    throw err;
  }
}

// ── GET /v1/org/tax-rules/:taxRuleId ──────────────────────────
export async function getTaxRule(
  request: FastifyRequest<{ Params: { taxRuleId: string } }>,
  reply: FastifyReply,
) {
  const { orgId }     = request.authUser;
  const { taxRuleId } = request.params;

  const rule = await prisma.taxRule.findUnique({
    where:   { taxRuleId },
    include: { taxComponents: true },
  });

  if (!rule || rule.orgId !== orgId) {
    return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Tax rule not found', statusCode: 404 } });
  }

  return reply.send({ success: true, data: rule });
}

// ── PATCH /v1/org/tax-rules/:taxRuleId ────────────────────────
export async function updateTaxRule(
  request: FastifyRequest<{ Params: { taxRuleId: string }; Body: UpdateTaxRuleInput }>,
  reply: FastifyReply,
) {
  const { orgId }     = request.authUser;
  const { taxRuleId } = request.params;

  if (request.authUser.userType !== 'OWNER') {
    return reply.status(403).send({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Only OWNER can update tax rules', statusCode: 403 },
    });
  }

  const parsed = UpdateTaxRuleSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message, statusCode: 400 } });
  }

  const existing = await prisma.taxRule.findUnique({ where: { taxRuleId } });
  if (!existing || existing.orgId !== orgId) {
    return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Tax rule not found', statusCode: 404 } });
  }

  const rule = await prisma.taxRule.update({
    where:   { taxRuleId },
    data:    parsed.data,
    include: { taxComponents: true },
  });

  return reply.send({ success: true, data: rule });
}

// ── GET /v1/stores/:storeId/tax-rules ────────────────────────
export async function listStoreTaxRules(request: FastifyRequest, reply: FastifyReply) {
  const { orgId } = request.authUser;

  const rules = await prisma.taxRule.findMany({
    where:   { orgId, isActive: true },
    include: { taxComponents: true },
    orderBy: { name: 'asc' },
  });

  return reply.send({ success: true, data: rules });
}

// ── POST /v1/stores/:storeId/tax-rules ───────────────────────
export async function createStoreTaxRule(
  request: FastifyRequest<{ Body: CreateStoreTaxRuleInput }>,
  reply: FastifyReply,
) {
  const { orgId } = request.authUser;

  const parsed = CreateStoreTaxRuleSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message, statusCode: 400 } });
  }
  const { name, totalRate, isInclusive } = parsed.data;
  const half = Number(totalRate) / 2;
  const components = Number(totalRate) === 0 ? [] : [
    { componentName: 'CGST', rate: half, ledgerAccount: 'CGST Payable' },
    { componentName: 'SGST', rate: half, ledgerAccount: 'SGST Payable' },
  ];

  // Reactivate soft-deleted rule with same name if found
  const existing = await prisma.taxRule.findFirst({
    where: { orgId, name, isActive: false },
  });
  if (existing) {
    const rule = await prisma.taxRule.update({
      where:   { taxRuleId: existing.taxRuleId },
      data:    { isActive: true, totalRate, isInclusive },
      include: { taxComponents: true },
    });
    return reply.status(200).send({ success: true, data: rule });
  }

  try {
    const rule = await prisma.taxRule.create({
      data: {
        orgId,
        name,
        taxRegime:   'GST',
        countryCode: 'IN',
        totalRate,
        isInclusive,
        taxComponents: { create: components },
      },
      include: { taxComponents: true },
    });
    return reply.status(201).send({ success: true, data: rule });
  } catch (err: any) {
    if (err.code === 'P2002') {
      return reply.status(409).send({ success: false, error: { code: 'CONFLICT', message: 'Tax rule name already exists', statusCode: 409 } });
    }
    throw err;
  }
}

// ── PATCH /v1/stores/:storeId/tax-rules/:taxRuleId ───────────
export async function updateStoreTaxRule(
  request: FastifyRequest<{ Params: { taxRuleId: string }; Body: UpdateTaxRuleInput }>,
  reply: FastifyReply,
) {
  const { orgId }     = request.authUser;
  const { taxRuleId } = request.params;

  const parsed = UpdateTaxRuleSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message, statusCode: 400 } });
  }

  const existing = await prisma.taxRule.findUnique({ where: { taxRuleId } });
  if (!existing || existing.orgId !== orgId) {
    return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Tax rule not found', statusCode: 404 } });
  }

  const rule = await prisma.taxRule.update({
    where:   { taxRuleId },
    data:    parsed.data,
    include: { taxComponents: true },
  });

  return reply.send({ success: true, data: rule });
}

// ── DELETE /v1/stores/:storeId/tax-rules/:taxRuleId ──────────
export async function deleteStoreTaxRule(
  request: FastifyRequest<{ Params: { taxRuleId: string } }>,
  reply: FastifyReply,
) {
  const { orgId }     = request.authUser;
  const { taxRuleId } = request.params;

  const existing = await prisma.taxRule.findUnique({ where: { taxRuleId } });
  if (!existing || existing.orgId !== orgId) {
    return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Tax rule not found', statusCode: 404 } });
  }

  await prisma.taxRule.update({ where: { taxRuleId }, data: { isActive: false } });

  return reply.send({ success: true, data: { deleted: true } });
}

// ── GET /v1/hsn/search?q=... ──────────────────────────────────
export async function searchHsn(
  request: FastifyRequest<{ Querystring: HsnSearchQuery }>,
  reply: FastifyReply,
) {
  const parsed = HsnSearchQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message, statusCode: 400 } });
  }
  const { q, limit } = parsed.data;

  const rows = await prisma.hsnCode.findMany({
    where: {
      OR: [
        { hsnCode:    { startsWith: q } },
        { description: { contains: q, mode: 'insensitive' } },
      ],
    },
    take: limit,
  });

  return reply.send({ success: true, data: rows });
}

// ── GET /v1/hsn/:code ─────────────────────────────────────────
export async function getHsnCode(
  request: FastifyRequest<{ Params: { code: string } }>,
  reply: FastifyReply,
) {
  const { code } = request.params;

  const hsn = await prisma.hsnCode.findUnique({ where: { hsnCode: code } });
  if (!hsn) {
    return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'HSN code not found', statusCode: 404 } });
  }

  return reply.send({ success: true, data: hsn });
}

// ── GET /v1/currencies ────────────────────────────────────────
export async function listCurrencies(request: FastifyRequest, reply: FastifyReply) {
  const currencies = await prisma.currency.findMany({
    where:   { isActive: true },
    orderBy: { currencyCode: 'asc' },
  });

  return reply.send({ success: true, data: currencies });
}
