// @ts-nocheck
import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middleware/auth';
import { storeMiddleware, requireRole } from '../../middleware/store';
import { rateLimitMiddleware } from '../../middleware/rateLimit';
import * as handler from './handler';

const pre = [rateLimitMiddleware, authMiddleware, storeMiddleware];

export default async function invoiceRoutes(app: FastifyInstance) {
  app.post('/:storeId/invoices',                              { preHandler: [...pre] },                            handler.createInvoice);
  app.get( '/:storeId/invoices',                              { preHandler: [...pre, requireRole('OWNER', 'MANAGER')] },    handler.listInvoices);
  app.get( '/:storeId/invoices/:invoiceId',                   { preHandler: [...pre] },                            handler.getInvoice);
  app.post('/:storeId/invoices/:invoiceId/confirm',           { preHandler: [...pre] },                            handler.confirmInvoice);
  app.post('/:storeId/invoices/:invoiceId/payments',          { preHandler: [...pre] },                            handler.recordPayment);
  app.post('/:storeId/invoices/:invoiceId/cancel',            { preHandler: [...pre, requireRole('OWNER', 'MANAGER')] },    handler.cancelInvoice);
}

