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
exports.default = inventoryRoutes;
const auth_1 = require("../../middleware/auth");
const store_1 = require("../../middleware/store");
const rateLimit_1 = require("../../middleware/rateLimit");
const handler = __importStar(require("./handler"));
const pre = [rateLimit_1.rateLimitMiddleware, auth_1.authMiddleware, store_1.storeMiddleware];
async function inventoryRoutes(app) {
    // â”€â”€ IMPORTANT: specific routes registered BEFORE parameterized ones â”€â”€
    // Inventory â€” low-stock and adjust before /:variantId
    app.get('/:storeId/inventory/low-stock', { preHandler: pre }, handler.getLowStock);
    app.post('/:storeId/inventory/adjust', { preHandler: pre }, handler.adjustStock);
    app.get('/:storeId/inventory', { preHandler: pre }, handler.getStockLevels);
    app.get('/:storeId/inventory/:variantId', { preHandler: pre }, handler.getVariantStock);
    app.get('/:storeId/inventory/:variantId/movements', { preHandler: pre }, handler.getMovementHistory);
    // Purchases
    app.post('/:storeId/purchases/scan-bill', { preHandler: pre }, handler.scanVendorBill);
    app.post('/:storeId/purchases', { preHandler: pre }, handler.createPurchase);
    app.get('/:storeId/purchases', { preHandler: pre }, handler.getPurchaseHistory);
    app.get('/:storeId/purchases/:purchaseId', { preHandler: pre }, handler.getPurchaseDetail);
    // Batches â€” expiring before /:variantId
    app.get('/:storeId/batches/expiring', { preHandler: pre }, handler.getExpiringBatches);
    app.get('/:storeId/batches/:variantId', { preHandler: pre }, handler.getVariantBatches);
}
//# sourceMappingURL=route.js.map