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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyToken = verifyToken;
exports.getMe = getMe;
exports.logout = logout;
exports.inviteUser = inviteUser;
exports.getStoreStaff = getStoreStaff;
exports.assignStoreRole = assignStoreRole;
exports.updateStoreRole = updateStoreRole;
exports.listUsers = listUsers;
exports.updateUser = updateUser;
exports.deactivateUser = deactivateUser;
exports.getOrgDetails = getOrgDetails;
exports.updateOrgSettings = updateOrgSettings;
exports.listOrgStores = listOrgStores;
exports.createStore = createStore;
exports.updateStore = updateStore;
exports.login = login;
exports.setPassword = setPassword;
exports.forgotPassword = forgotPassword;
exports.resetPassword = resetPassword;
exports.signup = signup;
exports.removeStoreRole = removeStoreRole;
exports.refreshDevToken = refreshDevToken;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const categoryProvisioning_1 = require("../../services/categoryProvisioning");
const firebase_1 = require("../../lib/firebase");
const redis_1 = require("../../lib/redis");
const prisma_1 = require("../../lib/prisma");
const crypto_1 = require("crypto");
const schema_1 = require("./schema");
// ── POST /v1/auth/verify-token ────────────────────────────────
async function verifyToken(request, reply) {
    try {
        const { idToken } = request.body;
        const { uid, phone } = await (0, firebase_1.verifyFirebaseTokenFull)(idToken);
        const user = await prisma_1.prisma.user.findUnique({
            where: phone ? { phone } : { userId: uid },
            include: {
                userStoreRoles: {
                    where: { isActive: true },
                    include: {
                        store: { select: { name: true, storeCode: true, industryType: true } },
                    },
                },
                organization: {
                    select: { orgId: true, name: true, slug: true },
                },
            },
        });
        if (!user) {
            return reply.status(401).send({
                success: false,
                error: { code: 'USER_NOT_FOUND', message: 'No account found for this phone number. Please sign up.', statusCode: 401 },
            });
        }
        if (!user.isActive) {
            return reply.status(401).send({
                success: false,
                error: { code: 'ACCOUNT_DEACTIVATED', message: 'Account is deactivated. Contact your administrator.', statusCode: 401 },
            });
        }
        const sessionToken = (0, crypto_1.randomBytes)(32).toString('hex');
        await (0, redis_1.setSession)(sessionToken, user.userId, 604800);
        return reply.status(200).send({
            success: true,
            data: {
                sessionToken,
                user: {
                    userId: user.userId,
                    name: user.name,
                    phone: user.phone,
                    email: user.email,
                    userType: user.userType,
                },
                org: user.organization
                    ? { orgId: user.organization.orgId, name: user.organization.name, slug: user.organization.slug }
                    : null,
                stores: user.userStoreRoles.map(r => ({
                    storeId: r.storeId,
                    storeName: r.store.name,
                    storeCode: r.store.storeCode,
                    industryType: r.store.industryType,
                    role: r.role,
                    permissions: r.permissions,
                })),
            },
        });
    }
    catch (err) {
        if (err.code === 'auth/argument-error' ||
            err.code === 'auth/id-token-expired' ||
            err.code === 'auth/id-token-revoked') {
            return reply.status(401).send({
                success: false,
                error: { code: 'INVALID_TOKEN', message: 'Firebase token is invalid or expired', statusCode: 401 },
            });
        }
        throw err;
    }
}
// ── GET /v1/auth/me ───────────────────────────────────────────
async function getMe(request, reply) {
    const { userId } = request.authUser;
    const user = await prisma_1.prisma.user.findUnique({
        where: { userId },
        include: {
            userStoreRoles: {
                where: { isActive: true },
                include: {
                    store: {
                        select: { storeId: true, name: true, storeCode: true, industryType: true },
                    },
                },
            },
            organization: {
                select: {
                    name: true,
                    slug: true,
                    planId: true,
                    taxRegime: true,
                    defaultCurrency: true,
                },
            },
        },
    });
    if (!user) {
        return reply.status(401).send({
            success: false,
            error: { code: 'UNAUTHORIZED', message: 'User not found', statusCode: 401 },
        });
    }
    return reply.send({
        success: true,
        data: {
            userId: user.userId,
            name: user.name,
            email: user.email,
            phone: user.phone,
            userType: user.userType,
            isActive: user.isActive,
            organization: user.organization,
            stores: user.userStoreRoles.map(r => ({
                storeId: r.store.storeId,
                storeName: r.store.name,
                storeCode: r.store.storeCode,
                industryType: r.store.industryType,
                role: r.role,
            })),
        },
    });
}
// ── POST /v1/auth/logout ──────────────────────────────────────
async function logout(request, reply) {
    const token = request.headers['authorization'].slice(7);
    await (0, redis_1.deleteSession)(token);
    return reply.send({ success: true, data: { message: 'Logged out successfully' } });
}
// ── POST /v1/users/invite ─────────────────────────────────────
async function inviteUser(request, reply) {
    if (request.authUser.userType !== 'OWNER') {
        return reply.status(403).send({
            success: false,
            error: { code: 'FORBIDDEN', message: 'Only OWNER can invite users', statusCode: 403 },
        });
    }
    const { orgId } = request.authUser;
    const { name, phone, email, userType } = request.body;
    try {
        const user = await prisma_1.prisma.user.create({
            data: { orgId, name, phone, email, userType },
            select: {
                userId: true,
                name: true,
                email: true,
                phone: true,
                userType: true,
                isActive: true,
                createdAt: true,
            },
        });
        return reply.status(201).send({ success: true, data: user });
    }
    catch (err) {
        if (err.code === 'P2002') {
            return reply.status(409).send({
                success: false,
                error: {
                    code: 'CONFLICT',
                    message: 'A user with this phone or email already exists',
                    statusCode: 409,
                },
            });
        }
        throw err;
    }
}
// ── GET /v1/stores/:storeId/staff ─────────────────────────────
async function getStoreStaff(request, reply) {
    if (!['OWNER', 'MANAGER'].includes(request.storeRole)) {
        return reply.status(403).send({
            success: false,
            error: { code: 'FORBIDDEN', message: 'MANAGER or OWNER role required', statusCode: 403 },
        });
    }
    const storeId = request.storeId;
    const staff = await prisma_1.prisma.userStoreRole.findMany({
        where: { storeId, isActive: true },
        include: {
            user: {
                select: {
                    userId: true,
                    name: true,
                    email: true,
                    phone: true,
                    userType: true,
                    isActive: true,
                },
            },
        },
        orderBy: { grantedAt: 'desc' },
    });
    return reply.send({
        success: true,
        data: staff.map(r => ({
            id: r.id,
            role: r.role,
            grantedAt: r.grantedAt,
            user: r.user,
        })),
    });
}
// ── POST /v1/stores/:storeId/staff ────────────────────────────
async function assignStoreRole(request, reply) {
    if (request.storeRole !== 'OWNER') {
        return reply.status(403).send({
            success: false,
            error: { code: 'FORBIDDEN', message: 'Only OWNER can assign store roles', statusCode: 403 },
        });
    }
    const storeId = request.storeId;
    const { userId: grantedBy } = request.authUser;
    const { userId, role } = request.body;
    try {
        const assignment = await prisma_1.prisma.userStoreRole.upsert({
            where: { uq_user_store_role: { userId, storeId } },
            create: { userId, storeId, role, grantedBy, isActive: true },
            update: { role, isActive: true, grantedBy },
        });
        return reply.status(201).send({ success: true, data: assignment });
    }
    catch (err) {
        if (err.code === 'P2025') {
            return reply.status(404).send({
                success: false,
                error: { code: 'NOT_FOUND', message: 'User not found', statusCode: 404 },
            });
        }
        throw err;
    }
}
// ── PATCH /v1/stores/:storeId/staff/:userId ───────────────────
async function updateStoreRole(request, reply) {
    if (request.storeRole !== 'OWNER') {
        return reply.status(403).send({
            success: false,
            error: { code: 'FORBIDDEN', message: 'Only OWNER can update store roles', statusCode: 403 },
        });
    }
    const storeId = request.storeId;
    const { userId: targetUserId } = request.params;
    const { role } = request.body;
    try {
        const assignment = await prisma_1.prisma.userStoreRole.update({
            where: { uq_user_store_role: { userId: targetUserId, storeId } },
            data: { role },
        });
        return reply.send({ success: true, data: assignment });
    }
    catch (err) {
        if (err.code === 'P2025') {
            return reply.status(404).send({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Staff assignment not found', statusCode: 404 },
            });
        }
        throw err;
    }
}
// ── GET /v1/users ─────────────────────────────────────────────
async function listUsers(request, reply) {
    if (request.authUser.userType !== 'OWNER') {
        return reply.status(403).send({
            success: false,
            error: { code: 'FORBIDDEN', message: 'Only OWNER can list users', statusCode: 403 },
        });
    }
    const { orgId } = request.authUser;
    const page = Math.max(1, parseInt(request.query.page ?? '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(request.query.limit ?? '20', 10) || 20));
    const [users, total] = await Promise.all([
        prisma_1.prisma.user.findMany({
            where: { orgId },
            include: {
                userStoreRoles: {
                    where: { isActive: true },
                    include: { store: { select: { storeId: true, name: true, storeCode: true } } },
                },
            },
            orderBy: { createdAt: 'desc' },
            skip: (page - 1) * limit,
            take: limit,
        }),
        prisma_1.prisma.user.count({ where: { orgId } }),
    ]);
    return reply.send({
        success: true,
        data: users,
        meta: { page, limit, total, hasMore: page * limit < total },
    });
}
// ── PATCH /v1/users/:userId ───────────────────────────────────
async function updateUser(request, reply) {
    const { userId: authUserId, orgId, userType } = request.authUser;
    const { userId: targetId } = request.params;
    // Self-update or OWNER updating anyone in the org
    const isSelf = authUserId === targetId;
    const isOwner = userType === 'OWNER';
    if (!isSelf && !isOwner) {
        return reply.status(403).send({
            success: false,
            error: { code: 'FORBIDDEN', message: 'You can only update your own profile', statusCode: 403 },
        });
    }
    const parsed = schema_1.UpdateUserSchema.safeParse(request.body);
    if (!parsed.success) {
        return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message, statusCode: 400 } });
    }
    // OWNER can only update users in their org
    if (isOwner && !isSelf) {
        const target = await prisma_1.prisma.user.findUnique({ where: { userId: targetId }, select: { orgId: true } });
        if (!target || target.orgId !== orgId) {
            return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'User not found', statusCode: 404 } });
        }
    }
    try {
        const user = await prisma_1.prisma.user.update({
            where: { userId: targetId },
            data: parsed.data,
            select: { userId: true, name: true, email: true, phone: true, userType: true, isActive: true, updatedAt: true },
        });
        return reply.send({ success: true, data: user });
    }
    catch (err) {
        if (err.code === 'P2025') {
            return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'User not found', statusCode: 404 } });
        }
        if (err.code === 'P2002') {
            return reply.status(409).send({ success: false, error: { code: 'CONFLICT', message: 'Phone or email already in use', statusCode: 409 } });
        }
        throw err;
    }
}
// ── PATCH /v1/users/:userId/deactivate ────────────────────────
async function deactivateUser(request, reply) {
    if (request.authUser.userType !== 'OWNER') {
        return reply.status(403).send({
            success: false,
            error: { code: 'FORBIDDEN', message: 'Only OWNER can deactivate users', statusCode: 403 },
        });
    }
    const { userId: authUserId, orgId } = request.authUser;
    const { userId: targetId } = request.params;
    if (authUserId === targetId) {
        return reply.status(400).send({
            success: false,
            error: { code: 'CANNOT_DEACTIVATE_SELF', message: 'You cannot deactivate your own account', statusCode: 400 },
        });
    }
    const target = await prisma_1.prisma.user.findUnique({ where: { userId: targetId }, select: { orgId: true } });
    if (!target || target.orgId !== orgId) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'User not found', statusCode: 404 } });
    }
    await prisma_1.prisma.user.update({ where: { userId: targetId }, data: { isActive: false } });
    return reply.send({ success: true, data: { userId: targetId, isActive: false } });
}
// ── GET /v1/org ───────────────────────────────────────────────
async function getOrgDetails(request, reply) {
    const { orgId } = request.authUser;
    const org = await prisma_1.prisma.organization.findUnique({
        where: { orgId },
        include: { _count: { select: { stores: true, users: true } } },
    });
    if (!org) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Organization not found', statusCode: 404 } });
    }
    return reply.send({ success: true, data: org });
}
// ── PATCH /v1/org/settings ────────────────────────────────────
async function updateOrgSettings(request, reply) {
    if (request.authUser.userType !== 'OWNER') {
        return reply.status(403).send({
            success: false,
            error: { code: 'FORBIDDEN', message: 'Only OWNER can update org settings', statusCode: 403 },
        });
    }
    const { orgId } = request.authUser;
    const parsed = schema_1.UpdateOrgSettingsSchema.safeParse(request.body);
    if (!parsed.success) {
        return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message, statusCode: 400 } });
    }
    const { settings, defaultCurrency, locale } = parsed.data;
    // Merge settings — fetch current first
    const existing = await prisma_1.prisma.organization.findUnique({ where: { orgId }, select: { settings: true } });
    if (!existing) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Organization not found', statusCode: 404 } });
    }
    const mergedSettings = { ...existing.settings, ...settings };
    const org = await prisma_1.prisma.organization.update({
        where: { orgId },
        data: {
            settings: mergedSettings,
            ...(defaultCurrency && { defaultCurrency }),
            ...(locale && { locale }),
        },
    });
    return reply.send({ success: true, data: org });
}
// ── GET /v1/org/stores ────────────────────────────────────────
async function listOrgStores(request, reply) {
    if (request.authUser.userType !== 'OWNER') {
        return reply.status(403).send({
            success: false,
            error: { code: 'FORBIDDEN', message: 'Only OWNER can list org stores', statusCode: 403 },
        });
    }
    const { orgId } = request.authUser;
    const stores = await prisma_1.prisma.store.findMany({
        where: { orgId },
        include: { _count: { select: { userStoreRoles: true } } },
        orderBy: { createdAt: 'asc' },
    });
    return reply.send({ success: true, data: stores });
}
// ── POST /v1/org/stores ───────────────────────────────────────
async function createStore(request, reply) {
    if (request.authUser.userType !== 'OWNER') {
        return reply.status(403).send({
            success: false,
            error: { code: 'FORBIDDEN', message: 'Only OWNER can create stores', statusCode: 403 },
        });
    }
    const { orgId, userId } = request.authUser;
    const parsed = schema_1.CreateStoreSchema.safeParse(request.body);
    if (!parsed.success) {
        return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message, statusCode: 400 } });
    }
    const { name, storeCode, industryType, phone, gstin, currencyCode, timezone, lowStockThreshold, address } = parsed.data;
    try {
        const store = await prisma_1.prisma.$transaction(async (tx) => {
            const newStore = await tx.store.create({
                data: {
                    orgId,
                    name,
                    storeCode,
                    industryType: industryType,
                    phone: phone ?? null,
                    gstin: gstin ?? null,
                    currencyCode,
                    timezone,
                    lowStockThreshold,
                    address: address ? address : {},
                },
            });
            // Assign the creating OWNER as OWNER of the new store
            await tx.userStoreRole.create({
                data: {
                    userId,
                    storeId: newStore.storeId,
                    role: 'OWNER',
                    grantedBy: userId,
                    isActive: true,
                },
            });
            // Provision master categories inside the
            // same transaction — rolls back with store
            // if provisioning fails.
            await (0, categoryProvisioning_1.provisionStoreCategories)(newStore.storeId, industryType, tx);
            return newStore;
        });
        return reply.status(201).send({ success: true, data: store });
    }
    catch (err) {
        if (err.code === 'P2002') {
            return reply.status(409).send({
                success: false,
                error: { code: 'CONFLICT', message: 'A store with this storeCode already exists', statusCode: 409 },
            });
        }
        throw err;
    }
}
// ── PATCH /v1/org/stores/:storeId ────────────────────────────
async function updateStore(request, reply) {
    if (request.storeRole !== 'OWNER' && request.storeRole !== 'MANAGER') {
        return reply.status(403).send({
            success: false,
            error: { code: 'FORBIDDEN', message: 'MANAGER or OWNER role required', statusCode: 403 },
        });
    }
    // Use storeId from storeMiddleware (verified against X-Store-ID header)
    const storeId = request.storeId;
    const { orgId } = request.authUser;
    // Verify store belongs to this org (extra safety for cross-org access)
    const existing = await prisma_1.prisma.store.findFirst({ where: { storeId, orgId }, select: { storeId: true } });
    if (!existing) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Store not found', statusCode: 404 } });
    }
    const parsed = schema_1.UpdateStoreSchema.safeParse(request.body);
    if (!parsed.success) {
        return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message, statusCode: 400 } });
    }
    const { address, ...rest } = parsed.data;
    const store = await prisma_1.prisma.store.update({
        where: { storeId },
        data: { ...rest, ...(address !== undefined && { address: address }) },
    });
    return reply.send({ success: true, data: store });
}
// ── POST /v1/auth/login ───────────────────────────────────────
async function login(request, reply) {
    const parsed = schema_1.LoginSchema.safeParse(request.body);
    if (!parsed.success) {
        return reply.status(400).send({
            success: false,
            error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message, statusCode: 400 },
        });
    }
    const { phone, password } = parsed.data;
    const user = await prisma_1.prisma.user.findUnique({
        where: { phone },
        include: {
            userStoreRoles: {
                where: { isActive: true },
                include: {
                    store: {
                        select: {
                            name: true,
                            storeCode: true,
                            industryType: true,
                        },
                    },
                },
            },
        },
    });
    if (!user) {
        return reply.status(401).send({
            success: false,
            error: { code: 'INVALID_CREDENTIALS', message: 'Invalid phone or password', statusCode: 401 },
        });
    }
    if (!user.passwordHash) {
        return reply.status(401).send({
            success: false,
            error: { code: 'PASSWORD_NOT_SET', message: 'Password not set. Use forgot password to set one.', statusCode: 401 },
        });
    }
    const passwordMatch = await bcryptjs_1.default.compare(password, user.passwordHash);
    if (!passwordMatch) {
        return reply.status(401).send({
            success: false,
            error: { code: 'INVALID_CREDENTIALS', message: 'Invalid phone or password', statusCode: 401 },
        });
    }
    if (!user.isActive) {
        return reply.status(401).send({
            success: false,
            error: { code: 'ACCOUNT_DEACTIVATED', message: 'Account is deactivated. Contact your administrator.', statusCode: 401 },
        });
    }
    const sessionToken = (0, crypto_1.randomBytes)(32).toString('hex');
    await (0, redis_1.setSession)(sessionToken, user.userId, 604800);
    return reply.status(200).send({
        success: true,
        data: {
            sessionToken,
            user: {
                userId: user.userId,
                name: user.name,
                phone: user.phone,
                email: user.email,
                userType: user.userType,
            },
            stores: user.userStoreRoles.map(r => ({
                storeId: r.storeId,
                storeName: r.store.name,
                storeCode: r.store.storeCode,
                industryType: r.store.industryType,
                role: r.role,
                permissions: r.permissions,
            })),
        },
    });
}
// ── POST /v1/auth/set-password ────────────────────────────────
async function setPassword(request, reply) {
    const parsed = schema_1.SetPasswordSchema.safeParse(request.body);
    if (!parsed.success) {
        return reply.status(400).send({
            success: false,
            error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message, statusCode: 400 },
        });
    }
    const { password } = parsed.data;
    const { userId } = request.authUser;
    const hash = await bcryptjs_1.default.hash(password, 12);
    await prisma_1.prisma.user.update({
        where: { userId },
        data: { passwordHash: hash },
    });
    return reply.send({ success: true, data: { message: 'Password set successfully' } });
}
// ── POST /v1/auth/forgot-password ─────────────────────────────
async function forgotPassword(request, reply) {
    const parsed = schema_1.ForgotPasswordSchema.safeParse(request.body);
    if (!parsed.success) {
        return reply.status(400).send({
            success: false,
            error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message, statusCode: 400 },
        });
    }
    const { phone } = parsed.data;
    const user = await prisma_1.prisma.user.findUnique({ where: { phone }, select: { userId: true } });
    if (!user) {
        return reply.status(404).send({
            success: false,
            error: { code: 'NOT_FOUND', message: 'No account found with this phone number', statusCode: 404 },
        });
    }
    // OTP delivery handled by Flutter Firebase Auth SDK directly.
    // Backend confirms the user exists and returns the phone for the client to proceed.
    return reply.send({
        success: true,
        data: { message: 'OTP sent to phone', phone },
    });
}
// ── POST /v1/auth/reset-password ──────────────────────────────
async function resetPassword(request, reply) {
    const parsed = schema_1.ResetPasswordSchema.safeParse(request.body);
    if (!parsed.success) {
        return reply.status(400).send({
            success: false,
            error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message, statusCode: 400 },
        });
    }
    const { phone, idToken, newPassword } = parsed.data;
    // Verify the Firebase idToken — confirms the user completed real phone OTP.
    // Firebase sent OTP to this phone, so a valid token is sufficient proof of ownership.
    try {
        await (0, firebase_1.verifyFirebaseToken)(idToken);
    }
    catch (err) {
        return reply.status(401).send({
            success: false,
            error: { code: 'INVALID_TOKEN', message: 'Firebase token is invalid or expired', statusCode: 401 },
        });
    }
    const user = await prisma_1.prisma.user.findUnique({
        where: { phone },
        include: {
            userStoreRoles: {
                where: { isActive: true },
                include: { store: { select: { name: true, storeCode: true } } },
            },
        },
    });
    if (!user) {
        return reply.status(404).send({
            success: false,
            error: { code: 'NOT_FOUND', message: 'No account found with this phone number', statusCode: 404 },
        });
    }
    if (!user.isActive) {
        return reply.status(401).send({
            success: false,
            error: { code: 'ACCOUNT_DEACTIVATED', message: 'Account is deactivated. Contact your administrator.', statusCode: 401 },
        });
    }
    const hash = await bcryptjs_1.default.hash(newPassword, 12);
    await prisma_1.prisma.user.update({
        where: { userId: user.userId },
        data: { passwordHash: hash },
    });
    const sessionToken = (0, crypto_1.randomBytes)(32).toString('hex');
    await (0, redis_1.setSession)(sessionToken, user.userId, 604800);
    return reply.status(200).send({
        success: true,
        data: {
            sessionToken,
            user: {
                userId: user.userId,
                name: user.name,
                phone: user.phone,
                email: user.email,
                userType: user.userType,
            },
            stores: user.userStoreRoles.map(r => ({
                storeId: r.storeId,
                storeName: r.store.name,
                storeCode: r.store.storeCode,
                role: r.role,
            })),
        },
    });
}
// ── POST /v1/auth/signup ──────────────────────────────────────
async function signup(request, reply) {
    const parsed = schema_1.SignupSchema.safeParse(request.body);
    if (!parsed.success) {
        return reply.status(400).send({
            success: false,
            error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message, statusCode: 400 },
        });
    }
    const { idToken, ownerName, phone, businessName, storeName, password, industryType } = parsed.data;
    let firebaseUid;
    try {
        firebaseUid = await (0, firebase_1.verifyFirebaseToken)(idToken);
    }
    catch (err) {
        return reply.status(401).send({
            success: false,
            error: { code: 'INVALID_TOKEN', message: 'Firebase token is invalid or expired', statusCode: 401 },
        });
    }
    // Check duplicate phone
    const existing = await prisma_1.prisma.user.findUnique({ where: { phone }, select: { userId: true } });
    if (existing) {
        return reply.status(409).send({
            success: false,
            error: {
                code: 'ALREADY_REGISTERED',
                message: 'An account with this phone already exists. Please login.',
                statusCode: 409,
            },
        });
    }
    const passwordHash = await bcryptjs_1.default.hash(password, 12);
    // Slug: lowercase, non-alphanum → hyphen, append 4 random hex chars
    const slug = businessName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        + '-' + (0, crypto_1.randomBytes)(2).toString('hex');
    // storeCode: first 4 alphanum chars uppercase + 4 random digits
    const storeCode = storeName
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(0, 4)
        .padEnd(4, 'X')
        + (1000 + Math.floor(Math.random() * 9000)).toString();
    try {
        const result = await prisma_1.prisma.$transaction(async (tx) => {
            const org = await tx.organization.create({
                data: {
                    name: businessName,
                    slug,
                    planId: 'free',
                    countryCode: 'IN',
                    defaultCurrency: 'INR',
                    taxRegime: 'GST',
                    locale: 'en-IN',
                },
            });
            const user = await tx.user.create({
                data: {
                    userId: firebaseUid,
                    orgId: org.orgId,
                    name: ownerName,
                    phone,
                    userType: 'OWNER',
                    passwordHash,
                },
            });
            const store = await tx.store.create({
                data: {
                    orgId: org.orgId,
                    name: storeName,
                    storeCode,
                    industryType: industryType,
                    currencyCode: 'INR',
                    timezone: 'Asia/Kolkata',
                },
            });
            await tx.userStoreRole.create({
                data: {
                    userId: user.userId,
                    storeId: store.storeId,
                    role: 'OWNER',
                    grantedBy: user.userId,
                    isActive: true,
                },
            });
            // Provision master categories inside same tx —
            // rolls back with store if provisioning fails.
            await (0, categoryProvisioning_1.provisionStoreCategories)(store.storeId, industryType, tx);
            return { org, user, store };
        });
        const sessionToken = (0, crypto_1.randomBytes)(32).toString('hex');
        await (0, redis_1.setSession)(sessionToken, result.user.userId, 604800);
        return reply.status(201).send({
            success: true,
            data: {
                sessionToken,
                user: {
                    userId: result.user.userId,
                    name: result.user.name,
                    phone: result.user.phone,
                    userType: result.user.userType,
                },
                org: {
                    orgId: result.org.orgId,
                    name: result.org.name,
                    slug: result.org.slug,
                },
                stores: [{
                        storeId: result.store.storeId,
                        storeName: result.store.name,
                        storeCode: result.store.storeCode,
                        industryType: result.store.industryType,
                        role: 'OWNER',
                    }],
            },
        });
    }
    catch (err) {
        if (err.code === 'P2002') {
            return reply.status(409).send({
                success: false,
                error: {
                    code: 'CONFLICT',
                    message: 'An account with this phone or business slug already exists',
                    statusCode: 409,
                },
            });
        }
        throw err;
    }
}
// ── DELETE /v1/stores/:storeId/staff/:userId ──────────────────
async function removeStoreRole(request, reply) {
    if (request.storeRole !== 'OWNER') {
        return reply.status(403).send({
            success: false,
            error: { code: 'FORBIDDEN', message: 'Only OWNER can remove store staff', statusCode: 403 },
        });
    }
    const storeId = request.storeId;
    const { userId: targetUserId } = request.params;
    try {
        await prisma_1.prisma.userStoreRole.update({
            where: { uq_user_store_role: { userId: targetUserId, storeId } },
            data: { isActive: false },
        });
        return reply.send({ success: true, data: { message: 'Staff member removed from store' } });
    }
    catch (err) {
        if (err.code === 'P2025') {
            return reply.status(404).send({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Staff assignment not found', statusCode: 404 },
            });
        }
        throw err;
    }
}
// DEV ONLY — refreshes test session token
// Remove before production deployment
async function refreshDevToken(request, reply) {
    if (process.env.NODE_ENV === 'production') {
        return reply.status(404).send({
            success: false,
            error: { code: 'NOT_FOUND',
                message: 'Not found', statusCode: 404 },
        });
    }
    const { setSession } = await Promise.resolve().then(() => __importStar(require('../../lib/redis')));
    await setSession('test-session-token-mobilepos-001', 'd430fea0-37ca-4d4a-b737-81c4da7c5206', 86400);
    return reply.send({
        success: true,
        message: 'Dev token refreshed',
    });
}
//# sourceMappingURL=handler.js.map