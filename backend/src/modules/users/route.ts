// @ts-nocheck
import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middleware/auth';
import { storeMiddleware } from '../../middleware/store';
import { rateLimitMiddleware } from '../../middleware/rateLimit';
import * as handler from './handler';

const preStore = [rateLimitMiddleware, authMiddleware, storeMiddleware];
const preAuth  = [rateLimitMiddleware, authMiddleware];

// Registered under /v1/stores
export default async function storeUserRoutes(app: FastifyInstance) {
  app.post(  '/:storeId/users',         { preHandler: preStore }, handler.createStoreUser);
  app.get(   '/:storeId/users',         { preHandler: preStore }, handler.listStoreUsers);
  app.patch( '/:storeId/users/:userId', { preHandler: preStore }, handler.updateStoreUser);
  app.delete('/:storeId/users/:userId', { preHandler: preStore }, handler.removeStoreUser);
}

// Registered under /v1/users
export async function myStoresRoute(app: FastifyInstance) {
  app.get(   '/me/stores', { preHandler: preAuth }, handler.getMyStores);
  app.patch( '/me',        { preHandler: preAuth }, handler.updateMe);
  app.post(  '/me/avatar', { preHandler: preAuth }, handler.uploadAvatar);
}

