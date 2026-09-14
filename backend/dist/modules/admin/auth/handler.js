"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loginAdmin = loginAdmin;
exports.logoutAdmin = logoutAdmin;
exports.meAdmin = meAdmin;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma_1 = require("../../../lib/prisma");
const redis_1 = require("../../../lib/redis");
const JWT_SECRET = process.env.ADMIN_JWT_SECRET ?? 'change-me-in-production';
const JWT_EXPIRY = 24 * 60 * 60; // 24 h in seconds
function mergePermissions(userRoles) {
    const set = new Set();
    for (const ur of userRoles) {
        const perms = ur.role.permissions;
        for (const [key, val] of Object.entries(perms)) {
            if (val)
                set.add(key);
        }
    }
    return Array.from(set);
}
// ── POST /v1/admin/auth/login ─────────────────────────────────
async function loginAdmin(request, reply) {
    const { email, password } = request.body ?? {};
    if (!email || !password) {
        return reply.status(400).send({
            success: false,
            error: { code: 'MISSING_FIELDS', message: 'Email and password required', statusCode: 400 },
        });
    }
    const user = await prisma_1.prisma.platformUser.findUnique({
        where: { email: email.toLowerCase().trim() },
        include: {
            userRoles: {
                where: { role: { isActive: true } },
                include: { role: { select: { permissions: true } } },
            },
        },
    });
    if (!user || !user.isActive) {
        return reply.status(401).send({
            success: false,
            error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password', statusCode: 401 },
        });
    }
    const valid = await bcryptjs_1.default.compare(password, user.passwordHash);
    if (!valid) {
        return reply.status(401).send({
            success: false,
            error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password', statusCode: 401 },
        });
    }
    const permissions = mergePermissions(user.userRoles);
    const jti = crypto.randomUUID();
    const token = jsonwebtoken_1.default.sign({ platformUserId: user.id, email: user.email, permissions, jti }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
    return reply.send({
        success: true,
        data: {
            token,
            user: { id: user.id, email: user.email, name: user.name, permissions },
        },
    });
}
// ── POST /v1/admin/auth/logout ────────────────────────────────
async function logoutAdmin(request, reply) {
    const p = request.platformUser;
    if (p?.jti) {
        const remaining = p.exp - Math.floor(Date.now() / 1000);
        if (remaining > 0) {
            await (0, redis_1.cacheSet)(`admin_blacklist:${p.jti}`, '1', remaining);
        }
    }
    return reply.send({ success: true });
}
// ── GET /v1/admin/auth/me ─────────────────────────────────────
async function meAdmin(request, reply) {
    const { platformUserId } = request.platformUser;
    const user = await prisma_1.prisma.platformUser.findUnique({
        where: { id: platformUserId },
        select: {
            id: true,
            email: true,
            name: true,
            isActive: true,
            userRoles: {
                where: { role: { isActive: true } },
                include: { role: { select: { name: true, permissions: true } } },
            },
        },
    });
    if (!user || !user.isActive) {
        return reply.status(401).send({
            success: false,
            error: { code: 'UNAUTHORIZED', message: 'User not found or deactivated', statusCode: 401 },
        });
    }
    const roles = user.userRoles.map((ur) => ur.role.name);
    const permissions = mergePermissions(user.userRoles);
    return reply.send({
        success: true,
        data: { id: user.id, email: user.email, name: user.name, roles, permissions },
    });
}
//# sourceMappingURL=handler.js.map