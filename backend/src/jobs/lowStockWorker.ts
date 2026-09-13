import { Queue, Worker } from 'bullmq';
import { bullmqConnection } from '../lib/redis';
import { prisma } from '../lib/prisma';
import { broadcastToStore } from '../modules/websocket/handler';
import { sendPushNotification } from '../lib/firebase';

export const lowStockQueue = new Queue('low-stock-check', { connection: bullmqConnection });

new Worker('low-stock-check', async (job) => {
  const { storeId } = job.data as { storeId: string };

  // Query low-stock items using v_stock_levels view
  const lowStockItems = await prisma.$queryRaw<Array<{
    variant_id: string; product_name: string; current_stock: number; reorder_point: number;
  }>>`
    SELECT variant_id, product_name, current_stock, reorder_point
    FROM v_stock_levels
    WHERE store_id = ${storeId}::uuid
      AND is_low_stock = TRUE
  `;

  for (const item of lowStockItems) {
    const event = {
      type: 'LOW_STOCK_ALERT',
      data: {
        variantId:    item.variant_id,
        productName:  item.product_name,
        currentStock: item.current_stock,
        reorderPoint: item.reorder_point,
        storeId,
      },
    };

    // Push via WebSocket to all connected clients for this store
    broadcastToStore(storeId, event);

    // Also send FCM push to managers
    await sendPushNotification({
      topic:  `store-${storeId}-managers`,
      title:  'Low Stock Alert',
      body:   `${item.product_name} is running low (${item.current_stock} remaining)`,
      data:   { type: 'LOW_STOCK', variantId: item.variant_id, storeId },
    });
  }
}, { connection: bullmqConnection });
