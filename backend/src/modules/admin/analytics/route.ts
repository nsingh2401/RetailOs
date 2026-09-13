import { FastifyInstance } from 'fastify';
import { adminAuthMiddleware } from '../../../middleware/adminAuth';
import {
  getOverview,
  getRevenueSeries,
  getIndustryBreakdown,
  getTopOrgs,
} from './handler';

export default async function adminAnalyticsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', adminAuthMiddleware);

  app.get('/overview',           getOverview);
  app.get('/revenue',            getRevenueSeries);
  app.get('/industry-breakdown', getIndustryBreakdown);
  app.get('/top-orgs',           getTopOrgs);
}
