"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = adminAnalyticsRoutes;
const adminAuth_1 = require("../../../middleware/adminAuth");
const handler_1 = require("./handler");
async function adminAnalyticsRoutes(app) {
    app.addHook('preHandler', adminAuth_1.adminAuthMiddleware);
    app.get('/overview', handler_1.getOverview);
    app.get('/revenue', handler_1.getRevenueSeries);
    app.get('/industry-breakdown', handler_1.getIndustryBreakdown);
    app.get('/top-orgs', handler_1.getTopOrgs);
}
//# sourceMappingURL=route.js.map