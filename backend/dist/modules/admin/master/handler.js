"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listMasterCategories = listMasterCategories;
exports.addMasterCategory = addMasterCategory;
exports.deleteMasterCategory = deleteMasterCategory;
exports.listCustomCategoryPromotionCandidates = listCustomCategoryPromotionCandidates;
exports.promoteToMaster = promoteToMaster;
exports.listMasterBrands = listMasterBrands;
exports.createMasterBrand = createMasterBrand;
exports.updateMasterBrand = updateMasterBrand;
exports.deleteMasterBrand = deleteMasterBrand;
exports.listBrandPromotionCandidates = listBrandPromotionCandidates;
exports.promoteBrandToMaster = promoteBrandToMaster;
const client_1 = require("@prisma/client");
const prisma_1 = require("../../../lib/prisma");
// ── GET /v1/admin/master/categories ──────────────────────────────
async function listMasterCategories(_request, reply) {
    const all = await prisma_1.prisma.masterCategory.findMany({
        where: { isActive: true },
        include: {
            children: {
                where: { isActive: true },
                orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
            },
        },
        orderBy: [{ industryType: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    });
    // Roots only (children carry sub-categories via include)
    const roots = all.filter(mc => mc.parentId === null);
    // Group by industryType
    const grouped = {};
    for (const mc of roots) {
        const ind = mc.industryType;
        if (!grouped[ind])
            grouped[ind] = [];
        grouped[ind].push({
            id: mc.id,
            name: mc.name,
            sortOrder: mc.sortOrder,
            children: mc.children.map(c => ({
                id: c.id,
                name: c.name,
                sortOrder: c.sortOrder,
            })),
        });
    }
    return reply.send({ success: true, data: grouped });
}
// ── POST /v1/admin/master/categories ─────────────────────────────
async function addMasterCategory(request, reply) {
    const body = request.body;
    const name = body?.name?.trim();
    const industryType = body?.industryType?.trim();
    if (!name || !industryType) {
        return reply.status(400).send({
            success: false,
            error: { code: 'VALIDATION_ERROR', message: 'name and industryType are required', statusCode: 400 },
        });
    }
    try {
        const mc = await prisma_1.prisma.masterCategory.create({
            data: {
                name,
                industryType,
                parentId: body?.parentId ?? null,
                sortOrder: body?.sortOrder ?? 0,
                isActive: true,
            },
        });
        return reply.status(201).send({ success: true, data: mc });
    }
    catch (err) {
        if (err.code === 'P2002') {
            return reply.status(409).send({
                success: false,
                error: { code: 'DUPLICATE_CATEGORY', message: 'A master category with this name already exists', statusCode: 409 },
            });
        }
        throw err;
    }
}
// ── DELETE /v1/admin/master/categories/:id ────────────────────────
async function deleteMasterCategory(request, reply) {
    const { id } = request.params;
    const mc = await prisma_1.prisma.masterCategory.findUnique({
        where: { id },
        include: { _count: { select: { children: true } } },
    });
    if (!mc) {
        return reply.status(404).send({
            success: false,
            error: { code: 'NOT_FOUND', message: 'Master category not found', statusCode: 404 },
        });
    }
    if (mc._count.children > 0) {
        return reply.status(409).send({
            success: false,
            error: {
                code: 'HAS_CHILDREN',
                message: `Cannot delete: has ${mc._count.children} sub-categor${mc._count.children === 1 ? 'y' : 'ies'}. Delete them first.`,
                statusCode: 409,
            },
        });
    }
    // Remove linked store categories first (FK safety)
    await prisma_1.prisma.category.deleteMany({ where: { masterCategoryId: id } });
    await prisma_1.prisma.masterCategory.delete({ where: { id } });
    return reply.send({ success: true, data: { deleted: true } });
}
// ── GET /v1/admin/master/custom-categories ────────────────────────
async function listCustomCategoryPromotionCandidates(request, reply) {
    const qs = request.query;
    const threshold = Math.max(1, parseInt(qs.threshold ?? '5', 10));
    const rows = await prisma_1.prisma.$queryRaw(client_1.Prisma.sql `
    SELECT
      c.name,
      c.industry_type::text           AS industry_type,
      COUNT(DISTINCT c.store_id)      AS store_count,
      STRING_AGG(DISTINCT p.name, ', ' ORDER BY p.name)
                                      AS parent_names
    FROM  categories c
    LEFT  JOIN categories p
           ON  p.category_id = c.parent_id
           AND p.is_active    = true
    WHERE c.is_custom  = true
      AND c.is_active  = true
    GROUP BY c.name, c.industry_type
    HAVING COUNT(DISTINCT c.store_id) >= ${threshold}
    ORDER BY store_count DESC, c.name ASC
  `);
    return reply.send({
        success: true,
        data: rows.map(r => ({
            name: r.name,
            industryType: r.industry_type,
            storeCount: Number(r.store_count),
            parentNames: r.parent_names ?? null,
        })),
    });
}
// ── POST /v1/admin/master/promote ────────────────────────────────
async function promoteToMaster(request, reply) {
    const body = request.body;
    const name = body?.name?.trim();
    const industryType = body?.industryType?.trim();
    if (!name || !industryType) {
        return reply.status(400).send({
            success: false,
            error: { code: 'VALIDATION_ERROR', message: 'name and industryType are required', statusCode: 400 },
        });
    }
    // 1. Insert into master_categories
    let masterCat;
    try {
        masterCat = await prisma_1.prisma.masterCategory.create({
            data: {
                name,
                industryType,
                parentId: body?.parentMasterCategoryId ?? null,
                isActive: true,
                sortOrder: 0,
            },
        });
    }
    catch (err) {
        if (err.code === 'P2002') {
            return reply.status(409).send({
                success: false,
                error: { code: 'DUPLICATE_CATEGORY', message: 'A master category with this name already exists for this industry', statusCode: 409 },
            });
        }
        throw err;
    }
    // 2. Provision the new category to all active stores of that industry
    const stores = await prisma_1.prisma.store.findMany({
        where: { industryType: industryType, isActive: true },
        select: { storeId: true },
    });
    let provisionedCount = 0;
    const parentMasterCatId = body?.parentMasterCategoryId ?? null;
    for (const store of stores) {
        try {
            await prisma_1.prisma.$transaction(async (tx) => {
                // Resolve parent store category if a parent master cat is specified
                let parentStoreCatId = null;
                if (parentMasterCatId) {
                    const parentCat = await tx.category.findFirst({
                        where: { storeId: store.storeId, masterCategoryId: parentMasterCatId },
                        select: { categoryId: true },
                    });
                    parentStoreCatId = parentCat?.categoryId ?? null;
                }
                if (parentStoreCatId) {
                    await tx.$executeRaw(client_1.Prisma.sql `
            INSERT INTO categories
              (store_id, name, parent_id, industry_type, master_category_id, is_custom, sort_order)
            VALUES
              (${store.storeId}::uuid,
               ${masterCat.name},
               ${parentStoreCatId}::uuid,
               ${industryType}::industry_type,
               ${masterCat.id}::uuid,
               false, 0)
            ON CONFLICT (store_id, master_category_id)
              WHERE master_category_id IS NOT NULL
            DO UPDATE SET name = EXCLUDED.name
          `);
                }
                else {
                    await tx.$executeRaw(client_1.Prisma.sql `
            INSERT INTO categories
              (store_id, name, industry_type, master_category_id, is_custom, sort_order)
            VALUES
              (${store.storeId}::uuid,
               ${masterCat.name},
               ${industryType}::industry_type,
               ${masterCat.id}::uuid,
               false, 0)
            ON CONFLICT (store_id, master_category_id)
              WHERE master_category_id IS NOT NULL
            DO UPDATE SET name = EXCLUDED.name
          `);
                }
            });
            provisionedCount++;
        }
        catch (provErr) {
            console.error(`[promoteToMaster] failed to provision store ${store.storeId}:`, provErr);
        }
    }
    return reply.status(201).send({
        success: true,
        data: {
            masterCategory: masterCat,
            provisionedStores: provisionedCount,
            totalStores: stores.length,
        },
    });
}
// ── GET /v1/admin/master/brands ───────────────────────────────────
async function listMasterBrands(request, reply) {
    const qs = request.query;
    const search = qs.search?.trim();
    const industry = qs.industry?.trim();
    const brands = await prisma_1.prisma.masterBrand.findMany({
        where: {
            isActive: true,
            ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
        },
        orderBy: [{ isPopular: 'desc' }, { name: 'asc' }],
    });
    const filtered = industry
        ? brands.filter(b => {
            const inds = Array.isArray(b.industries) ? b.industries : [];
            return inds.includes(industry);
        })
        : brands;
    return reply.send({ success: true, data: filtered });
}
// ── POST /v1/admin/master/brands ──────────────────────────────────
async function createMasterBrand(request, reply) {
    const body = request.body;
    const name = body?.name?.trim();
    if (!name) {
        return reply.status(400).send({
            success: false,
            error: { code: 'VALIDATION_ERROR', message: 'name is required', statusCode: 400 },
        });
    }
    try {
        const brand = await prisma_1.prisma.masterBrand.create({
            data: {
                name,
                industries: body?.industries ?? [],
                isPopular: body?.isPopular ?? false,
                isActive: true,
            },
        });
        return reply.status(201).send({ success: true, data: brand });
    }
    catch (err) {
        if (err.code === 'P2002') {
            return reply.status(409).send({
                success: false,
                error: { code: 'DUPLICATE_BRAND', message: 'A master brand with this name already exists', statusCode: 409 },
            });
        }
        throw err;
    }
}
// ── PATCH /v1/admin/master/brands/:id ────────────────────────────
async function updateMasterBrand(request, reply) {
    const { id } = request.params;
    const body = request.body;
    const existing = await prisma_1.prisma.masterBrand.findUnique({ where: { id } });
    if (!existing) {
        return reply.status(404).send({
            success: false,
            error: { code: 'NOT_FOUND', message: 'Master brand not found', statusCode: 404 },
        });
    }
    try {
        const updated = await prisma_1.prisma.masterBrand.update({
            where: { id },
            data: {
                ...(body?.name !== undefined && { name: body.name.trim() }),
                ...(body?.industries !== undefined && { industries: body.industries }),
                ...(body?.isPopular !== undefined && { isPopular: body.isPopular }),
                ...(body?.isActive !== undefined && { isActive: body.isActive }),
            },
        });
        return reply.send({ success: true, data: updated });
    }
    catch (err) {
        if (err.code === 'P2002') {
            return reply.status(409).send({
                success: false,
                error: { code: 'DUPLICATE_BRAND', message: 'A master brand with this name already exists', statusCode: 409 },
            });
        }
        throw err;
    }
}
// ── DELETE /v1/admin/master/brands/:id ───────────────────────────
async function deleteMasterBrand(request, reply) {
    const { id } = request.params;
    const existing = await prisma_1.prisma.masterBrand.findUnique({ where: { id } });
    if (!existing) {
        return reply.status(404).send({
            success: false,
            error: { code: 'NOT_FOUND', message: 'Master brand not found', statusCode: 404 },
        });
    }
    await prisma_1.prisma.masterBrand.update({ where: { id }, data: { isActive: false } });
    return reply.send({ success: true, data: { deleted: true } });
}
// ── GET /v1/admin/master/brands/store-created ─────────────────────
async function listBrandPromotionCandidates(request, reply) {
    const qs = request.query;
    const threshold = Math.max(1, parseInt(qs.threshold ?? '5', 10));
    const rows = await prisma_1.prisma.$queryRaw(client_1.Prisma.sql `
    SELECT
      b.name,
      COUNT(DISTINCT b.store_id) AS store_count
    FROM  brands b
    WHERE b.is_active        = true
      AND b.master_brand_id  IS NULL
    GROUP BY b.name
    HAVING COUNT(DISTINCT b.store_id) >= ${threshold}
    ORDER BY store_count DESC, b.name ASC
  `);
    return reply.send({
        success: true,
        data: rows.map(r => ({
            name: r.name,
            storeCount: Number(r.store_count),
        })),
    });
}
// ── POST /v1/admin/master/brands/promote ─────────────────────────
async function promoteBrandToMaster(request, reply) {
    const body = request.body;
    const name = body?.name?.trim();
    if (!name) {
        return reply.status(400).send({
            success: false,
            error: { code: 'VALIDATION_ERROR', message: 'name is required', statusCode: 400 },
        });
    }
    let masterBrand;
    try {
        masterBrand = await prisma_1.prisma.masterBrand.create({
            data: {
                name,
                industries: body?.industries ?? [],
                isPopular: false,
                isActive: true,
            },
        });
    }
    catch (err) {
        if (err.code === 'P2002') {
            return reply.status(409).send({
                success: false,
                error: { code: 'DUPLICATE_BRAND', message: 'A master brand with this name already exists', statusCode: 409 },
            });
        }
        throw err;
    }
    // Link existing store brands with this name to the new master brand
    const result = await prisma_1.prisma.brand.updateMany({
        where: {
            name: { equals: name, mode: 'insensitive' },
            masterBrandId: null,
            isActive: true,
        },
        data: { masterBrandId: masterBrand.id },
    });
    return reply.status(201).send({
        success: true,
        data: {
            masterBrand,
            linkedStores: result.count,
        },
    });
}
//# sourceMappingURL=handler.js.map