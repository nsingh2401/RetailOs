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
exports.default = storeUserRoutes;
exports.myStoresRoute = myStoresRoute;
const auth_1 = require("../../middleware/auth");
const store_1 = require("../../middleware/store");
const rateLimit_1 = require("../../middleware/rateLimit");
const handler = __importStar(require("./handler"));
const preStore = [rateLimit_1.rateLimitMiddleware, auth_1.authMiddleware, store_1.storeMiddleware];
const preAuth = [rateLimit_1.rateLimitMiddleware, auth_1.authMiddleware];
// Registered under /v1/stores
async function storeUserRoutes(app) {
    app.post('/:storeId/users', { preHandler: preStore }, handler.createStoreUser);
    app.get('/:storeId/users', { preHandler: preStore }, handler.listStoreUsers);
    app.patch('/:storeId/users/:userId', { preHandler: preStore }, handler.updateStoreUser);
    app.delete('/:storeId/users/:userId', { preHandler: preStore }, handler.removeStoreUser);
}
// Registered under /v1/users
async function myStoresRoute(app) {
    app.get('/me/stores', { preHandler: preAuth }, handler.getMyStores);
    app.patch('/me', { preHandler: preAuth }, handler.updateMe);
    app.post('/me/avatar', { preHandler: preAuth }, handler.uploadAvatar);
}
//# sourceMappingURL=route.js.map