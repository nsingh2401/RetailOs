// @ts-nocheck
import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middleware/auth';
import { storeMiddleware } from '../../middleware/store';
import { rateLimitMiddleware } from '../../middleware/rateLimit';
import * as handler from './handler';

const pre      = [rateLimitMiddleware, authMiddleware];
const preStore = [rateLimitMiddleware, authMiddleware, storeMiddleware];

export default async function taxRoutes(app: FastifyInstance) {
  // â”€â”€ Tax rules (org-scoped, no storeMiddleware needed) â”€â”€â”€â”€â”€â”€
  app.get( '/org/tax-rules',              { preHandler: pre }, handler.listTaxRules);
  app.post('/org/tax-rules',              { preHandler: pre }, handler.createTaxRule);
  app.get( '/org/tax-rules/:taxRuleId',   { preHandler: pre }, handler.getTaxRule);
  app.patch('/org/tax-rules/:taxRuleId',  { preHandler: pre }, handler.updateTaxRule);

  // â”€â”€ Tax rules (store-scoped) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  app.get(   '/stores/:storeId/tax-rules',             { preHandler: preStore }, handler.listStoreTaxRules);
  app.post(  '/stores/:storeId/tax-rules',             { preHandler: preStore }, handler.createStoreTaxRule);
  app.patch( '/stores/:storeId/tax-rules/:taxRuleId',  { preHandler: preStore }, handler.updateStoreTaxRule);
  app.delete('/stores/:storeId/tax-rules/:taxRuleId',  { preHandler: preStore }, handler.deleteStoreTaxRule);

  // â”€â”€ HSN codes (public lookup, auth required) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  app.get('/hsn/search',     { preHandler: pre }, handler.searchHsn);  // before /:code
  app.get('/hsn/:code',      { preHandler: pre }, handler.getHsnCode);

  // â”€â”€ Currencies â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  app.get('/currencies',     { preHandler: pre }, handler.listCurrencies);
}

