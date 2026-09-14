"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminAuthMiddleware = adminAuthMiddleware;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const redis_1 = require("../lib/redis");
const JWT_SECRET = process.env.ADMIN_JWT_SECRET ?? 'change-me-in-production';
async function adminAuthMiddleware(request, reply) {
    const authHeader = request.headers['authorization'];
    if (!authHeader?.startsWith('Bearer ')) {
        return reply.status(401).send({
            success: false,
            error: { code: 'UNAUTHORIZED', message: 'Missing authorization header', statusCode: 401 },
        });
    }
    const token = authHeader.slice(7);
    let payload;
    try {
        payload = jsonwebtoken_1.default.verify(token, JWT_SECRET);
    }
    catch {
        return reply.status(401).send({
            success: false,
            error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token', statusCode: 401 },
        });
    }
    if (payload.jti) {
        const blacklisted = await (0, redis_1.cacheGet)(`admin_blacklist:${payload.jti}`);
        if (blacklisted) {
            return reply.status(401).send({
                success: false,
                error: { code: 'UNAUTHORIZED', message: 'Token has been revoked', statusCode: 401 },
            });
        }
    }
    request.platformUser = payload;
}
//# sourceMappingURL=adminAuth.js.map