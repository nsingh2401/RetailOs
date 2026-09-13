import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middleware/auth';
import { storeMiddleware } from '../../middleware/store';
import { rateLimitMiddleware } from '../../middleware/rateLimit';
import * as handler from './handler';

const pre = [rateLimitMiddleware, authMiddleware, storeMiddleware];

export default async function inventoryRoutes(app: FastifyInstance) {
  // ── IMPORTANT: specific routes registered BEFORE parameterized ones ──

  // Inventory — low-stock and adjust before /:variantId
  app.get( '/:storeId/inventory/low-stock',              { preHandler: pre }, handler.getLowStock);
  app.post('/:storeId/inventory/adjust',                 { preHandler: pre }, handler.adjustStock);
  app.get( '/:storeId/inventory',                        { preHandler: pre }, handler.getStockLevels);
  app.get( '/:storeId/inventory/:variantId',             { preHandler: pre }, handler.getVariantStock);
  app.get( '/:storeId/inventory/:variantId/movements',   { preHandler: pre }, handler.getMovementHistory);

  // Purchases
  app.post('/:storeId/purchases',                        { preHandler: pre }, handler.createPurchase);
  app.get( '/:storeId/purchases',                        { preHandler: pre }, handler.getPurchaseHistory);
  app.get( '/:storeId/purchases/:purchaseId',            { preHandler: pre }, handler.getPurchaseDetail);

  // Batches — expiring before /:variantId
  app.get( '/:storeId/batches/expiring',                 { preHandler: pre }, handler.getExpiringBatches);
  app.get( '/:storeId/batches/:variantId',               { preHandler: pre }, handler.getVariantBatches);
}
