// @ts-nocheck
import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middleware/auth';
import { storeMiddleware } from '../../middleware/store';
import { rateLimitMiddleware } from '../../middleware/rateLimit';
import * as handler from './handler';

const pre = [rateLimitMiddleware, authMiddleware, storeMiddleware];

export default async function discountRoutes(app: FastifyInstance) {
  // specific routes before parameterized
  app.get(   '/:storeId/discounts/products/search', { preHandler: pre }, handler.searchProductsForDiscount);
  app.get(   '/:storeId/discounts',                 { preHandler: pre }, handler.listDiscounts);
  app.post(  '/:storeId/discounts',                 { preHandler: pre }, handler.createDiscount);
  app.patch( '/:storeId/discounts/:id',             { preHandler: pre }, handler.updateDiscount);
  app.delete('/:storeId/discounts/:id',             { preHandler: pre }, handler.deleteDiscount);
}
