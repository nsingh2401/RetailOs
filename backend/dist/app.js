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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildApp = buildApp;
const fastify_1 = __importDefault(require("fastify"));
const cors_1 = __importDefault(require("@fastify/cors"));
const helmet_1 = __importDefault(require("@fastify/helmet"));
const multipart_1 = __importDefault(require("@fastify/multipart"));
const static_1 = __importDefault(require("@fastify/static"));
const swagger_1 = __importDefault(require("@fastify/swagger"));
const websocket_1 = __importDefault(require("@fastify/websocket"));
const path_1 = __importDefault(require("path"));
const logger_1 = require("./lib/logger");
// Route modules
const route_1 = __importStar(require("./modules/auth/route"));
const route_2 = __importDefault(require("./modules/products/route"));
const route_3 = __importDefault(require("./modules/inventory/route"));
const route_4 = __importDefault(require("./modules/invoices/route"));
const route_5 = __importDefault(require("./modules/customers/route"));
const route_6 = __importDefault(require("./modules/sync/route"));
const route_7 = __importDefault(require("./modules/reports/route"));
const route_8 = __importDefault(require("./modules/tax/route"));
const route_9 = __importDefault(require("./modules/uploads/route"));
const handler_1 = __importDefault(require("./modules/websocket/handler"));
const route_10 = __importDefault(require("./modules/master/route"));
const route_11 = __importDefault(require("./modules/stores/route"));
const route_12 = __importDefault(require("./modules/jewelry/route"));
const route_13 = __importStar(require("./modules/users/route"));
const route_14 = __importDefault(require("./modules/admin/auth/route"));
const route_15 = __importDefault(require("./modules/admin/orgs/route"));
const route_16 = __importDefault(require("./modules/admin/stores/route"));
const route_17 = __importDefault(require("./modules/admin/plans/route"));
const route_18 = __importDefault(require("./modules/admin/users/route"));
const route_19 = __importDefault(require("./modules/admin/roles/route"));
const route_20 = __importDefault(require("./modules/admin/analytics/route"));
const route_21 = __importDefault(require("./modules/admin/tickets/route"));
const route_22 = __importDefault(require("./modules/admin/master/route"));
const route_23 = __importDefault(require("./modules/tickets/route"));
const route_24 = __importDefault(require("./modules/ai/route"));
const route_25 = __importDefault(require("./modules/chat/route"));
async function buildApp() {
    const app = (0, fastify_1.default)({ logger: logger_1.logger });
    // ── File uploads & static serving ─────────────────────────
    const uploadDir = path_1.default.resolve(process.env.UPLOAD_DIR ?? path_1.default.join(process.cwd(), 'uploads'));
    await app.register(multipart_1.default, {
        limits: { fileSize: 5 * 1024 * 1024 },
    });
    await app.register(static_1.default, {
        root: uploadDir,
        prefix: '/uploads/',
    });
    // ── Security & CORS ────────────────────────────────────────
    await app.register(helmet_1.default, { contentSecurityPolicy: false });
    await app.register(cors_1.default, {
        origin: process.env.NODE_ENV === 'production'
            ? (process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map(o => o.trim()) : /biznyss\.com$/)
            : true,
        credentials: true,
    });
    // ── WebSocket support ──────────────────────────────────────
    await app.register(websocket_1.default);
    // ── Swagger API docs ──────────────────────────────────────
    if (process.env.NODE_ENV !== 'production') {
        await app.register(swagger_1.default, {
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
    await app.register(route_1.default, { prefix: '/v1/auth' });
    await app.register(route_1.userRoutes, { prefix: '/v1/users' });
    await app.register(route_1.userManagementRoutes, { prefix: '/v1/users' });
    await app.register(route_1.storeStaffRoutes, { prefix: '/v1/stores' });
    await app.register(route_1.orgRoutes, { prefix: '/v1/org' });
    await app.register(route_8.default, { prefix: '/v1' }); // /v1/org/tax-rules, /v1/hsn, /v1/currencies
    await app.register(route_2.default, { prefix: '/v1/stores' }); // /v1/stores/:storeId/products
    await app.register(route_3.default, { prefix: '/v1/stores' }); // /v1/stores/:storeId/inventory
    await app.register(route_4.default, { prefix: '/v1/stores' }); // /v1/stores/:storeId/invoices
    await app.register(route_5.default, { prefix: '/v1/stores' }); // /v1/stores/:storeId/customers
    await app.register(route_6.default, { prefix: '/v1' }); // /v1/sync/push, /v1/sync/pull, /v1/devices
    await app.register(route_7.default, { prefix: '/v1/stores' }); // /v1/stores/:storeId/reports
    await app.register(route_9.default, { prefix: '/v1/stores' }); // /v1/stores/:storeId/upload
    await app.register(route_10.default, { prefix: '/v1/master-data' });
    await app.register(route_11.default, { prefix: '/v1/stores' });
    await app.register(route_12.default, { prefix: '/v1/stores' });
    await app.register(route_13.default, { prefix: '/v1/stores' });
    await app.register(route_13.myStoresRoute, { prefix: '/v1/users' });
    await app.register(route_14.default, { prefix: '/v1/admin/auth' });
    await app.register(route_15.default, { prefix: '/v1/admin/orgs' });
    await app.register(route_16.default, { prefix: '/v1/admin/stores' });
    await app.register(route_17.default, { prefix: '/v1/admin/plans' });
    await app.register(route_18.default, { prefix: '/v1/admin/users' });
    await app.register(route_19.default, { prefix: '/v1/admin/roles' });
    await app.register(route_20.default, { prefix: '/v1/admin/analytics' });
    await app.register(route_21.default, { prefix: '/v1/admin/tickets' });
    await app.register(route_22.default, { prefix: '/v1/admin/master' });
    await app.register(route_23.default, { prefix: '/v1/tickets' });
    await app.register(route_24.default, { prefix: '/v1/ai' });
    await app.register(route_25.default, { prefix: '/v1/stores' });
    // ── WebSocket ─────────────────────────────────────────────
    app.get('/v1/ws', { websocket: true }, handler_1.default);
    // ── Global error handler ──────────────────────────────────
    app.setErrorHandler((error, request, reply) => {
        app.log.error(error);
        const statusCode = error.statusCode ?? 500;
        reply.status(statusCode).send({
            success: false,
            error: {
                code: error.code ?? 'INTERNAL_ERROR',
                message: statusCode === 500 ? 'Internal server error' : error.message,
                statusCode,
            },
        });
    });
    return app;
}
//# sourceMappingURL=app.js.map