// @ts-nocheck
import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middleware/auth';
import { storeMiddleware } from '../../middleware/store';
import { rateLimitMiddleware } from '../../middleware/rateLimit';
import * as handler from './handler';

const pre = [rateLimitMiddleware, authMiddleware, storeMiddleware];

export default async function customerRoutes(app: FastifyInstance) {
  // â”€â”€ IMPORTANT: specific routes registered BEFORE /:customerId â”€â”€

  app.get( '/:storeId/customers',                            { preHandler: pre }, handler.listCustomers);
  app.post('/:storeId/customers',                            { preHandler: pre }, handler.createCustomer);

  // /search and /outstanding must be before /:customerId
  app.get( '/:storeId/customers/search',                     { preHandler: pre }, handler.searchCustomers);
  app.get( '/:storeId/customers/outstanding',                { preHandler: pre }, handler.getOutstandingCustomers);

  app.get(   '/:storeId/customers/:customerId',              { preHandler: pre }, handler.getCustomer);
  app.patch( '/:storeId/customers/:customerId',              { preHandler: pre }, handler.updateCustomer);
  app.get(   '/:storeId/customers/:customerId/ledger',       { preHandler: pre }, handler.getCreditLedger);
  app.post(  '/:storeId/customers/:customerId/payment',      { preHandler: pre }, handler.recordCreditPayment);
}

