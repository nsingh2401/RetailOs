// @ts-nocheck
import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middleware/auth';
import { storeMiddleware } from '../../middleware/store';
import { rateLimitMiddleware }
  from '../../middleware/rateLimit';
import * as handler from './handler';

export default async function storeRoutes(
  app: FastifyInstance,
) {
  // GET /v1/stores/:storeId
  // Returns current store settings
  app.get(
    '/:storeId',
    { preHandler: [
        rateLimitMiddleware,
        authMiddleware,
        storeMiddleware,
      ],
    },
    handler.getStore,
  );

  // PATCH /v1/stores/:storeId
  // Updates store settings
  app.patch(
    '/:storeId',
    { preHandler: [
        rateLimitMiddleware,
        authMiddleware,
        storeMiddleware,
      ],
    },
    handler.updateStore,
  );

  // PATCH /v1/stores/:storeId/industry-type
  app.patch(
    '/:storeId/industry-type',
    { preHandler: [
        rateLimitMiddleware,
        authMiddleware,
        storeMiddleware,
      ],
    },
    handler.changeIndustryType,
  );

  // POST /v1/stores/:storeId/sync-categories
  app.post(
    '/:storeId/sync-categories',
    { preHandler: [
        rateLimitMiddleware,
        authMiddleware,
        storeMiddleware,
      ],
    },
    handler.syncMasterCategories,
  );
}

