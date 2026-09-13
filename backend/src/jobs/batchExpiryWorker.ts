import { Queue, Worker } from 'bullmq';
import { bullmqConnection } from '../lib/redis';
import { prisma } from '../lib/prisma';
import { broadcastToStore } from '../modules/websocket/handler';
import { sendPushNotification } from '../lib/firebase';

export const batchExpiryQueue = new Queue('batch-expiry', {
  connection: bullmqConnection,
  defaultJobOptions: { repeat: { pattern: '0 8 * * *' } },  // Daily at 8:00 AM
});

new Worker('batch-expiry', async () => {
  // Get all stores with expiring batches
  const expiringBatches = await prisma.$queryRaw<Array<{
    store_id: string; batch_id: string; product_name: string;
    days_to_expiry: number; remaining_qty: number;
  }>>`SELECT * FROM v_expiring_batches`;

  for (const batch of expiringBatches) {
    const event = {
      type: 'BATCH_EXPIRY_ALERT',
      data: {
        batchId:       batch.batch_id,
        productName:   batch.product_name,
        daysToExpiry:  batch.days_to_expiry,
        remainingQty:  batch.remaining_qty,
        storeId:       batch.store_id,
      },
    };

    broadcastToStore(batch.store_id, event);

    await sendPushNotification({
      topic: `store-${batch.store_id}-managers`,
      title: 'Batch Expiry Alert',
      body:  `${batch.product_name} expires in ${batch.days_to_expiry} days (${batch.remaining_qty} units remaining)`,
      data:  { type: 'BATCH_EXPIRY', batchId: batch.batch_id },
    });
  }
}, { connection: bullmqConnection });
