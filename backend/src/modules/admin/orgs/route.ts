import { FastifyInstance } from 'fastify';
import { adminAuthMiddleware } from '../../../middleware/adminAuth';
import { listOrgs, getOrg, createOrg, updateOrg, resetStoreUserPassword } from './handler';
import { addStoreToOrg } from '../stores/handler';

export default async function adminOrgRoutes(app: FastifyInstance) {
  app.addHook('preHandler', adminAuthMiddleware);

  app.get('/',                    listOrgs);
  app.get('/:orgId',              getOrg);
  app.post('/',                   createOrg);
  app.patch('/:orgId',            updateOrg);
  app.post('/:orgId/stores',                            addStoreToOrg);
  app.post('/:orgId/users/:userId/reset-password',      resetStoreUserPassword);
}
