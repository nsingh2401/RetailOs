"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.provisionStoreCategories = provisionStoreCategories;
const prisma_1 = require("../lib/prisma");
// Provisions master categories for a store's industry
// into the store's categories table.
// Must be called within the caller's Prisma transaction (tx).
// If it throws, the entire transaction rolls back.
// Safe to re-run: uses ON CONFLICT upsert on the
// partial unique index uq_store_master_category.
// Never touches rows where is_custom = true or
// master_category_id IS NULL.
async function provisionStoreCategories(storeId, industryType, tx) {
    // Master categories are read-only reference data;
    // query via prisma (not tx) is fine here.
    const masterCats = await prisma_1.prisma.masterCategory.findMany({
        where: { industryType: industryType,
            isActive: true },
        orderBy: [
            { parentId: 'asc' }, // nulls first → roots before children
            { sortOrder: 'asc' },
        ],
    });
    if (masterCats.length === 0)
        return { synced: 0 };
    const roots = masterCats.filter(mc => mc.parentId === null);
    const children = masterCats.filter(mc => mc.parentId !== null);
    // master category id → store category id
    const masterToStore = new Map();
    let synced = 0;
    // ── Pass 1: root categories ──────────────────
    for (const mc of roots) {
        const rows = await tx.$queryRaw `
      INSERT INTO categories
        (store_id, name,
         industry_type, master_category_id,
         is_custom, sort_order)
      VALUES
        (${storeId}::uuid, ${mc.name},
         ${mc.industryType}::industry_type,
         ${mc.id}::uuid,
         false, ${mc.sortOrder})
      ON CONFLICT (store_id, master_category_id)
        WHERE master_category_id IS NOT NULL
      DO UPDATE SET
        name       = EXCLUDED.name,
        sort_order = EXCLUDED.sort_order
      RETURNING category_id
    `;
        masterToStore.set(mc.id, rows[0].category_id);
        synced++;
    }
    // ── Pass 2: child categories ─────────────────
    for (const mc of children) {
        const parentStoreCatId = masterToStore.get(mc.parentId) ?? null;
        if (parentStoreCatId) {
            const rows = await tx.$queryRaw `
        INSERT INTO categories
          (store_id, name,
           parent_id,
           industry_type, master_category_id,
           is_custom, sort_order)
        VALUES
          (${storeId}::uuid, ${mc.name},
           ${parentStoreCatId}::uuid,
           ${mc.industryType}::industry_type,
           ${mc.id}::uuid,
           false, ${mc.sortOrder})
        ON CONFLICT (store_id, master_category_id)
          WHERE master_category_id IS NOT NULL
        DO UPDATE SET
          name       = EXCLUDED.name,
          sort_order = EXCLUDED.sort_order
        RETURNING category_id
      `;
            masterToStore.set(mc.id, rows[0].category_id);
        }
        else {
            // Parent resolution failed — insert as root.
            // Shouldn't happen if master data is well-formed.
            const rows = await tx.$queryRaw `
        INSERT INTO categories
          (store_id, name,
           industry_type, master_category_id,
           is_custom, sort_order)
        VALUES
          (${storeId}::uuid, ${mc.name},
           ${mc.industryType}::industry_type,
           ${mc.id}::uuid,
           false, ${mc.sortOrder})
        ON CONFLICT (store_id, master_category_id)
          WHERE master_category_id IS NOT NULL
        DO UPDATE SET
          name       = EXCLUDED.name,
          sort_order = EXCLUDED.sort_order
        RETURNING category_id
      `;
            masterToStore.set(mc.id, rows[0].category_id);
        }
        synced++;
    }
    return { synced };
}
//# sourceMappingURL=categoryProvisioning.js.map