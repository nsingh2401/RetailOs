"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.lowStockQueue = void 0;
const bullmq_1 = require("bullmq");
const redis_1 = require("../lib/redis");
const prisma_1 = require("../lib/prisma");
const handler_1 = require("../modules/websocket/handler");
const firebase_1 = require("../lib/firebase");
exports.lowStockQueue = new bullmq_1.Queue('low-stock-check', { connection: redis_1.bullmqConnection });
new bullmq_1.Worker('low-stock-check', async (job) => {
    const { storeId } = job.data;
    // Query low-stock items using v_stock_levels view
    const lowStockItems = await prisma_1.prisma.$queryRaw `
    SELECT variant_id, product_name, current_stock, reorder_point
    FROM v_stock_levels
    WHERE store_id = ${storeId}::uuid
      AND is_low_stock = TRUE
  `;
    for (const item of lowStockItems) {
        const event = {
            type: 'LOW_STOCK_ALERT',
            data: {
                variantId: item.variant_id,
                productName: item.product_name,
                currentStock: item.current_stock,
                reorderPoint: item.reorder_point,
                storeId,
            },
        };
        // Push via WebSocket to all connected clients for this store
        (0, handler_1.broadcastToStore)(storeId, event);
        // Also send FCM push to managers
        await (0, firebase_1.sendPushNotification)({
            topic: `store-${storeId}-managers`,
            title: 'Low Stock Alert',
            body: `${item.product_name} is running low (${item.current_stock} remaining)`,
            data: { type: 'LOW_STOCK', variantId: item.variant_id, storeId },
        });
    }
}, { connection: redis_1.bullmqConnection });
//# sourceMappingURL=lowStockWorker.js.map