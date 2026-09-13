import { Queue, Worker } from 'bullmq';
import { bullmqConnection } from '../lib/redis';
import { broadcastToStore } from '../modules/websocket/handler';

export const syncQueue = new Queue('sync-push', { connection: bullmqConnection });

new Worker('sync-push', async (job) => {
  const { deviceId, record, userId } = job.data;

  // TODO: implement per-entity sync processing
  // INVOICE → create/update invoice + line items
  // CUSTOMER → upsert customer
  // PAYMENT → idempotent payment insert
  // Each entity type has its own conflict resolution rule

  // Notify device via WebSocket
  broadcastToStore(record.storeId, {
    type: 'SYNC_COMPLETED',
    data: { deviceId, recordsSynced: 1, conflicts: 0, timestamp: new Date() },
  });
}, { connection: bullmqConnection, concurrency: 5 });
