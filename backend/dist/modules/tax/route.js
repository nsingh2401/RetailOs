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
exports.default = taxRoutes;
const auth_1 = require("../../middleware/auth");
const store_1 = require("../../middleware/store");
const rateLimit_1 = require("../../middleware/rateLimit");
const handler = __importStar(require("./handler"));
const pre = [rateLimit_1.rateLimitMiddleware, auth_1.authMiddleware];
const preStore = [rateLimit_1.rateLimitMiddleware, auth_1.authMiddleware, store_1.storeMiddleware];
async function taxRoutes(app) {
    // â”€â”€ Tax rules (org-scoped, no storeMiddleware needed) â”€â”€â”€â”€â”€â”€
    app.get('/org/tax-rules', { preHandler: pre }, handler.listTaxRules);
    app.post('/org/tax-rules', { preHandler: pre }, handler.createTaxRule);
    app.get('/org/tax-rules/:taxRuleId', { preHandler: pre }, handler.getTaxRule);
    app.patch('/org/tax-rules/:taxRuleId', { preHandler: pre }, handler.updateTaxRule);
    // â”€â”€ Tax rules (store-scoped) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    app.get('/stores/:storeId/tax-rules', { preHandler: preStore }, handler.listStoreTaxRules);
    app.post('/stores/:storeId/tax-rules', { preHandler: preStore }, handler.createStoreTaxRule);
    app.patch('/stores/:storeId/tax-rules/:taxRuleId', { preHandler: preStore }, handler.updateStoreTaxRule);
    app.delete('/stores/:storeId/tax-rules/:taxRuleId', { preHandler: preStore }, handler.deleteStoreTaxRule);
    // â”€â”€ HSN codes (public lookup, auth required) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    app.get('/hsn/search', { preHandler: pre }, handler.searchHsn); // before /:code
    app.get('/hsn/:code', { preHandler: pre }, handler.getHsnCode);
    // â”€â”€ Currencies â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    app.get('/currencies', { preHandler: pre }, handler.listCurrencies);
}
//# sourceMappingURL=route.js.map