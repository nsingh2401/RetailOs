import { Queue, Worker } from 'bullmq';
import { bullmqConnection } from '../lib/redis';
import { prisma } from '../lib/prisma';

export const batchExpiryQueue = new Queue('batch-expiry', {
  connection: bullmqConnection,
});

// Schedule hourly idempotent expiry job
batchExpiryQueue.add('hourly-expiry', {}, { repeat: { pattern: '0 * * * *' } });

new Worker('batch-expiry', async () => {
  const stores = await prisma.store.findMany({
    where:  { isActive: true },
    select: { storeId: true, timezone: true },
  });

  let totalStores = 0;
  let totalBatches = 0;

  for (const store of stores) {
    const tz = store.timezone ?? 'UTC';

    // Find batches expired in this store's local timezone
    const expired = await prisma.$queryRaw<Array<{
      batch_id: string; variant_id: string; remaining_qty: number;
    }>>`
      SELECT batch_id, variant_id, remaining_qty
      FROM batches
      WHERE store_id    = ${store.storeId}::uuid
        AND is_expired  = false
        AND remaining_qty > 0
        AND expiry_date IS NOT NULL
        AND expiry_date < (NOW() AT TIME ZONE ${tz})::date
    `;

    if (expired.length === 0) continue;
    totalStores++;
    totalBatches += expired.length;

    for (const b of expired) {
      const qty = Number(b.remaining_qty);
      if (qty <= 0) continue;

      await prisma.$transaction(async (tx) => {
        // Mark expired, zero out qty
        await tx.batch.update({
          where: { batchId: b.batch_id },
          data:  { isExpired: true, remainingQty: 0 },
        });

        // Subtract expired qty from inventory
        const inv = await tx.inventory.findUnique({
          where: { storeId_variantId: { storeId: store.storeId, variantId: b.variant_id } },
        });
        if (!inv) return;

        const qtyBefore = Number(inv.quantity);
        const qtyAfter  = Math.max(0, qtyBefore - qty);

        await tx.inventory.update({
          where: { storeId_variantId: { storeId: store.storeId, variantId: b.variant_id } },
          data:  { quantity: qtyAfter },
        });

        await tx.inventoryMovement.create({
          data: {
            storeId:        store.storeId,
            variantId:      b.variant_id,
            batchId:        b.batch_id,
            movementType:   'EXPIRED_CLEARANCE',
            quantityDelta:  -(qtyBefore - qtyAfter),
            quantityBefore: qtyBefore,
            quantityAfter:  qtyAfter,
            referenceType:  'BATCH',
            referenceId:    b.batch_id,
            performedBy:    null,
          },
        });
      });
    }
  }

  console.log(`[batchExpiry] expired ${totalBatches} batches across ${totalStores} stores`);
}, { connection: bullmqConnection });
