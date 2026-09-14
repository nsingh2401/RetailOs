"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.batchExpiryQueue = void 0;
const bullmq_1 = require("bullmq");
const redis_1 = require("../lib/redis");
const prisma_1 = require("../lib/prisma");
const handler_1 = require("../modules/websocket/handler");
const firebase_1 = require("../lib/firebase");
exports.batchExpiryQueue = new bullmq_1.Queue('batch-expiry', {
    connection: redis_1.bullmqConnection,
});
// Schedule the repeating job once on startup (daily at 8:00 AM)
exports.batchExpiryQueue.add('daily-check', {}, { repeat: { pattern: '0 8 * * *' } });
new bullmq_1.Worker('batch-expiry', async () => {
    // Get all stores with expiring batches
    const expiringBatches = await prisma_1.prisma.$queryRaw `SELECT * FROM v_expiring_batches`;
    for (const batch of expiringBatches) {
        const event = {
            type: 'BATCH_EXPIRY_ALERT',
            data: {
                batchId: batch.batch_id,
                productName: batch.product_name,
                daysToExpiry: batch.days_to_expiry,
                remainingQty: batch.remaining_qty,
                storeId: batch.store_id,
            },
        };
        (0, handler_1.broadcastToStore)(batch.store_id, event);
        await (0, firebase_1.sendPushNotification)({
            topic: `store-${batch.store_id}-managers`,
            title: 'Batch Expiry Alert',
            body: `${batch.product_name} expires in ${batch.days_to_expiry} days (${batch.remaining_qty} units remaining)`,
            data: { type: 'BATCH_EXPIRY', batchId: batch.batch_id },
        });
    }
}, { connection: redis_1.bullmqConnection });
//# sourceMappingURL=batchExpiryWorker.js.map