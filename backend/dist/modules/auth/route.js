"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = authRoutes;
exports.userRoutes = userRoutes;
exports.userManagementRoutes = userManagementRoutes;
exports.orgRoutes = orgRoutes;
exports.storeStaffRoutes = storeStaffRoutes;
const auth_1 = require("../../middleware/auth");
const rateLimit_1 = require("../../middleware/rateLimit");
const store_1 = require("../../middleware/store");
const handler = __importStar(require("./handler"));
// â”€â”€ /v1/auth/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function authRoutes(app) {
    app.post('/signup', { preHandler: [rateLimit_1.rateLimitMiddleware] }, handler.signup);
    app.post('/verify-token', { preHandler: [rateLimit_1.rateLimitMiddleware] }, handler.verifyToken);
    app.post('/login', { preHandler: [rateLimit_1.rateLimitMiddleware] }, handler.login);
    app.post('/set-password', { preHandler: [rateLimit_1.rateLimitMiddleware, auth_1.authMiddleware] }, handler.setPassword);
    app.post('/forgot-password', { preHandler: [rateLimit_1.rateLimitMiddleware] }, handler.forgotPassword);
    app.post('/reset-password', { preHandler: [rateLimit_1.rateLimitMiddleware] }, handler.resetPassword);
    app.post('/refresh', { preHandler: [rateLimit_1.rateLimitMiddleware] }, async (_req, reply) => {
        return reply.status(501).send({
            success: false,
            error: { code: 'NOT_IMPLEMENTED', message: 'Token refresh not yet implemented', statusCode: 501 },
        });
    });
    app.get('/me', { preHandler: [rateLimit_1.rateLimitMiddleware, auth_1.authMiddleware] }, handler.getMe);
    app.post('/logout', { preHandler: [rateLimit_1.rateLimitMiddleware, auth_1.authMiddleware] }, handler.logout);
    app.post('/refresh-dev-token', handler.refreshDevToken);
}
// â”€â”€ /v1/users/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function userRoutes(app) {
    app.post('/invite', { preHandler: [rateLimit_1.rateLimitMiddleware, auth_1.authMiddleware] }, handler.inviteUser);
}
// â”€â”€ /v1/users/* (management) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function userManagementRoutes(app) {
    app.get('/', { preHandler: [rateLimit_1.rateLimitMiddleware, auth_1.authMiddleware] }, handler.listUsers);
    app.patch('/:userId', { preHandler: [rateLimit_1.rateLimitMiddleware, auth_1.authMiddleware] }, handler.updateUser);
    app.patch('/:userId/deactivate', { preHandler: [rateLimit_1.rateLimitMiddleware, auth_1.authMiddleware] }, handler.deactivateUser);
}
// â”€â”€ /v1/org/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function orgRoutes(app) {
    app.get('/', { preHandler: [rateLimit_1.rateLimitMiddleware, auth_1.authMiddleware] }, handler.getOrgDetails);
    app.patch('/settings', { preHandler: [rateLimit_1.rateLimitMiddleware, auth_1.authMiddleware] }, handler.updateOrgSettings);
    app.get('/stores', { preHandler: [rateLimit_1.rateLimitMiddleware, auth_1.authMiddleware] }, handler.listOrgStores);
    app.post('/stores', { preHandler: [rateLimit_1.rateLimitMiddleware, auth_1.authMiddleware] }, handler.createStore);
    app.patch('/stores/:storeId', { preHandler: [rateLimit_1.rateLimitMiddleware, auth_1.authMiddleware, store_1.storeMiddleware] }, handler.updateStore);
}
// â”€â”€ /v1/stores/:storeId/staff routes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function storeStaffRoutes(app) {
    app.get('/:storeId/staff', { preHandler: [rateLimit_1.rateLimitMiddleware, auth_1.authMiddleware, store_1.storeMiddleware] }, handler.getStoreStaff);
    app.post('/:storeId/staff', { preHandler: [rateLimit_1.rateLimitMiddleware, auth_1.authMiddleware, store_1.storeMiddleware] }, handler.assignStoreRole);
    app.patch('/:storeId/staff/:userId', { preHandler: [rateLimit_1.rateLimitMiddleware, auth_1.authMiddleware, store_1.storeMiddleware] }, handler.updateStoreRole);
    app.delete('/:storeId/staff/:userId', { preHandler: [rateLimit_1.rateLimitMiddleware, auth_1.authMiddleware, store_1.storeMiddleware] }, handler.removeStoreRole);
}
//# sourceMappingURL=route.js.map