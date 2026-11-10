// @ts-nocheck
import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middleware/auth';
import { storeMiddleware } from '../../middleware/store';
import { rateLimitMiddleware } from '../../middleware/rateLimit';
import * as handler from './handler';

const pre = [rateLimitMiddleware, authMiddleware, storeMiddleware];

export default async function inventoryRoutes(app: FastifyInstance) {
  // IMPORTANT: register all literal paths BEFORE parameterised ones

  // Inventory — literal paths before /:variantId
  app.get(   '/:storeId/inventory/low-stock',          { preHandler: pre }, handler.getLowStock);
  app.post(  '/:storeId/inventory/adjust',             { preHandler: pre }, handler.adjustStock);
  app.get(   '/:storeId/inventory/expired',            { preHandler: pre }, handler.getExpiredItems);
  app.delete('/:storeId/inventory/expired',            { preHandler: pre }, handler.clearExpiredStock);
  app.get(   '/:storeId/inventory/expired-batches',    { preHandler: pre }, handler.getExpiredBatches);
  app.delete('/:storeId/inventory/expired-batches',    { preHandler: pre }, handler.clearExpiredBatches);
  app.patch( '/:storeId/inventory/batches/:batchId',         { preHandler: pre }, handler.updateBatchExpiry);
  app.delete('/:storeId/inventory/batches/:batchId',         { preHandler: pre }, handler.deleteBatch);
  app.post(  '/:storeId/inventory/batches/:batchId/restore', { preHandler: pre }, handler.restoreBatch);
  app.get(   '/:storeId/inventory',                    { preHandler: pre }, handler.getStockLevels);
  app.get(   '/:storeId/inventory/:variantId',         { preHandler: pre }, handler.getVariantStock);
  app.get(   '/:storeId/inventory/:variantId/movements', { preHandler: pre }, handler.getMovementHistory);

  // Purchases
  app.post('/:storeId/purchases/scan-bill',            { preHandler: pre }, handler.scanVendorBill);
  app.post('/:storeId/purchases',                      { preHandler: pre }, handler.createPurchase);
  app.get( '/:storeId/purchases',                      { preHandler: pre }, handler.getPurchaseHistory);
  app.get( '/:storeId/purchases/:purchaseId',          { preHandler: pre }, handler.getPurchaseDetail);

  // Batches — expiring literal before /:variantId
  app.get(   '/:storeId/batches/expiring',             { preHandler: pre }, handler.getExpiringBatches);
  app.get(   '/:storeId/batches/:variantId',           { preHandler: pre }, handler.getVariantBatches);
}
