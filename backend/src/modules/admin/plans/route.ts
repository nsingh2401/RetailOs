import { FastifyInstance } from 'fastify';
import { adminAuthMiddleware } from '../../../middleware/adminAuth';
import { listPlans, listPlanFeatures, createPlan, updatePlan, deletePlan } from './handler';

export default async function adminPlanRoutes(app: FastifyInstance) {
  app.addHook('preHandler', adminAuthMiddleware);

  app.get('/features',    listPlanFeatures);  // before /:planId
  app.get('/',            listPlans);
  app.post('/',           createPlan);
  app.patch('/:planId',   updatePlan);
  app.delete('/:planId',  deletePlan);
}
