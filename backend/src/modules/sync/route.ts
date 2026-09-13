import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middleware/auth';
import { rateLimitMiddleware } from '../../middleware/rateLimit';
import * as handler from './handler';

// Sync routes do NOT use storeMiddleware — storeId is carried in body/query
const pre = [rateLimitMiddleware, authMiddleware];

export default async function syncRoutes(app: FastifyInstance) {
  // ── Sync ──────────────────────────────────────────────────────
  app.post('/sync/push',                   { preHandler: pre }, handler.syncPush);
  app.get( '/sync/pull',                   { preHandler: pre }, handler.syncPull);
  app.get( '/sync/status/:deviceId',       { preHandler: pre }, handler.getSyncStatus);
  app.post('/sync/resolve-conflict',       { preHandler: pre }, handler.resolveConflict);

  // ── Devices ───────────────────────────────────────────────────
  app.post( '/devices/register',           { preHandler: pre }, handler.registerDevice);
  app.patch('/devices/:deviceId',          { preHandler: pre }, handler.updateDevice);
}
