"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = adminUserRoutes;
const adminAuth_1 = require("../../../middleware/adminAuth");
const handler_1 = require("./handler");
async function adminUserRoutes(app) {
    app.addHook('preHandler', adminAuth_1.adminAuthMiddleware);
    app.get('/', handler_1.listUsers);
    app.post('/', handler_1.createUser);
    app.patch('/:userId', handler_1.updateUser);
    app.post('/:userId/reset-password', handler_1.resetPassword);
    app.delete('/:userId', handler_1.deleteUser);
}
//# sourceMappingURL=route.js.map