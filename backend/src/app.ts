import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import staticFiles from '@fastify/static';
import swagger from '@fastify/swagger';
import websocket from '@fastify/websocket';
import path from 'path';
import { logger } from './lib/logger';

// Route modules
import authRoutes, { userRoutes, storeStaffRoutes, userManagementRoutes, orgRoutes } from './modules/auth/route';
import productRoutes from './modules/products/route';
import inventoryRoutes from './modules/inventory/route';
import invoiceRoutes from './modules/invoices/route';
import customerRoutes from './modules/customers/route';
import syncRoutes from './modules/sync/route';
import reportRoutes from './modules/reports/route';
import taxRoutes from './modules/tax/route';
import uploadRoutes from './modules/uploads/route';
import wsHandler from './modules/websocket/handler';
import masterRoutes from './modules/master/route';
import storeRoutes from './modules/stores/route';
import jewelryRoutes from './modules/jewelry/route';
import storeUserRoutes, { myStoresRoute } from './modules/users/route';
import adminAuthRoutes   from './modules/admin/auth/route';
import adminOrgRoutes    from './modules/admin/orgs/route';
import adminStoreRoutes  from './modules/admin/stores/route';
import adminPlanRoutes   from './modules/admin/plans/route';
import adminUserRoutes      from './modules/admin/users/route';
import adminRoleRoutes      from './modules/admin/roles/route';
import adminAnalyticsRoutes from './modules/admin/analytics/route';
import adminTicketRoutes   from './modules/admin/tickets/route';
import adminMasterRoutes   from './modules/admin/master/route';
import ticketRoutes        from './modules/tickets/route';
import aiRoutes            from './modules/ai/route';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: logger as any });

  // ── File uploads & static serving ─────────────────────────
  const uploadDir = path.resolve(
    process.env.UPLOAD_DIR ?? path.join(process.cwd(), 'uploads'),
  );
  await app.register(multipart, {
    limits: { fileSize: 5 * 1024 * 1024 },
  });
  await app.register(staticFiles, {
    root:   uploadDir,
    prefix: '/uploads/',
  });

  // ── Security & CORS ────────────────────────────────────────
  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, {
    origin: process.env.NODE_ENV === 'production' ? /yourdomain\.com$/ : true,
    credentials: true,
  });

  // ── WebSocket support ──────────────────────────────────────
  await app.register(websocket);

  // ── Swagger API docs ──────────────────────────────────────
  if (process.env.NODE_ENV !== 'production') {
    await app.register(swagger, {
      openapi: {
        info: { title: 'Mobile POS API', version: '1.0.0' },
        components: {
          securitySchemes: {
            bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
          },
        },
      },
    });
  }

  // ── Health check (no auth) ─────────────────────────────────
  app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  // ── Versioned API routes ───────────────────────────────────
  await app.register(authRoutes,            { prefix: '/v1/auth' });
  await app.register(userRoutes,            { prefix: '/v1/users' });
  await app.register(userManagementRoutes,  { prefix: '/v1/users' });
  await app.register(storeStaffRoutes,      { prefix: '/v1/stores' });
  await app.register(orgRoutes,             { prefix: '/v1/org' });
  await app.register(taxRoutes,        { prefix: '/v1' });           // /v1/org/tax-rules, /v1/hsn, /v1/currencies
  await app.register(productRoutes,   { prefix: '/v1/stores' });    // /v1/stores/:storeId/products
  await app.register(inventoryRoutes, { prefix: '/v1/stores' });    // /v1/stores/:storeId/inventory
  await app.register(invoiceRoutes,   { prefix: '/v1/stores' });    // /v1/stores/:storeId/invoices
  await app.register(customerRoutes,  { prefix: '/v1/stores' });    // /v1/stores/:storeId/customers
  await app.register(syncRoutes,      { prefix: '/v1' });           // /v1/sync/push, /v1/sync/pull, /v1/devices
  await app.register(reportRoutes,    { prefix: '/v1/stores' });    // /v1/stores/:storeId/reports
  await app.register(uploadRoutes,    { prefix: '/v1/stores' });    // /v1/stores/:storeId/upload

  await app.register(masterRoutes,
    { prefix: '/v1/master-data' });
  await app.register(storeRoutes,
    { prefix: '/v1/stores' });
  await app.register(jewelryRoutes,
    { prefix: '/v1/stores' });
  await app.register(storeUserRoutes, { prefix: '/v1/stores' });
  await app.register(myStoresRoute,   { prefix: '/v1/users' });
  await app.register(adminAuthRoutes,  { prefix: '/v1/admin/auth'   });
  await app.register(adminOrgRoutes,   { prefix: '/v1/admin/orgs'   });
  await app.register(adminStoreRoutes, { prefix: '/v1/admin/stores' });
  await app.register(adminPlanRoutes,  { prefix: '/v1/admin/plans'  });
  await app.register(adminUserRoutes,      { prefix: '/v1/admin/users'     });
  await app.register(adminRoleRoutes,      { prefix: '/v1/admin/roles'     });
  await app.register(adminAnalyticsRoutes, { prefix: '/v1/admin/analytics' });
  await app.register(adminTicketRoutes,    { prefix: '/v1/admin/tickets'   });
  await app.register(adminMasterRoutes,    { prefix: '/v1/admin/master'    });
  await app.register(ticketRoutes,         { prefix: '/v1/tickets'         });
  await app.register(aiRoutes,             { prefix: '/v1/ai'              });

  // ── WebSocket ─────────────────────────────────────────────
  app.get('/v1/ws', { websocket: true }, wsHandler as any);

  // ── Global error handler ──────────────────────────────────
  app.setErrorHandler((error, request, reply) => {
    app.log.error(error);
    const statusCode = error.statusCode ?? 500;
    reply.status(statusCode).send({
      success: false,
      error: {
        code: (error as any).code ?? 'INTERNAL_ERROR',
        message: statusCode === 500 ? 'Internal server error' : error.message,
        statusCode,
      },
    });
  });

  return app as any;
}
