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
exports.default = reportRoutes;
const auth_1 = require("../../middleware/auth");
const store_1 = require("../../middleware/store");
const rateLimit_1 = require("../../middleware/rateLimit");
const handler = __importStar(require("./handler"));
const pre = [rateLimit_1.rateLimitMiddleware, auth_1.authMiddleware, store_1.storeMiddleware];
async function reportRoutes(app) {
    app.get('/:storeId/reports/sales-summary', { preHandler: pre }, handler.getSalesSummary);
    app.get('/:storeId/reports/top-products', { preHandler: pre }, handler.getTopProducts);
    app.get('/:storeId/reports/slow-movers', { preHandler: pre }, handler.getSlowMovers);
    app.get('/:storeId/reports/tax-summary', { preHandler: pre }, handler.getTaxSummary);
    app.get('/:storeId/reports/credit-aging', { preHandler: pre }, handler.getCreditAging);
    app.get('/:storeId/reports/purchase-summary', { preHandler: pre }, handler.getPurchaseSummary);
    app.get('/:storeId/reports/payment-modes', { preHandler: pre }, handler.getPaymentModes);
    app.get('/:storeId/reports/gstr1', { preHandler: pre }, handler.getGstr1);
    app.get('/:storeId/reports/gstr3b', { preHandler: pre }, handler.getGstr3b);
    app.get('/:storeId/reports/export', { preHandler: pre }, handler.exportReport);
    app.get('/:storeId/reports/tally-export', { preHandler: pre }, handler.getTallyExport);
}
//# sourceMappingURL=route.js.map