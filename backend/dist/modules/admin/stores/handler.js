"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listStores = listStores;
exports.updateStore = updateStore;
exports.addStoreToOrg = addStoreToOrg;
const prisma_1 = require("../../../lib/prisma");
const categoryProvisioning_1 = require("../../../services/categoryProvisioning");
// ── GET /v1/admin/stores ──────────────────────────────────────────
async function listStores(request, reply) {
    const page = Math.max(1, parseInt(request.query.page ?? '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(request.query.limit ?? '20', 10)));
    const search = (request.query.search ?? '').trim();
    const isActive = request.query.isActive;
    const industryType = (request.query.industryType ?? '').trim();
    const orgId = (request.query.orgId ?? '').trim();
    const where = {};
    if (search) {
        where.OR = [
            { name: { contains: search, mode: 'insensitive' } },
            { storeCode: { contains: search, mode: 'insensitive' } },
        ];
    }
    if (isActive === 'true')
        where.isActive = true;
    if (isActive === 'false')
        where.isActive = false;
    if (industryType)
        where.industryType = industryType;
    if (orgId)
        where.orgId = orgId;
    const [stores, total] = await Promise.all([
        prisma_1.prisma.store.findMany({
            where,
            include: {
                _count: {
                    select: {
                        userStoreRoles: true,
                        products: true,
                    },
                },
                organization: {
                    select: { orgId: true, name: true, planId: true },
                },
                userStoreRoles: {
                    where: { role: 'OWNER', isActive: true },
                    include: { user: { select: { name: true, phone: true } } },
                    take: 1,
                    orderBy: { grantedAt: 'asc' },
                },
            },
            orderBy: { createdAt: 'desc' },
            skip: (page - 1) * limit,
            take: limit,
        }),
        prisma_1.prisma.store.count({ where }),
    ]);
    return reply.send({
        success: true,
        data: {
            items: stores.map((s) => ({
                storeId: s.storeId,
                name: s.name,
                storeCode: s.storeCode,
                industryType: s.industryType,
                isActive: s.isActive,
                createdAt: s.createdAt,
                orgId: s.organization.orgId,
                orgName: s.organization.name,
                planId: s.organization.planId,
                ownerName: s.userStoreRoles[0]?.user.name ?? null,
                ownerPhone: s.userStoreRoles[0]?.user.phone ?? null,
                userCount: s._count.userStoreRoles,
                productCount: s._count.products,
            })),
            total,
            page,
            limit,
            pages: Math.ceil(total / limit),
        },
    });
}
// ── PATCH /v1/admin/stores/:storeId ──────────────────────────────
async function updateStore(request, reply) {
    const { storeId } = request.params;
    const { isActive, industryType } = request.body ?? {};
    const current = await prisma_1.prisma.store.findUnique({
        where: { storeId },
        select: { industryType: true, isActive: true },
    });
    if (!current) {
        return reply.status(404).send({
            success: false,
            error: { code: 'NOT_FOUND', message: 'Store not found', statusCode: 404 },
        });
    }
    const needsIndustryChange = industryType && industryType !== current.industryType;
    try {
        if (needsIndustryChange) {
            await prisma_1.prisma.$transaction(async (tx) => {
                await tx.store.update({
                    where: { storeId },
                    data: {
                        industryType: industryType,
                        ...(isActive !== undefined && { isActive }),
                    },
                });
                // Remove master-provisioned (non-custom) categories and reprovision
                await tx.category.deleteMany({
                    where: { storeId, isCustom: false },
                });
                await (0, categoryProvisioning_1.provisionStoreCategories)(storeId, industryType, tx);
            });
        }
        else {
            const data = {};
            if (isActive !== undefined)
                data.isActive = isActive;
            if (Object.keys(data).length === 0) {
                return reply.status(400).send({
                    success: false,
                    error: { code: 'NO_FIELDS', message: 'No fields to update', statusCode: 400 },
                });
            }
            await prisma_1.prisma.store.update({ where: { storeId }, data });
        }
        const updated = await prisma_1.prisma.store.findUnique({
            where: { storeId },
            select: { storeId: true, name: true, industryType: true, isActive: true, updatedAt: true },
        });
        return reply.send({ success: true, data: updated });
    }
    catch (err) {
        if (err.code === 'P2025') {
            return reply.status(404).send({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Store not found', statusCode: 404 },
            });
        }
        throw err;
    }
}
// ── POST /v1/admin/orgs/:orgId/stores ────────────────────────────
async function addStoreToOrg(request, reply) {
    const { orgId } = request.params;
    const { storeName, industryType } = request.body ?? {};
    if (!storeName || !industryType) {
        return reply.status(400).send({
            success: false,
            error: { code: 'MISSING_FIELDS', message: 'storeName and industryType are required', statusCode: 400 },
        });
    }
    const org = await prisma_1.prisma.organization.findUnique({
        where: { orgId },
        select: { orgId: true },
    });
    if (!org) {
        return reply.status(404).send({
            success: false,
            error: { code: 'NOT_FOUND', message: 'Organization not found', statusCode: 404 },
        });
    }
    // Find org OWNER to assign as store owner
    const orgOwner = await prisma_1.prisma.user.findFirst({
        where: { orgId, userType: 'OWNER' },
        select: { userId: true },
    });
    const storeCode = storeName
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(0, 4)
        .padEnd(4, 'X')
        + (1000 + Math.floor(Math.random() * 9000)).toString();
    try {
        const store = await prisma_1.prisma.$transaction(async (tx) => {
            const s = await tx.store.create({
                data: {
                    orgId,
                    name: storeName,
                    storeCode,
                    industryType: industryType,
                    currencyCode: 'INR',
                    timezone: 'Asia/Kolkata',
                },
            });
            if (orgOwner) {
                await tx.userStoreRole.create({
                    data: {
                        userId: orgOwner.userId,
                        storeId: s.storeId,
                        role: 'OWNER',
                        grantedBy: orgOwner.userId,
                        isActive: true,
                    },
                });
            }
            await (0, categoryProvisioning_1.provisionStoreCategories)(s.storeId, industryType, tx);
            return s;
        });
        return reply.status(201).send({
            success: true,
            data: {
                storeId: store.storeId,
                name: store.name,
                storeCode: store.storeCode,
                industryType: store.industryType,
                orgId,
            },
        });
    }
    catch (err) {
        if (err.code === 'P2002') {
            return reply.status(409).send({
                success: false,
                error: { code: 'CONFLICT', message: 'Duplicate storeCode — try a different name', statusCode: 409 },
            });
        }
        throw err;
    }
}
//# sourceMappingURL=handler.js.map