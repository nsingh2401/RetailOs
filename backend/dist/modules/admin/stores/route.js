"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = adminStoreRoutes;
const adminAuth_1 = require("../../../middleware/adminAuth");
const handler_1 = require("./handler");
async function adminStoreRoutes(app) {
    app.addHook('preHandler', adminAuth_1.adminAuthMiddleware);
    app.get('/', handler_1.listStores);
    app.patch('/:storeId', handler_1.updateStore);
    app.delete('/:storeId', handler_1.deleteStore);
}
//# sourceMappingURL=route.js.map