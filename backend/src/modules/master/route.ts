import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middleware/auth';
import { storeMiddleware } from '../../middleware/store';
import { rateLimitMiddleware }
  from '../../middleware/rateLimit';
import * as handler from './handler';

export default async function masterRoutes(
  app: FastifyInstance,
) {
  app.get(
    '/version',
    { preHandler: [rateLimitMiddleware] },
    handler.getMasterDataVersion,
  );

  app.get(
    '/industries',
    { preHandler: [rateLimitMiddleware] },
    handler.getMasterIndustries,
  );

  app.get(
    '/hsn',
    { preHandler: [rateLimitMiddleware] },
    handler.searchHsn,
  );

  app.get(
    '/full',
    { preHandler: [rateLimitMiddleware, authMiddleware] },
    handler.getMasterDataFull,
  );

  app.get(
    '/store-config',
    { preHandler: [
        rateLimitMiddleware,
        authMiddleware,
        storeMiddleware,
      ],
    },
    handler.getStoreConfig,
  );
}
