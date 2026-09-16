"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = adminOrgRoutes;
const adminAuth_1 = require("../../../middleware/adminAuth");
const handler_1 = require("./handler");
const handler_2 = require("../stores/handler");
async function adminOrgRoutes(app) {
    app.addHook('preHandler', adminAuth_1.adminAuthMiddleware);
    app.get('/', handler_1.listOrgs);
    app.get('/:orgId', handler_1.getOrg);
    app.post('/', handler_1.createOrg);
    app.patch('/:orgId', handler_1.updateOrg);
    app.post('/:orgId/stores', handler_2.addStoreToOrg);
    app.post('/:orgId/users/:userId/reset-password', handler_1.resetStoreUserPassword);
}
//# sourceMappingURL=route.js.map