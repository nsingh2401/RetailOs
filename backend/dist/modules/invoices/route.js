"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = invoiceRoutes;
const auth_1 = require("../../middleware/auth");
const store_1 = require("../../middleware/store");
const rateLimit_1 = require("../../middleware/rateLimit");
const handler = __importStar(require("./handler"));
const pre = [rateLimit_1.rateLimitMiddleware, auth_1.authMiddleware, store_1.storeMiddleware];
async function invoiceRoutes(app) {
    app.post('/:storeId/invoices', { preHandler: [...pre] }, handler.createInvoice);
    app.get('/:storeId/invoices', { preHandler: [...pre, (0, store_1.requireRole)('OWNER', 'MANAGER')] }, handler.listInvoices);
    app.get('/:storeId/invoices/:invoiceId', { preHandler: [...pre] }, handler.getInvoice);
    app.post('/:storeId/invoices/:invoiceId/confirm', { preHandler: [...pre] }, handler.confirmInvoice);
    app.post('/:storeId/invoices/:invoiceId/payments', { preHandler: [...pre] }, handler.recordPayment);
    app.post('/:storeId/invoices/:invoiceId/cancel', { preHandler: [...pre, (0, store_1.requireRole)('OWNER', 'MANAGER')] }, handler.cancelInvoice);
}
//# sourceMappingURL=route.js.map