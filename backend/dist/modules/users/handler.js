"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createStoreUser = createStoreUser;
exports.listStoreUsers = listStoreUsers;
exports.updateStoreUser = updateStoreUser;
exports.removeStoreUser = removeStoreUser;
exports.updateMe = updateMe;
exports.uploadAvatar = uploadAvatar;
exports.getMyStores = getMyStores;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const promises_1 = require("stream/promises");
const prisma_1 = require("../../lib/prisma");
const redis_1 = require("../../lib/redis");
const OPERATOR_KEYS = [
    'can_bill', 'can_manage_product', 'can_view_inventory',
    'can_add_customer', 'can_edit_customer',
    'can_view_customer', 'can_view_reports',
];
function validPermissions(p) {
    if (!p || typeof p !== 'object' || Array.isArray(p))
        return false;
    return OPERATOR_KEYS.every(k => typeof p[k] === 'boolean');
}
// ── POST /v1/stores/:storeId/users ───────────────────────────
async function createStoreUser(request, reply) {
    const callerRole = request.storeRole;
    const callerId = request.authUser.userId;
    const storeId = request.storeId;
    const { name, phone, password, role, permissions } = request.body ?? {};
    if (!['OWNER', 'MANAGER'].includes(callerRole)) {
        return reply.status(403).send({
            success: false,
            error: { code: 'FORBIDDEN', message: 'OWNER or MANAGER role required', statusCode: 403 },
        });
    }
    if (callerRole === 'MANAGER' && role !== 'OPERATOR') {
        return reply.status(403).send({
            success: false,
            error: { code: 'FORBIDDEN', message: 'MANAGER can only create OPERATOR users', statusCode: 403 },
        });
    }
    if (!name || !phone || !password || !role) {
        return reply.status(400).send({
            success: false,
            error: { code: 'VALIDATION_ERROR', message: 'name, phone, password, role are required', statusCode: 400 },
        });
    }
    if (!['MANAGER', 'OPERATOR'].includes(role)) {
        return reply.status(400).send({
            success: false,
            error: { code: 'VALIDATION_ERROR', message: 'role must be MANAGER or OPERATOR', statusCode: 400 },
        });
    }
    if (role === 'OPERATOR' && !validPermissions(permissions)) {
        return reply.status(400).send({
            success: false,
            error: {
                code: 'VALIDATION_ERROR',
                message: `OPERATOR requires permissions with all 7 boolean keys: ${OPERATOR_KEYS.join(', ')}`,
                statusCode: 400,
            },
        });
    }
    const E164_REGEX = /^\+[1-9]\d{7,14}$/;
    if (!E164_REGEX.test(phone)) {
        return reply.status(400).send({
            success: false,
            error: {
                code: 'VALIDATION_ERROR',
                message: 'phone must be in E.164 format (e.g. +919876543210)',
                statusCode: 400,
            },
        });
    }
    const resolvedPerms = role === 'OPERATOR' ? permissions : null;
    const existingUser = await prisma_1.prisma.user.findUnique({
        where: { phone },
        select: { userId: true, name: true, phone: true, userType: true, orgId: true },
    });
    if (existingUser) {
        const existingRole = await prisma_1.prisma.userStoreRole.findFirst({
            where: { userId: existingUser.userId, storeId },
        });
        if (existingRole?.isActive) {
            return reply.status(409).send({
                success: false,
                error: { code: 'ALREADY_MEMBER', message: 'User is already a member of this store', statusCode: 409 },
            });
        }
        if (existingRole && !existingRole.isActive) {
            const updated = await prisma_1.prisma.userStoreRole.update({
                where: { id: existingRole.id },
                data: { role: role, permissions: resolvedPerms, grantedBy: callerId, isActive: true },
            });
            return reply.status(200).send({
                success: true,
                data: {
                    userId: existingUser.userId, name: existingUser.name, phone: existingUser.phone,
                    role: updated.role, permissions: updated.permissions, storeId,
                },
            });
        }
    }
    const passwordHash = await bcryptjs_1.default.hash(password, 12);
    const result = await prisma_1.prisma.$transaction(async (tx) => {
        let user = existingUser;
        if (!user) {
            const store = await tx.store.findUnique({
                where: { storeId },
                select: { orgId: true },
            });
            if (!store)
                throw Object.assign(new Error('Store not found'), { statusCode: 404 });
            user = await tx.user.create({
                data: { orgId: store.orgId, name, phone, userType: role, passwordHash },
                select: { userId: true, name: true, phone: true, userType: true, orgId: true },
            });
        }
        const storeRole = await tx.userStoreRole.create({
            data: {
                userId: user.userId, storeId, role: role,
                permissions: resolvedPerms, grantedBy: callerId, isActive: true,
            },
        });
        return { user: user, storeRole };
    });
    return reply.status(201).send({
        success: true,
        data: {
            userId: result.user.userId, name: result.user.name, phone: result.user.phone,
            role: result.storeRole.role, permissions: result.storeRole.permissions, storeId,
        },
    });
}
// ── GET /v1/stores/:storeId/users ────────────────────────────
async function listStoreUsers(request, reply) {
    if (!['OWNER', 'MANAGER'].includes(request.storeRole)) {
        return reply.status(403).send({
            success: false,
            error: { code: 'FORBIDDEN', message: 'OWNER or MANAGER role required', statusCode: 403 },
        });
    }
    const rows = await prisma_1.prisma.userStoreRole.findMany({
        where: { storeId: request.storeId, isActive: true },
        include: {
            user: { select: { userId: true, name: true, phone: true, userType: true, isActive: true } },
        },
        orderBy: { grantedAt: 'asc' },
    });
    return reply.send({
        success: true,
        data: rows.map(r => ({
            userId: r.user.userId,
            name: r.user.name,
            phone: r.user.phone,
            userType: r.user.userType,
            isActive: r.user.isActive,
            role: r.role,
            permissions: r.permissions,
            grantedAt: r.grantedAt,
        })),
    });
}
// ── PATCH /v1/stores/:storeId/users/:userId ──────────────────
async function updateStoreUser(request, reply) {
    const callerRole = request.storeRole;
    if (!['OWNER', 'MANAGER'].includes(callerRole)) {
        return reply.status(403).send({
            success: false,
            error: { code: 'FORBIDDEN', message: 'OWNER or MANAGER role required', statusCode: 403 },
        });
    }
    const storeId = request.storeId;
    const targetUserId = request.params.userId;
    const { role, permissions } = request.body ?? {};
    const targetRow = await prisma_1.prisma.userStoreRole.findFirst({
        where: { userId: targetUserId, storeId, isActive: true },
    });
    if (!targetRow) {
        return reply.status(404).send({
            success: false,
            error: { code: 'NOT_FOUND', message: 'User not found in this store', statusCode: 404 },
        });
    }
    if (callerRole === 'MANAGER' && targetRow.role !== 'OPERATOR') {
        return reply.status(403).send({
            success: false,
            error: { code: 'FORBIDDEN', message: 'MANAGER can only update OPERATOR users', statusCode: 403 },
        });
    }
    if (callerRole === 'MANAGER' && role && role !== 'OPERATOR') {
        return reply.status(403).send({
            success: false,
            error: { code: 'FORBIDDEN', message: 'MANAGER can only set OPERATOR role', statusCode: 403 },
        });
    }
    const newRole = (role ?? targetRow.role);
    if (newRole === 'OPERATOR' && permissions !== undefined && !validPermissions(permissions)) {
        return reply.status(400).send({
            success: false,
            error: {
                code: 'VALIDATION_ERROR',
                message: `OPERATOR permissions must include all 7 boolean keys: ${OPERATOR_KEYS.join(', ')}`,
                statusCode: 400,
            },
        });
    }
    const resolvedPerms = newRole === 'MANAGER'
        ? null
        : (permissions ?? targetRow.permissions);
    const updated = await prisma_1.prisma.userStoreRole.update({
        where: { id: targetRow.id },
        data: { ...(role && { role: role }), permissions: resolvedPerms },
    });
    await (0, redis_1.cacheDelete)(`role:${targetUserId}:${storeId}`);
    return reply.send({
        success: true,
        data: { userId: targetUserId, role: updated.role, permissions: updated.permissions, storeId },
    });
}
// ── DELETE /v1/stores/:storeId/users/:userId ─────────────────
async function removeStoreUser(request, reply) {
    const callerRole = request.storeRole;
    const callerId = request.authUser.userId;
    if (!['OWNER', 'MANAGER'].includes(callerRole)) {
        return reply.status(403).send({
            success: false,
            error: { code: 'FORBIDDEN', message: 'OWNER or MANAGER role required', statusCode: 403 },
        });
    }
    const storeId = request.storeId;
    const targetUserId = request.params.userId;
    if (callerId === targetUserId) {
        return reply.status(400).send({
            success: false,
            error: { code: 'CANNOT_REMOVE_SELF', message: 'You cannot remove yourself from the store', statusCode: 400 },
        });
    }
    const targetRow = await prisma_1.prisma.userStoreRole.findFirst({
        where: { userId: targetUserId, storeId, isActive: true },
    });
    if (!targetRow) {
        return reply.status(404).send({
            success: false,
            error: { code: 'NOT_FOUND', message: 'User not found in this store', statusCode: 404 },
        });
    }
    if (callerRole === 'MANAGER' && targetRow.role !== 'OPERATOR') {
        return reply.status(403).send({
            success: false,
            error: { code: 'FORBIDDEN', message: 'MANAGER can only remove OPERATOR users', statusCode: 403 },
        });
    }
    await prisma_1.prisma.userStoreRole.update({
        where: { id: targetRow.id },
        data: { isActive: false },
    });
    await (0, redis_1.cacheDelete)(`role:${targetUserId}:${storeId}`);
    return reply.send({ success: true, data: { userId: targetUserId, storeId, isActive: false } });
}
// ── PATCH /v1/users/me ──────────────────────────────────────
async function updateMe(request, reply) {
    const { userId } = request.authUser;
    const { name } = (request.body ?? {});
    if (!name || !name.trim()) {
        return reply.status(400).send({
            success: false,
            error: { code: 'VALIDATION_ERROR', message: 'name is required', statusCode: 400 },
        });
    }
    const updated = await prisma_1.prisma.user.update({
        where: { userId },
        data: { name: name.trim() },
        select: { userId: true, name: true, phone: true, email: true, userType: true },
    });
    return reply.send({ success: true, data: updated });
}
// ── POST /v1/users/me/avatar ─────────────────────────────────
async function uploadAvatar(request, reply) {
    const { userId } = request.authUser;
    const data = await request.file();
    if (!data) {
        return reply.status(400).send({
            success: false,
            error: { code: 'VALIDATION_ERROR', message: 'No file uploaded', statusCode: 400 },
        });
    }
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(data.mimetype)) {
        return reply.status(400).send({
            success: false,
            error: { code: 'VALIDATION_ERROR', message: 'File must be jpeg, png, or webp', statusCode: 400 },
        });
    }
    const extMap = {
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp',
    };
    const ext = extMap[data.mimetype];
    const uploadDir = process.env.UPLOAD_DIR
        ?? path_1.default.join(process.cwd(), 'uploads');
    const avatarsDir = path_1.default.join(uploadDir, 'avatars');
    await fs_1.default.promises.mkdir(avatarsDir, { recursive: true });
    const filename = `${userId}.${ext}`;
    const filepath = path_1.default.join(avatarsDir, filename);
    const avatarUrl = `/uploads/avatars/${filename}`;
    await (0, promises_1.pipeline)(data.file, fs_1.default.createWriteStream(filepath));
    await prisma_1.prisma.user.update({
        where: { userId },
        data: { avatarUrl },
    });
    return reply.send({ success: true, data: { avatarUrl } });
}
// ── GET /v1/users/me/stores ──────────────────────────────────
async function getMyStores(request, reply) {
    const { userId } = request.authUser;
    const roles = await prisma_1.prisma.userStoreRole.findMany({
        where: { userId, isActive: true },
        include: {
            store: { select: { storeId: true, name: true, industryType: true, isActive: true } },
        },
        orderBy: { grantedAt: 'asc' },
    });
    return reply.send({
        success: true,
        data: roles.map(r => ({
            storeId: r.store.storeId,
            storeName: r.store.name,
            industryType: r.store.industryType,
            isActive: r.store.isActive,
            role: r.role,
            permissions: r.permissions,
        })),
    });
}
//# sourceMappingURL=handler.js.map