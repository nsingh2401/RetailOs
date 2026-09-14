// @ts-nocheck
import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middleware/auth';
import { storeMiddleware } from '../../middleware/store';
import { rateLimitMiddleware } from '../../middleware/rateLimit';
import * as handler from './handler';

const pre = [rateLimitMiddleware, authMiddleware, storeMiddleware];

export default async function uploadRoutes(app: FastifyInstance) {
  // Specific routes registered before parameterized ones
  app.post('/:storeId/upload/product-image',        { preHandler: pre }, handler.requestUploadUrl);
  app.post('/:storeId/upload/product-image/direct', { preHandler: pre }, handler.uploadProductImageDirect);
  app.post('/:storeId/upload/confirm',              { preHandler: pre }, handler.confirmUpload);
  app.get( '/:storeId/upload/history/:productId',   { preHandler: pre }, handler.getUploadHistory);
}

