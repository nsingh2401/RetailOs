import { FastifyInstance } from 'fastify';
import { adminAuthMiddleware } from '../../../middleware/adminAuth';
import {
  listMasterCategories,
  addMasterCategory,
  deleteMasterCategory,
  listCustomCategoryPromotionCandidates,
  promoteToMaster,
  listMasterBrands,
  createMasterBrand,
  updateMasterBrand,
  deleteMasterBrand,
  listBrandPromotionCandidates,
  promoteBrandToMaster,
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

  // Brands — store-created + promote BEFORE /:id to avoid param conflict
  // GET  /v1/admin/master/brands/store-created?threshold=5
  app.get('/brands/store-created', listBrandPromotionCandidates);

  // POST /v1/admin/master/brands/promote
  app.post('/brands/promote', promoteBrandToMaster);

  // GET  /v1/admin/master/brands?search=&industry=
  app.get('/brands', listMasterBrands);

  // POST /v1/admin/master/brands
  app.post('/brands', createMasterBrand);

  // PATCH /v1/admin/master/brands/:id
  app.patch('/brands/:id', updateMasterBrand);

  // DELETE /v1/admin/master/brands/:id
  app.delete('/brands/:id', deleteMasterBrand);
}
