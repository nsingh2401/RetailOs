import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middleware/auth';
import * as handler from './handler';

// Registered at prefix /v1/ai in app.ts
export default async function aiRoutes(app: FastifyInstance) {
  // POST /v1/ai/identify-product
  // Auth required; no store middleware (store-agnostic endpoint)
  app.post('/identify-product', { preHandler: [authMiddleware] }, handler.identifyProduct);
}
