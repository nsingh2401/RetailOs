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
exports.default = customerRoutes;
const auth_1 = require("../../middleware/auth");
const store_1 = require("../../middleware/store");
const rateLimit_1 = require("../../middleware/rateLimit");
const handler = __importStar(require("./handler"));
const pre = [rateLimit_1.rateLimitMiddleware, auth_1.authMiddleware, store_1.storeMiddleware];
async function customerRoutes(app) {
    // â”€â”€ IMPORTANT: specific routes registered BEFORE /:customerId â”€â”€
    app.get('/:storeId/customers', { preHandler: pre }, handler.listCustomers);
    app.post('/:storeId/customers', { preHandler: pre }, handler.createCustomer);
    // /search and /outstanding must be before /:customerId
    app.get('/:storeId/customers/search', { preHandler: pre }, handler.searchCustomers);
    app.get('/:storeId/customers/outstanding', { preHandler: pre }, handler.getOutstandingCustomers);
    app.get('/:storeId/customers/:customerId', { preHandler: pre }, handler.getCustomer);
    app.patch('/:storeId/customers/:customerId', { preHandler: pre }, handler.updateCustomer);
    app.get('/:storeId/customers/:customerId/ledger', { preHandler: pre }, handler.getCreditLedger);
    app.post('/:storeId/customers/:customerId/payment', { preHandler: pre }, handler.recordCreditPayment);
}
//# sourceMappingURL=route.js.map