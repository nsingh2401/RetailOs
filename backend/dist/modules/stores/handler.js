"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStore = getStore;
exports.updateStore = updateStore;
exports.changeIndustryType = changeIndustryType;
exports.syncMasterCategories = syncMasterCategories;
const prisma_1 = require("../../lib/prisma");
const redis_1 = require("../../lib/redis");
const categoryProvisioning_1 = require("../../services/categoryProvisioning");
// ── GET /v1/stores/:storeId ───────────────────────
async function getStore(request, reply) {
    const storeId = request.storeId;
    const store = await prisma_1.prisma.store.findUnique({
        where: { storeId },
        select: {
            storeId: true,
            name: true,
            storeCode: true,
            industryType: true,
            gstin: true,
            currencyCode: true,
            timezone: true,
            lowStockThreshold: true,
            slowMoverThreshold: true,
            tallyVersion: true,
            address: true,
            isActive: true,
            updatedAt: true,
        },
    });
    if (!store) {
        return reply.status(404).send({
            success: false,
            error: {
                code: 'STORE_NOT_FOUND',
                message: 'Store not found',
                statusCode: 404,
            },
        });
    }
    return reply.send({
        success: true,
        data: store,
    });
}
// ── PATCH /v1/stores/:storeId ─────────────────────
async function updateStore(request, reply) {
    const storeId = request.storeId;
    const { name, gstin, industryType, currencyCode, timezone, lowStockThreshold, slowMoverThreshold, tallyVersion, } = request.body ?? {};
    // Build update object — only defined fields
    const data = {};
    if (name !== undefined)
        data.name = name.trim();
    if (gstin !== undefined)
        data.gstin = gstin.trim() || null;
    if (industryType !== undefined)
        data.industryType = industryType;
    if (currencyCode !== undefined)
        data.currencyCode = currencyCode;
    if (timezone !== undefined)
        data.timezone = timezone;
    if (lowStockThreshold !== undefined)
        data.lowStockThreshold = lowStockThreshold;
    if (slowMoverThreshold !== undefined)
        data.slowMoverThreshold = Math.min(100, Math.max(1, slowMoverThreshold));
    if (tallyVersion !== undefined)
        data.tallyVersion = tallyVersion || null;
    if (Object.keys(data).length === 0) {
        return reply.status(400).send({
            success: false,
            error: {
                code: 'NO_FIELDS',
                message: 'No fields to update',
                statusCode: 400,
            },
        });
    }
    const updated = await prisma_1.prisma.store.update({
        where: { storeId },
        data,
        select: {
            storeId: true,
            name: true,
            industryType: true,
            gstin: true,
            currencyCode: true,
            timezone: true,
            lowStockThreshold: true,
            slowMoverThreshold: true,
            tallyVersion: true,
            updatedAt: true,
        },
    });
    // Invalidate master data store cache
    await (0, redis_1.cacheDelete)(`master_data:store:${storeId}`);
    return reply.send({
        success: true,
        data: updated,
    });
}
// ── PATCH /v1/stores/:storeId/industry-type ──────────
async function changeIndustryType(request, reply) {
    const storeId = request.storeId;
    const body = request.body;
    const { industryType } = body ?? {};
    const valid = [
        'APPAREL', 'FOOTWEAR', 'GROCERY', 'PHARMACY',
        'ELECTRONICS', 'HARDWARE', 'OPTICAL',
        'KITCHENWARE', 'STATIONERY', 'TOYS', 'GIFT',
        'BAKERY', 'PAINT', 'FURNITURE', 'JEWELRY',
        'BAGS', 'TEA_CAFE', 'PAAN_CIGARETTE', 'GENERAL',
    ];
    if (!industryType || !valid.includes(industryType)) {
        return reply.status(400).send({
            success: false,
            error: { code: 'INVALID_INDUSTRY',
                message: 'Invalid industryType',
                statusCode: 400 },
        });
    }
    const store = await prisma_1.prisma.$transaction(async (tx) => {
        const updated = await tx.store.update({
            where: { storeId },
            data: { industryType: industryType },
            select: {
                storeId: true,
                name: true,
                industryType: true,
                gstin: true,
                currencyCode: true,
                timezone: true,
                lowStockThreshold: true,
                updatedAt: true,
            },
        });
        // Remove old industry's master categories
        console.log(`[changeIndustryType] storeId=${storeId} industryType=${industryType} — running DELETE`);
        const deleted = await tx.$executeRaw `
      DELETE FROM categories
      WHERE store_id = ${storeId}::uuid
        AND master_category_id IS NOT NULL
        AND (industry_type IS NULL OR industry_type::text != ${industryType}::text)
    `;
        console.log(`[changeIndustryType] DELETE removed ${deleted} rows`);
        // Provision new industry's categories (upsert)
        await (0, categoryProvisioning_1.provisionStoreCategories)(storeId, industryType, tx);
        console.log(`[changeIndustryType] provisioning complete`);
        return updated;
    });
    await Promise.all([
        (0, redis_1.cacheDelete)(`categories:${storeId}`),
        (0, redis_1.cacheDelete)(`master_data:store:${storeId}`),
    ]);
    return reply.send({ success: true, data: store });
}
// ── POST /v1/stores/:storeId/sync-categories ─────────
// Copies master categories for the store's
// industry into the store's categories table.
// Called after industry is set/changed.
async function syncMasterCategories(request, reply) {
    const storeId = request.storeId;
    const store = await prisma_1.prisma.store.findUnique({
        where: { storeId },
        select: { industryType: true },
    });
    if (!store) {
        return reply.status(404).send({
            success: false,
            error: { code: 'STORE_NOT_FOUND',
                message: 'Store not found',
                statusCode: 404 },
        });
    }
    const industryType = store.industryType;
    // Roots first (parentId asc = nulls first),
    // then children in sortOrder
    const masterCats = await prisma_1.prisma.masterCategory.findMany({
        where: { industryType, isActive: true },
        orderBy: [
            { parentId: 'asc' },
            { sortOrder: 'asc' },
        ],
    });
    let synced = 0;
    for (const mc of masterCats) {
        // Resolve parent store category ID
        let parentCategoryId = null;
        if (mc.parentId) {
            const parentStoreCat = await prisma_1.prisma.category.findFirst({
                where: { storeId, masterCategoryId: mc.parentId },
            });
            parentCategoryId =
                parentStoreCat?.categoryId ?? null;
        }
        // Unique constraint: [storeId, name, parentId]
        // Use findFirst + create/update to
        // handle nullable parentId correctly
        const existing = await prisma_1.prisma.category.findFirst({
            where: {
                storeId,
                masterCategoryId: mc.id,
            },
        });
        if (existing) {
            await prisma_1.prisma.category.update({
                where: {
                    categoryId: existing.categoryId,
                },
                data: {
                    isActive: true,
                    ...(parentCategoryId && {
                        parentId: parentCategoryId
                    }),
                },
            });
        }
        else {
            await prisma_1.prisma.category.create({
                data: {
                    storeId,
                    name: mc.name,
                    ...(parentCategoryId && {
                        parentId: parentCategoryId
                    }),
                    isCustom: false,
                    masterCategoryId: mc.id,
                    isActive: true,
                },
            });
        }
        synced++;
    }
    return reply.send({
        success: true,
        data: { industryType, synced },
    });
}
//# sourceMappingURL=handler.js.map