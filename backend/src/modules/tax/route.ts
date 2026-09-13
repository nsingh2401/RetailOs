import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middleware/auth';
import { storeMiddleware } from '../../middleware/store';
import { rateLimitMiddleware } from '../../middleware/rateLimit';
import * as handler from './handler';

const pre      = [rateLimitMiddleware, authMiddleware];
const preStore = [rateLimitMiddleware, authMiddleware, storeMiddleware];

export default async function taxRoutes(app: FastifyInstance) {
  // ── Tax rules (org-scoped, no storeMiddleware needed) ──────
  app.get( '/org/tax-rules',              { preHandler: pre }, handler.listTaxRules);
  app.post('/org/tax-rules',              { preHandler: pre }, handler.createTaxRule);
  app.get( '/org/tax-rules/:taxRuleId',   { preHandler: pre }, handler.getTaxRule);
  app.patch('/org/tax-rules/:taxRuleId',  { preHandler: pre }, handler.updateTaxRule);

  // ── Tax rules (store-scoped) ───────────────────────────────
  app.get(   '/stores/:storeId/tax-rules',             { preHandler: preStore }, handler.listStoreTaxRules);
  app.post(  '/stores/:storeId/tax-rules',             { preHandler: preStore }, handler.createStoreTaxRule);
  app.patch( '/stores/:storeId/tax-rules/:taxRuleId',  { preHandler: preStore }, handler.updateStoreTaxRule);
  app.delete('/stores/:storeId/tax-rules/:taxRuleId',  { preHandler: preStore }, handler.deleteStoreTaxRule);

  // ── HSN codes (public lookup, auth required) ───────────────
  app.get('/hsn/search',     { preHandler: pre }, handler.searchHsn);  // before /:code
  app.get('/hsn/:code',      { preHandler: pre }, handler.getHsnCode);

  // ── Currencies ─────────────────────────────────────────────
  app.get('/currencies',     { preHandler: pre }, handler.listCurrencies);
}
