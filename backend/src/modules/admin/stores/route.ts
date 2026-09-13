import { FastifyInstance } from 'fastify';
import { adminAuthMiddleware } from '../../../middleware/adminAuth';
import { listStores, updateStore } from './handler';

export default async function adminStoreRoutes(app: FastifyInstance) {
  app.addHook('preHandler', adminAuthMiddleware);

  app.get('/',           listStores);
  app.patch('/:storeId', updateStore);
}
