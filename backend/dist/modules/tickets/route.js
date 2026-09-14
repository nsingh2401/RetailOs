"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = ticketRoutes;
const auth_1 = require("../../middleware/auth");
const handler_1 = require("./handler");
async function ticketRoutes(app) {
    app.addHook('preHandler', auth_1.authMiddleware);
    app.get('/', handler_1.listTickets);
    app.post('/', handler_1.createTicket);
    app.post('/:ticketId/replies', handler_1.addReply);
}
//# sourceMappingURL=route.js.map