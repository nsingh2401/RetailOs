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
exports.default = chatRoutes;
const auth_1 = require("../../middleware/auth");
const store_1 = require("../../middleware/store");
const handler = __importStar(require("./handler"));
// Registered at prefix /v1/stores in app.ts
// → POST /v1/stores/:storeId/chat
// → GET  /v1/stores/:storeId/chat/history
// → GET  /v1/stores/:storeId/chat/exports/:filename  (Excel file download)
async function chatRoutes(app) {
    const pre = [auth_1.authMiddleware, store_1.storeMiddleware];
    app.post('/:storeId/chat', { preHandler: pre }, handler.chat);
    app.get('/:storeId/chat/history', { preHandler: pre }, handler.getChatHistory);
    // Excel export download — auth required so strangers can't pull other stores' files
    app.get('/:storeId/chat/exports/:filename', { preHandler: pre }, handler.getExcelExport);
}
//# sourceMappingURL=route.js.map