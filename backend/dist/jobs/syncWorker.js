"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncQueue = void 0;
const bullmq_1 = require("bullmq");
const redis_1 = require("../lib/redis");
const handler_1 = require("../modules/websocket/handler");
exports.syncQueue = new bullmq_1.Queue('sync-push', { connection: redis_1.bullmqConnection });
new bullmq_1.Worker('sync-push', async (job) => {
    const { deviceId, record, userId } = job.data;
    // TODO: implement per-entity sync processing
    // INVOICE → create/update invoice + line items
    // CUSTOMER → upsert customer
    // PAYMENT → idempotent payment insert
    // Each entity type has its own conflict resolution rule
    // Notify device via WebSocket
    (0, handler_1.broadcastToStore)(record.storeId, {
        type: 'SYNC_COMPLETED',
        data: { deviceId, recordsSynced: 1, conflicts: 0, timestamp: new Date() },
    });
}, { connection: redis_1.bullmqConnection, concurrency: 5 });
//# sourceMappingURL=syncWorker.js.map