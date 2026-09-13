import { FastifyInstance } from 'fastify';
import { adminAuthMiddleware } from '../../../middleware/adminAuth';
import { listUsers, createUser, updateUser, resetPassword, deleteUser } from './handler';

export default async function adminUserRoutes(app: FastifyInstance) {
  app.addHook('preHandler', adminAuthMiddleware);

  app.get('/',                          listUsers);
  app.post('/',                         createUser);
  app.patch('/:userId',                 updateUser);
  app.post('/:userId/reset-password',   resetPassword);
  app.delete('/:userId',                deleteUser);
}
