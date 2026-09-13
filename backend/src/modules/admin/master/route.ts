import { FastifyInstance } from 'fastify';
import { adminAuthMiddleware } from '../../../middleware/adminAuth';
import {
  listMasterCategories,
  addMasterCategory,
  deleteMasterCategory,
  listCustomCategoryPromotionCandidates,
  promoteToMaster,
} from './handler';

export default async function adminMasterRoutes(
  app: FastifyInstance,
) {
  app.addHook('preHandler', adminAuthMiddleware);

  // Master categories CRUD
  // GET  /v1/admin/master/categories
  app.get('/categories', listMasterCategories);

  // POST /v1/admin/master/categories
  app.post('/categories', addMasterCategory);

  // DELETE /v1/admin/master/categories/:id
  // (registered after GET/POST to avoid Fastify treating
  //  'categories' param in a generic /:id route)
  app.delete('/categories/:id', deleteMasterCategory);

  // Promotion candidates
  // GET /v1/admin/master/custom-categories?threshold=5
  app.get('/custom-categories', listCustomCategoryPromotionCandidates);

  // Promote custom → master
  // POST /v1/admin/master/promote
  app.post('/promote', promoteToMaster);
}
