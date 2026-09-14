"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rateLimitMiddleware = rateLimitMiddleware;
const redis_1 = require("../lib/redis");
const STANDARD_MAX = parseInt(process.env.RATE_LIMIT_STANDARD ?? '200', 10);
const SYNC_MAX = parseInt(process.env.RATE_LIMIT_SYNC ?? '600', 10);
const WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? '60000', 10);
const SYNC_PATHS = ['/v1/sync/push', '/v1/sync/pull'];
async function rateLimitMiddleware(request, reply) {
    const deviceId = request.headers['x-device-id'] ?? request.ip;
    const isSync = SYNC_PATHS.some(p => request.url.startsWith(p));
    const maxReq = isSync ? SYNC_MAX : STANDARD_MAX;
    const allowed = await (0, redis_1.checkRateLimit)(deviceId, maxReq, WINDOW_MS);
    if (!allowed) {
        return reply.status(429).send({
            success: false,
            error: { code: 'RATE_LIMITED', message: 'Too many requests. Please slow down.', statusCode: 429 },
        });
    }
}
//# sourceMappingURL=rateLimit.js.map