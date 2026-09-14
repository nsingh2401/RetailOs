"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = adminRoleRoutes;
const adminAuth_1 = require("../../../middleware/adminAuth");
const handler_1 = require("./handler");
async function adminRoleRoutes(app) {
    app.addHook('preHandler', adminAuth_1.adminAuthMiddleware);
    app.get('/', handler_1.listRoles);
    app.post('/', handler_1.createRole);
    app.patch('/:roleId', handler_1.updateRole);
    app.delete('/:roleId', handler_1.deleteRole);
}
//# sourceMappingURL=route.js.map