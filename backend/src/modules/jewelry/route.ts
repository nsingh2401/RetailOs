// @ts-nocheck
import { FastifyInstance } from 'fastify';
import { authMiddleware }
  from '../../middleware/auth';
import { storeMiddleware }
  from '../../middleware/store';
import { rateLimitMiddleware }
  from '../../middleware/rateLimit';
import * as handler from './handler';

const pre = [
  rateLimitMiddleware,
  authMiddleware,
  storeMiddleware,
];

export default async function
    jewelryRoutes(app: FastifyInstance) {

  // GET current gold/silver rates +
  // store making charges config
  app.get(
    '/:storeId/jewelry-config',
    { preHandler: pre },
    handler.getJewelryConfig,
  );

  // PATCH store jewelry settings
  // (making charges, festival discount,
  // manual rate override)
  app.patch(
    '/:storeId/jewelry-config',
    { preHandler: pre },
    handler.updateJewelryConfig,
  );
}

