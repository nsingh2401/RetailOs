"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.bullmqConnection = exports.redis = void 0;
exports.setSession = setSession;
exports.getSession = getSession;
exports.deleteSession = deleteSession;
exports.cacheSet = cacheSet;
exports.cacheGet = cacheGet;
exports.cacheDelete = cacheDelete;
exports.checkRateLimit = checkRateLimit;
exports.connectRedis = connectRedis;
const ioredis_1 = __importDefault(require("ioredis"));
exports.redis = new ioredis_1.default(process.env.REDIS_URL, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: false,
});
// Separate connection for BullMQ — requires maxRetriesPerRequest: null
// for blocking worker commands (BRPOP etc.)
exports.bullmqConnection = new ioredis_1.default(process.env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
});
exports.redis.on('error', (err) => console.error('Redis error:', err));
// ── Session helpers ───────────────────────────────────────────
async function setSession(token, userId, ttlSeconds = 604800) {
    await exports.redis.setex(`session:${token}`, ttlSeconds, userId);
}
async function getSession(token) {
    return exports.redis.get(`session:${token}`);
}
async function deleteSession(token) {
    await exports.redis.del(`session:${token}`);
}
// ── Cache helpers ─────────────────────────────────────────────
async function cacheSet(key, value, ttlSeconds) {
    await exports.redis.setex(key, ttlSeconds, JSON.stringify(value));
}
async function cacheGet(key) {
    const raw = await exports.redis.get(key);
    return raw ? JSON.parse(raw) : null;
}
async function cacheDelete(key) {
    await exports.redis.del(key);
}
// ── Rate limit helpers ────────────────────────────────────────
async function checkRateLimit(deviceId, maxRequests, windowMs) {
    const key = `ratelimit:${deviceId}`;
    const count = await exports.redis.incr(key);
    if (count === 1)
        await exports.redis.pexpire(key, windowMs);
    return count <= maxRequests;
}
async function connectRedis() {
    await exports.redis.ping();
    console.log('Redis connected');
}
//# sourceMappingURL=redis.js.map