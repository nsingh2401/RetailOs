import { FastifyInstance } from 'fastify';
import { adminAuthMiddleware } from '../../../middleware/adminAuth';
import { loginAdmin, logoutAdmin, meAdmin } from './handler';

export default async function adminAuthRoutes(app: FastifyInstance) {
  app.post('/login',  loginAdmin);
  app.post('/logout', { preHandler: adminAuthMiddleware }, logoutAdmin);
  app.get('/me',      { preHandler: adminAuthMiddleware }, meAdmin);
}
