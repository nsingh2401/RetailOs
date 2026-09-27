// @ts-nocheck
import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middleware/auth';
import { storeMiddleware, requireRole } from '../../middleware/store';
import { rateLimitMiddleware } from '../../middleware/rateLimit';
import * as handler from './tally-handler';

const pre = [rateLimitMiddleware, authMiddleware, storeMiddleware];

export default async function importRoutes(app: FastifyInstance) {
  // OWNER only — Tally XML import
  app.post(
    '/:storeId/import/tally',
    { preHandler: [...pre, requireRole('OWNER')] },
    handler.importTallyXml,
  );
}
