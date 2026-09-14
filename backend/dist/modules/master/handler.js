"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMasterDataVersion = getMasterDataVersion;
exports.getMasterDataFull = getMasterDataFull;
exports.getStoreConfig = getStoreConfig;
exports.searchHsn = searchHsn;
exports.getMasterIndustries = getMasterIndustries;
const prisma_1 = require("../../lib/prisma");
const redis_1 = require("../../lib/redis");
async function getMasterDataVersion(request, reply) {
    const config = await prisma_1.prisma.appConfig.findUnique({
        where: { key: 'master_data_version' },
    });
    return reply.send({
        success: true,
        data: { version: config?.value ?? '1' },
    });
}
async function getMasterDataFull(request, reply) {
    const CACHE_KEY = 'master_data:full';
    const cached = await (0, redis_1.cacheGet)(CACHE_KEY);
    if (cached) {
        return reply.send({ success: true, data: cached });
    }
    const [versionRow, industries, categories, brands] = await Promise.all([
        prisma_1.prisma.appConfig.findUnique({
            where: { key: 'master_data_version' },
        }),
        prisma_1.prisma.masterIndustryConfig.findMany({
            orderBy: { displayName: 'asc' },
        }),
        prisma_1.prisma.masterCategory.findMany({
            where: { isActive: true },
            orderBy: [
                { industryType: 'asc' },
                { sortOrder: 'asc' },
            ],
        }),
        prisma_1.prisma.masterBrand.findMany({
            where: { isActive: true },
            orderBy: [
                { isPopular: 'desc' },
                { name: 'asc' },
            ],
        }),
    ]);
    const payload = {
        version: versionRow?.value ?? '1',
        industries,
        categories,
        brands,
    };
    await (0, redis_1.cacheSet)(CACHE_KEY, payload, 3600);
    return reply.send({ success: true, data: payload });
}
async function getStoreConfig(request, reply) {
    const storeId = request.storeId;
    const CACHE_KEY = `master_data:store:${storeId}`;
    const cached = await (0, redis_1.cacheGet)(CACHE_KEY);
    if (cached) {
        return reply.send({ success: true, data: cached });
    }
    const store = await prisma_1.prisma.store.findUnique({
        where: { storeId },
        select: {
            storeId: true,
            name: true,
            industryType: true,
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
    const industryType = store.industryType;
    const [industryConfig, masterCategories, masterBrands, storeCategories, storeBrands,] = await Promise.all([
        prisma_1.prisma.masterIndustryConfig.findUnique({
            where: { industryType },
        }),
        prisma_1.prisma.masterCategory.findMany({
            where: {
                industryType,
                isActive: true,
                parentId: null,
            },
            include: {
                children: {
                    where: { isActive: true },
                    orderBy: { sortOrder: 'asc' },
                },
            },
            orderBy: { sortOrder: 'asc' },
        }),
        prisma_1.prisma.masterBrand.findMany({
            where: { isActive: true },
            orderBy: [
                { isPopular: 'desc' },
                { name: 'asc' },
            ],
        }),
        prisma_1.prisma.category.findMany({
            where: {
                storeId,
                isActive: true,
                isCustom: true,
            },
            orderBy: { name: 'asc' },
        }),
        prisma_1.prisma.brand.findMany({
            where: {
                storeId,
                isActive: true,
                isCustom: true,
            },
            orderBy: { name: 'asc' },
        }),
    ]);
    const filteredMasterBrands = masterBrands.filter((b) => {
        const industries = b.industries;
        return industries.includes(industryType);
    });
    const payload = {
        store: {
            storeId: store.storeId,
            name: store.name,
            industryType: store.industryType,
        },
        industryConfig,
        masterCategories,
        storeCategories,
        masterBrands: filteredMasterBrands,
        storeBrands,
    };
    await (0, redis_1.cacheSet)(CACHE_KEY, payload, 600);
    return reply.send({ success: true, data: payload });
}
async function fetchFromApiAndUpsert(q) {
    const apiKey = process.env.GSTACCELERATOR_API_KEY;
    if (!apiKey)
        return [];
    let json;
    try {
        const res = await fetch('https://gstaccelerator.in/v1/lookup', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({ description: q }),
        });
        if (!res.ok)
            return [];
        json = await res.json();
    }
    catch {
        return [];
    }
    const items = (json.data ?? json.results ?? []);
    const mapped = [];
    for (const item of items) {
        const code = String(item.hsn_code ?? item.hsnCode ?? '').trim();
        const desc = String(item.description ?? item.product_description ?? '').trim();
        const rate = Number(item.tax_rates?.igst ?? item.total_intrastate ?? item.gst_rate ?? 18);
        if (!code || !desc)
            continue;
        mapped.push({ hsnCode: code, description: desc, defaultGstRate: rate });
    }
    if (mapped.length === 0)
        return [];
    for (const row of mapped) {
        await prisma_1.prisma.$executeRaw `
      INSERT INTO hsn_codes (hsn_code, description, default_gst_rate, is_service, fetched_at)
      VALUES (${row.hsnCode}, ${row.description}, ${row.defaultGstRate}, false, NOW())
      ON CONFLICT (hsn_code) DO UPDATE
        SET description      = EXCLUDED.description,
            default_gst_rate = EXCLUDED.default_gst_rate,
            fetched_at       = NOW()
    `;
    }
    return mapped.slice(0, 20);
}
async function searchHsn(request, reply) {
    const q = (request.query.q ?? '').trim();
    if (q.length < 2)
        return reply.send({ success: true, data: [] });
    // 1. Local search
    const local = await prisma_1.prisma.hsnCode.findMany({
        where: {
            OR: [
                { hsnCode: { contains: q, mode: 'insensitive' } },
                { description: { contains: q, mode: 'insensitive' } },
            ],
        },
        select: {
            hsnCode: true, description: true,
            defaultGstRate: true, fetchedAt: true,
        },
        take: 20,
        orderBy: { hsnCode: 'asc' },
    });
    if (local.length > 0) {
        // Re-fetch in background if any API-sourced row is >90 days stale.
        // fetchedAt = null means seeded/manual data — never re-fetched proactively.
        const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        const hasStale = local.some((r) => r.fetchedAt !== null && r.fetchedAt < cutoff);
        if (hasStale)
            fetchFromApiAndUpsert(q).catch(() => { });
        return reply.send({
            success: true,
            data: local.map(({ fetchedAt: _f, ...r }) => r),
        });
    }
    // 2. Fallback: call API, upsert new rows, return
    const apiResults = await fetchFromApiAndUpsert(q);
    return reply.send({ success: true, data: apiResults });
}
async function getMasterIndustries(request, reply) {
    const CACHE_KEY = 'master_data:industries';
    const cached = await (0, redis_1.cacheGet)(CACHE_KEY);
    if (cached) {
        return reply.send({ success: true, data: { industries: cached } });
    }
    const industries = await prisma_1.prisma.masterIndustryConfig.findMany({
        select: { industryType: true, displayName: true },
        orderBy: { displayName: 'asc' },
    });
    await (0, redis_1.cacheSet)(CACHE_KEY, industries, 3600);
    return reply.send({ success: true, data: { industries } });
}
//# sourceMappingURL=handler.js.map