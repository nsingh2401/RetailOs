"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = adminTicketRoutes;
const adminAuth_1 = require("../../../middleware/adminAuth");
const handler_1 = require("./handler");
async function adminTicketRoutes(app) {
    app.addHook('preHandler', adminAuth_1.adminAuthMiddleware);
    app.get('/', handler_1.listAdminTickets);
    app.get('/:ticketId', handler_1.getTicketDetail);
    app.patch('/:ticketId', handler_1.updateTicket);
    app.post('/:ticketId/replies', handler_1.addAdminReply);
}
//# sourceMappingURL=route.js.map