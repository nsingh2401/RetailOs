// @ts-nocheck
import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middleware/auth';
import { storeMiddleware } from '../../middleware/store';
import { rateLimitMiddleware } from '../../middleware/rateLimit';
import * as handler from './handler';

const pre = [rateLimitMiddleware, authMiddleware, storeMiddleware];

export default async function reportRoutes(app: FastifyInstance) {
  app.get('/:storeId/reports/sales-summary',    { preHandler: pre }, handler.getSalesSummary);
  app.get('/:storeId/reports/top-products',     { preHandler: pre }, handler.getTopProducts);
  app.get('/:storeId/reports/slow-movers',      { preHandler: pre }, handler.getSlowMovers);
  app.get('/:storeId/reports/tax-summary',      { preHandler: pre }, handler.getTaxSummary);
  app.get('/:storeId/reports/credit-aging',     { preHandler: pre }, handler.getCreditAging);
  app.get('/:storeId/reports/purchase-summary', { preHandler: pre }, handler.getPurchaseSummary);
  app.get('/:storeId/reports/payment-modes',    { preHandler: pre }, handler.getPaymentModes);
  app.get('/:storeId/reports/gstr1',            { preHandler: pre }, handler.getGstr1);
  app.get('/:storeId/reports/gstr3b',           { preHandler: pre }, handler.getGstr3b);
  app.get('/:storeId/reports/export',           { preHandler: pre }, handler.exportReport);
  app.get('/:storeId/reports/tally-export',     { preHandler: pre }, handler.getTallyExport);
}

