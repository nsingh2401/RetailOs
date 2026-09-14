"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = adminMasterRoutes;
const adminAuth_1 = require("../../../middleware/adminAuth");
const handler_1 = require("./handler");
async function adminMasterRoutes(app) {
    app.addHook('preHandler', adminAuth_1.adminAuthMiddleware);
    // Master categories CRUD
    // GET  /v1/admin/master/categories
    app.get('/categories', handler_1.listMasterCategories);
    // POST /v1/admin/master/categories
    app.post('/categories', handler_1.addMasterCategory);
    // DELETE /v1/admin/master/categories/:id
    // (registered after GET/POST to avoid Fastify treating
    //  'categories' param in a generic /:id route)
    app.delete('/categories/:id', handler_1.deleteMasterCategory);
    // Promotion candidates
    // GET /v1/admin/master/custom-categories?threshold=5
    app.get('/custom-categories', handler_1.listCustomCategoryPromotionCandidates);
    // Promote custom → master
    // POST /v1/admin/master/promote
    app.post('/promote', handler_1.promoteToMaster);
}
//# sourceMappingURL=route.js.map