import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authMiddleware } from '../../middleware/auth';
import { rateLimitMiddleware } from '../../middleware/rateLimit';
import { storeMiddleware } from '../../middleware/store';
import * as handler from './handler';

// ── /v1/auth/* ────────────────────────────────────────────────
export default async function authRoutes(app: FastifyInstance) {
  app.post('/signup',
    { preHandler: [rateLimitMiddleware] },
    handler.signup,
  );

  app.post('/verify-token',
    { preHandler: [rateLimitMiddleware] },
    handler.verifyToken,
  );

  app.post('/login',
    { preHandler: [rateLimitMiddleware] },
    handler.login,
  );

  app.post('/set-password',
    { preHandler: [rateLimitMiddleware, authMiddleware] },
    handler.setPassword,
  );

  app.post('/forgot-password',
    { preHandler: [rateLimitMiddleware] },
    handler.forgotPassword,
  );

  app.post('/reset-password',
    { preHandler: [rateLimitMiddleware] },
    handler.resetPassword,
  );

  app.post('/refresh',
    { preHandler: [rateLimitMiddleware] },
    async (_req: FastifyRequest, reply: FastifyReply) => {
      return reply.status(501).send({
        success: false,
        error: { code: 'NOT_IMPLEMENTED', message: 'Token refresh not yet implemented', statusCode: 501 },
      });
    },
  );

  app.get('/me',
    { preHandler: [rateLimitMiddleware, authMiddleware] },
    handler.getMe,
  );

  app.post('/logout',
    { preHandler: [rateLimitMiddleware, authMiddleware] },
    handler.logout,
  );

  app.post('/refresh-dev-token',
    handler.refreshDevToken);
}

// ── /v1/users/* ───────────────────────────────────────────────
export async function userRoutes(app: FastifyInstance) {
  app.post('/invite',
    { preHandler: [rateLimitMiddleware, authMiddleware] },
    handler.inviteUser,
  );
}

// ── /v1/users/* (management) ──────────────────────────────────
export async function userManagementRoutes(app: FastifyInstance) {
  app.get('/',
    { preHandler: [rateLimitMiddleware, authMiddleware] },
    handler.listUsers,
  );

  app.patch('/:userId',
    { preHandler: [rateLimitMiddleware, authMiddleware] },
    handler.updateUser,
  );

  app.patch('/:userId/deactivate',
    { preHandler: [rateLimitMiddleware, authMiddleware] },
    handler.deactivateUser,
  );
}

// ── /v1/org/* ─────────────────────────────────────────────────
export async function orgRoutes(app: FastifyInstance) {
  app.get('/',
    { preHandler: [rateLimitMiddleware, authMiddleware] },
    handler.getOrgDetails,
  );

  app.patch('/settings',
    { preHandler: [rateLimitMiddleware, authMiddleware] },
    handler.updateOrgSettings,
  );

  app.get('/stores',
    { preHandler: [rateLimitMiddleware, authMiddleware] },
    handler.listOrgStores,
  );

  app.post('/stores',
    { preHandler: [rateLimitMiddleware, authMiddleware] },
    handler.createStore,
  );

  app.patch('/stores/:storeId',
    { preHandler: [rateLimitMiddleware, authMiddleware, storeMiddleware] },
    handler.updateStore,
  );
}

// ── /v1/stores/:storeId/staff routes ─────────────────────────
export async function storeStaffRoutes(app: FastifyInstance) {
  app.get('/:storeId/staff',
    { preHandler: [rateLimitMiddleware, authMiddleware, storeMiddleware] },
    handler.getStoreStaff,
  );

  app.post('/:storeId/staff',
    { preHandler: [rateLimitMiddleware, authMiddleware, storeMiddleware] },
    handler.assignStoreRole,
  );

  app.patch('/:storeId/staff/:userId',
    { preHandler: [rateLimitMiddleware, authMiddleware, storeMiddleware] },
    handler.updateStoreRole,
  );

  app.delete('/:storeId/staff/:userId',
    { preHandler: [rateLimitMiddleware, authMiddleware, storeMiddleware] },
    handler.removeStoreRole,
  );
}
