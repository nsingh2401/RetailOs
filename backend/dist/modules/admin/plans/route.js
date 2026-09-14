"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = adminPlanRoutes;
const adminAuth_1 = require("../../../middleware/adminAuth");
const handler_1 = require("./handler");
async function adminPlanRoutes(app) {
    app.addHook('preHandler', adminAuth_1.adminAuthMiddleware);
    app.get('/features', handler_1.listPlanFeatures); // before /:planId
    app.get('/', handler_1.listPlans);
    app.post('/', handler_1.createPlan);
    app.patch('/:planId', handler_1.updatePlan);
    app.delete('/:planId', handler_1.deletePlan);
}
//# sourceMappingURL=route.js.map