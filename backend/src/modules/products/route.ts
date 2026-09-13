import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middleware/auth';
import { storeMiddleware } from '../../middleware/store';
import { rateLimitMiddleware } from '../../middleware/rateLimit';
import * as handler from './handler';

const pre = [rateLimitMiddleware, authMiddleware, storeMiddleware];

export default async function productRoutes(app: FastifyInstance) {
  // ── IMPORTANT: specific routes registered BEFORE parameterized ones ──

  // Search & barcode — must precede /:productId
  app.get( '/:storeId/products/search',                          { preHandler: pre }, handler.searchProducts);
  app.get( '/:storeId/products/barcode/:code',                   { preHandler: pre }, handler.lookupByBarcode);

  // Products
  app.get(    '/:storeId/products',                              { preHandler: pre }, handler.listProducts);
  app.post(   '/:storeId/products',                              { preHandler: pre }, handler.createProduct);
  app.get(    '/:storeId/products/:productId',                   { preHandler: pre }, handler.getProduct);
  app.patch(  '/:storeId/products/:productId',                   { preHandler: pre }, handler.updateProduct);
  app.delete( '/:storeId/products/:productId',                   { preHandler: pre }, handler.deleteProduct);

  // Variants
  app.post(  '/:storeId/products/:productId/variants',           { preHandler: pre }, handler.createVariant);
  app.patch( '/:storeId/products/:productId/variants/:variantId',{ preHandler: pre }, handler.updateVariant);

  // Categories
  app.get(    '/:storeId/categories',                              { preHandler: pre }, handler.listCategories);
  app.post(   '/:storeId/categories',                              { preHandler: pre }, handler.createCategory);
  app.patch(  '/:storeId/categories/:categoryId',                  { preHandler: pre }, handler.updateCategory);
  app.delete( '/:storeId/categories/:categoryId',                  { preHandler: pre }, handler.deleteCategory);

  // Brands
  app.get(  '/:storeId/brands',                                  { preHandler: pre }, handler.listBrands);
  app.post( '/:storeId/brands',                                  { preHandler: pre }, handler.createBrand);

  // Images
  app.post( '/:storeId/products/:productId/images',              { preHandler: pre }, handler.saveProductImage);
}
