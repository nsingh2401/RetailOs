import { FastifyInstance } from 'fastify';
import { adminAuthMiddleware } from '../../../middleware/adminAuth';
import { listRoles, createRole, updateRole, deleteRole } from './handler';

export default async function adminRoleRoutes(app: FastifyInstance) {
  app.addHook('preHandler', adminAuthMiddleware);

  app.get('/',            listRoles);
  app.post('/',           createRole);
  app.patch('/:roleId',   updateRole);
  app.delete('/:roleId',  deleteRole);
}
