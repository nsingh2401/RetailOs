"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = adminAuthRoutes;
const adminAuth_1 = require("../../../middleware/adminAuth");
const handler_1 = require("./handler");
async function adminAuthRoutes(app) {
    app.post('/login', handler_1.loginAdmin);
    app.post('/logout', { preHandler: adminAuth_1.adminAuthMiddleware }, handler_1.logoutAdmin);
    app.get('/me', { preHandler: adminAuth_1.adminAuthMiddleware }, handler_1.meAdmin);
}
//# sourceMappingURL=route.js.map