"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listTaxRules = listTaxRules;
exports.createTaxRule = createTaxRule;
exports.getTaxRule = getTaxRule;
exports.updateTaxRule = updateTaxRule;
exports.listStoreTaxRules = listStoreTaxRules;
exports.createStoreTaxRule = createStoreTaxRule;
exports.updateStoreTaxRule = updateStoreTaxRule;
exports.deleteStoreTaxRule = deleteStoreTaxRule;
exports.searchHsn = searchHsn;
exports.getHsnCode = getHsnCode;
exports.listCurrencies = listCurrencies;
const prisma_1 = require("../../lib/prisma");
const schema_1 = require("./schema");
// ── GET /v1/org/tax-rules ─────────────────────────────────────
async function listTaxRules(request, reply) {
    const { orgId } = request.authUser;
    const rules = await prisma_1.prisma.taxRule.findMany({
        where: { orgId, isActive: true },
        include: { taxComponents: true },
        orderBy: { name: 'asc' },
    });
    return reply.send({ success: true, data: rules });
}
// ── POST /v1/org/tax-rules ────────────────────────────────────
async function createTaxRule(request, reply) {
    const { orgId } = request.authUser;
    if (request.authUser.userType !== 'OWNER') {
        return reply.status(403).send({
            success: false,
            error: { code: 'FORBIDDEN', message: 'Only OWNER can create tax rules', statusCode: 403 },
        });
    }
    const parsed = schema_1.CreateTaxRuleSchema.safeParse(request.body);
    if (!parsed.success) {
        return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message, statusCode: 400 } });
    }
    const { name, taxRegime, countryCode, totalRate, isInclusive, components } = parsed.data;
    try {
        const rule = await prisma_1.prisma.taxRule.create({
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
    }
    catch (err) {
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
async function getTaxRule(request, reply) {
    const { orgId } = request.authUser;
    const { taxRuleId } = request.params;
    const rule = await prisma_1.prisma.taxRule.findUnique({
        where: { taxRuleId },
        include: { taxComponents: true },
    });
    if (!rule || rule.orgId !== orgId) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Tax rule not found', statusCode: 404 } });
    }
    return reply.send({ success: true, data: rule });
}
// ── PATCH /v1/org/tax-rules/:taxRuleId ────────────────────────
async function updateTaxRule(request, reply) {
    const { orgId } = request.authUser;
    const { taxRuleId } = request.params;
    if (request.authUser.userType !== 'OWNER') {
        return reply.status(403).send({
            success: false,
            error: { code: 'FORBIDDEN', message: 'Only OWNER can update tax rules', statusCode: 403 },
        });
    }
    const parsed = schema_1.UpdateTaxRuleSchema.safeParse(request.body);
    if (!parsed.success) {
        return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message, statusCode: 400 } });
    }
    const existing = await prisma_1.prisma.taxRule.findUnique({ where: { taxRuleId } });
    if (!existing || existing.orgId !== orgId) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Tax rule not found', statusCode: 404 } });
    }
    const rule = await prisma_1.prisma.taxRule.update({
        where: { taxRuleId },
        data: parsed.data,
        include: { taxComponents: true },
    });
    return reply.send({ success: true, data: rule });
}
// ── GET /v1/stores/:storeId/tax-rules ────────────────────────
async function listStoreTaxRules(request, reply) {
    const { orgId } = request.authUser;
    const rules = await prisma_1.prisma.taxRule.findMany({
        where: { orgId, isActive: true },
        include: { taxComponents: true },
        orderBy: { name: 'asc' },
    });
    return reply.send({ success: true, data: rules });
}
// ── POST /v1/stores/:storeId/tax-rules ───────────────────────
async function createStoreTaxRule(request, reply) {
    const { orgId } = request.authUser;
    const parsed = schema_1.CreateStoreTaxRuleSchema.safeParse(request.body);
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
    const existing = await prisma_1.prisma.taxRule.findFirst({
        where: { orgId, name, isActive: false },
    });
    if (existing) {
        const rule = await prisma_1.prisma.taxRule.update({
            where: { taxRuleId: existing.taxRuleId },
            data: { isActive: true, totalRate, isInclusive },
            include: { taxComponents: true },
        });
        return reply.status(200).send({ success: true, data: rule });
    }
    try {
        const rule = await prisma_1.prisma.taxRule.create({
            data: {
                orgId,
                name,
                taxRegime: 'GST',
                countryCode: 'IN',
                totalRate,
                isInclusive,
                taxComponents: { create: components },
            },
            include: { taxComponents: true },
        });
        return reply.status(201).send({ success: true, data: rule });
    }
    catch (err) {
        if (err.code === 'P2002') {
            return reply.status(409).send({ success: false, error: { code: 'CONFLICT', message: 'Tax rule name already exists', statusCode: 409 } });
        }
        throw err;
    }
}
// ── PATCH /v1/stores/:storeId/tax-rules/:taxRuleId ───────────
async function updateStoreTaxRule(request, reply) {
    const { orgId } = request.authUser;
    const { taxRuleId } = request.params;
    const parsed = schema_1.UpdateTaxRuleSchema.safeParse(request.body);
    if (!parsed.success) {
        return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message, statusCode: 400 } });
    }
    const existing = await prisma_1.prisma.taxRule.findUnique({ where: { taxRuleId } });
    if (!existing || existing.orgId !== orgId) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Tax rule not found', statusCode: 404 } });
    }
    const rule = await prisma_1.prisma.taxRule.update({
        where: { taxRuleId },
        data: parsed.data,
        include: { taxComponents: true },
    });
    return reply.send({ success: true, data: rule });
}
// ── DELETE /v1/stores/:storeId/tax-rules/:taxRuleId ──────────
async function deleteStoreTaxRule(request, reply) {
    const { orgId } = request.authUser;
    const { taxRuleId } = request.params;
    const existing = await prisma_1.prisma.taxRule.findUnique({ where: { taxRuleId } });
    if (!existing || existing.orgId !== orgId) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Tax rule not found', statusCode: 404 } });
    }
    await prisma_1.prisma.taxRule.update({ where: { taxRuleId }, data: { isActive: false } });
    return reply.send({ success: true, data: { deleted: true } });
}
// ── GET /v1/hsn/search?q=... ──────────────────────────────────
async function searchHsn(request, reply) {
    const parsed = schema_1.HsnSearchQuerySchema.safeParse(request.query);
    if (!parsed.success) {
        return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message, statusCode: 400 } });
    }
    const { q, limit } = parsed.data;
    const rows = await prisma_1.prisma.hsnCode.findMany({
        where: {
            OR: [
                { hsnCode: { startsWith: q } },
                { description: { contains: q, mode: 'insensitive' } },
            ],
        },
        take: limit,
    });
    return reply.send({ success: true, data: rows });
}
// ── GET /v1/hsn/:code ─────────────────────────────────────────
async function getHsnCode(request, reply) {
    const { code } = request.params;
    const hsn = await prisma_1.prisma.hsnCode.findUnique({ where: { hsnCode: code } });
    if (!hsn) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'HSN code not found', statusCode: 404 } });
    }
    return reply.send({ success: true, data: hsn });
}
// ── GET /v1/currencies ────────────────────────────────────────
async function listCurrencies(request, reply) {
    const currencies = await prisma_1.prisma.currency.findMany({
        where: { isActive: true },
        orderBy: { currencyCode: 'asc' },
    });
    return reply.send({ success: true, data: currencies });
}
//# sourceMappingURL=handler.js.map