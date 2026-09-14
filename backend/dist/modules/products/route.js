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
exports.default = productRoutes;
const auth_1 = require("../../middleware/auth");
const store_1 = require("../../middleware/store");
const rateLimit_1 = require("../../middleware/rateLimit");
const handler = __importStar(require("./handler"));
const pre = [rateLimit_1.rateLimitMiddleware, auth_1.authMiddleware, store_1.storeMiddleware];
async function productRoutes(app) {
    // â”€â”€ IMPORTANT: specific routes registered BEFORE parameterized ones â”€â”€
    // Search & barcode â€” must precede /:productId
    app.get('/:storeId/products/search', { preHandler: pre }, handler.searchProducts);
    app.get('/:storeId/products/barcode/:code', { preHandler: pre }, handler.lookupByBarcode);
    // Products
    app.get('/:storeId/products', { preHandler: pre }, handler.listProducts);
    app.post('/:storeId/products', { preHandler: pre }, handler.createProduct);
    app.get('/:storeId/products/:productId', { preHandler: pre }, handler.getProduct);
    app.patch('/:storeId/products/:productId', { preHandler: pre }, handler.updateProduct);
    app.delete('/:storeId/products/:productId', { preHandler: pre }, handler.deleteProduct);
    // Variants
    app.post('/:storeId/products/:productId/variants', { preHandler: pre }, handler.createVariant);
    app.patch('/:storeId/products/:productId/variants/:variantId', { preHandler: pre }, handler.updateVariant);
    // Categories
    app.get('/:storeId/categories', { preHandler: pre }, handler.listCategories);
    app.post('/:storeId/categories', { preHandler: pre }, handler.createCategory);
    app.patch('/:storeId/categories/:categoryId', { preHandler: pre }, handler.updateCategory);
    app.delete('/:storeId/categories/:categoryId', { preHandler: pre }, handler.deleteCategory);
    // Brands
    app.get('/:storeId/brands', { preHandler: pre }, handler.listBrands);
    app.post('/:storeId/brands', { preHandler: pre }, handler.createBrand);
    // Images
    app.post('/:storeId/products/:productId/images', { preHandler: pre }, handler.saveProductImage);
}
//# sourceMappingURL=route.js.map