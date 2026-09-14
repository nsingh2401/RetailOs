"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getJewelryConfig = getJewelryConfig;
exports.updateJewelryConfig = updateJewelryConfig;
const prisma_1 = require("../../lib/prisma");
const redis_1 = require("../../lib/redis");
const goldRateWorker_1 = require("../../jobs/goldRateWorker");
const DEFAULT_MAKING_CHARGES = {
    '24K': 8,
    '22K': 10,
    '18K': 12,
    '14K': 14,
    '925 Silver': 6,
    '999 Silver': 5,
};
// ── GET /:storeId/jewelry-config ──────
async function getJewelryConfig(request, reply) {
    const storeId = request.storeId;
    // 1. Get store jewelry settings
    const store = await prisma_1.prisma.store
        .findUnique({
        where: { storeId },
        select: { settings: true, currencyCode: true },
    });
    const storeCurrency = store?.currencyCode ?? 'INR';
    const settings = (store?.settings ?? {});
    const jewelrySettings = (settings['jewelry'] ?? {});
    const makingCharges = jewelrySettings['making_charges']
        ?? DEFAULT_MAKING_CHARGES;
    const festivalDiscountPct = jewelrySettings['festival_discount_pct'] ?? 0;
    const goldRateOverride = jewelrySettings['gold_rate_override'] ?? null;
    const silverRateOverride = jewelrySettings['silver_rate_override'] ?? null;
    // 2. Get live rates from Redis cache
    let goldRate = null;
    let silverRate = null;
    let rateSource = 'manual';
    let lastFetched = null;
    if (!goldRateOverride) {
        const cached = await redis_1.redis.get(`jewelry:gold_rate_per_gram_${storeCurrency}`);
        const cachedFallback = !cached
            ? await redis_1.redis.get('jewelry:gold_rate_per_gram')
            : null;
        const goldCached = cached
            ?? cachedFallback;
        if (goldCached) {
            goldRate = parseFloat(goldCached);
            rateSource = 'metalpriceapi';
        }
        else {
            // Cache miss — auto-fetch live rates
            await (0, goldRateWorker_1.fetchAndCacheGoldRate)();
            const fresh = await redis_1.redis.get(`jewelry:gold_rate_per_gram_${storeCurrency}`)
                ?? await redis_1.redis.get('jewelry:gold_rate_per_gram');
            if (fresh) {
                goldRate = parseFloat(fresh);
                rateSource = 'metalpriceapi';
            }
            else {
                // Final fallback to DB
                const dbRate = await prisma_1.prisma.fxRate
                    .findFirst({
                    where: {
                        baseCurrency: 'XAU',
                        quoteCurrency: storeCurrency,
                    },
                    orderBy: {
                        effectiveDate: 'desc',
                    },
                });
                if (dbRate) {
                    goldRate =
                        parseFloat(dbRate.rate
                            .toString());
                    rateSource = 'database';
                    lastFetched =
                        dbRate.effectiveDate
                            .toISOString();
                }
            }
        }
    }
    else {
        goldRate = goldRateOverride;
        rateSource = 'manual_override';
    }
    if (!silverRateOverride) {
        const cached = await redis_1.redis.get(`jewelry:silver_rate_per_gram_${storeCurrency}`);
        const cachedFallback = !cached
            ? await redis_1.redis.get('jewelry:silver_rate_per_gram')
            : null;
        const silverCached = cached
            ?? cachedFallback;
        if (silverCached) {
            silverRate = parseFloat(silverCached);
        }
        else {
            // fetchAndCacheGoldRate already ran above
            // (it fetches both metals); check Redis first
            const freshSilver = await redis_1.redis.get(`jewelry:silver_rate_per_gram_${storeCurrency}`)
                ?? await redis_1.redis.get('jewelry:silver_rate_per_gram');
            if (freshSilver) {
                silverRate = parseFloat(freshSilver);
            }
            else {
                const dbRate = await prisma_1.prisma.fxRate
                    .findFirst({
                    where: {
                        baseCurrency: 'XAG',
                        quoteCurrency: storeCurrency,
                    },
                    orderBy: {
                        effectiveDate: 'desc',
                    },
                });
                if (dbRate) {
                    silverRate =
                        parseFloat(dbRate.rate
                            .toString());
                }
            }
        }
    }
    else {
        silverRate = silverRateOverride;
    }
    // 3. Get last fetched time
    const lastFetchedConfig = await prisma_1.prisma.appConfig.findUnique({
        where: { key: 'gold_rate_last_fetched' },
    });
    if (lastFetchedConfig) {
        lastFetched = lastFetchedConfig.value;
    }
    return reply.send({
        success: true,
        data: {
            goldRatePerGram: goldRate,
            silverRatePerGram: silverRate,
            rateSource,
            lastFetched,
            makingCharges,
            festivalDiscountPct,
            goldRateOverride,
            silverRateOverride,
        },
    });
}
// ── PATCH /:storeId/jewelry-config ────
async function updateJewelryConfig(request, reply) {
    const storeId = request.storeId;
    const body = request.body ?? {};
    const store = await prisma_1.prisma.store
        .findUnique({
        where: { storeId },
        select: { settings: true },
    });
    const existing = (store?.settings ?? {});
    const existingJewelry = (existing['jewelry'] ?? {});
    const updated = {
        ...existing,
        jewelry: {
            ...existingJewelry,
            ...(body.makingCharges && {
                making_charges: body.makingCharges,
            }),
            ...(body.festivalDiscountPct !==
                undefined && {
                festival_discount_pct: body.festivalDiscountPct,
            }),
            ...(body.goldRateOverride !==
                undefined && {
                gold_rate_override: body.goldRateOverride,
            }),
            ...(body.silverRateOverride !==
                undefined && {
                silver_rate_override: body.silverRateOverride,
            }),
        },
    };
    await prisma_1.prisma.store.update({
        where: { storeId },
        data: { settings: updated },
    });
    return reply.send({
        success: true,
        message: 'Jewelry config updated',
    });
}
//# sourceMappingURL=handler.js.map