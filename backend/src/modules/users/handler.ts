import { FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import { prisma } from '../../lib/prisma';
import { cacheDelete } from '../../lib/redis';

const OPERATOR_KEYS = [
  'can_bill', 'can_manage_product', 'can_view_inventory',
  'can_add_customer', 'can_edit_customer',
  'can_view_customer', 'can_view_reports',
] as const;

function validPermissions(p: unknown): p is Record<string, boolean> {
  if (!p || typeof p !== 'object' || Array.isArray(p)) return false;
  return OPERATOR_KEYS.every(k => typeof (p as any)[k] === 'boolean');
}

// ── POST /v1/stores/:storeId/users ───────────────────────────
export async function createStoreUser(
  request: FastifyRequest<{
    Params: { storeId: string };
    Body: {
      name: string; phone: string; password: string;
      role: 'MANAGER' | 'OPERATOR';
      permissions?: Record<string, boolean>;
    };
  }>,
  reply: FastifyReply,
) {
  const callerRole = request.storeRole;
  const callerId   = request.authUser.userId;
  const storeId    = request.storeId;
  const { name, phone, password, role, permissions } = request.body ?? {} as any;

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

  const resolvedPerms = role === 'OPERATOR' ? permissions! : null;

  const existingUser = await prisma.user.findUnique({
    where:  { phone },
    select: { userId: true, name: true, phone: true, userType: true, orgId: true },
  });

  if (existingUser) {
    const existingRole = await prisma.userStoreRole.findFirst({
      where: { userId: existingUser.userId, storeId },
    });
    if (existingRole?.isActive) {
      return reply.status(409).send({
        success: false,
        error: { code: 'ALREADY_MEMBER', message: 'User is already a member of this store', statusCode: 409 },
      });
    }
    if (existingRole && !existingRole.isActive) {
      const updated = await prisma.userStoreRole.update({
        where: { id: existingRole.id },
        data:  { role: role as any, permissions: resolvedPerms as any, grantedBy: callerId, isActive: true },
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

  const passwordHash = await bcrypt.hash(password, 12);

  const result = await prisma.$transaction(async (tx) => {
    let user = existingUser;
    if (!user) {
      const store = await tx.store.findUnique({
        where:  { storeId },
        select: { orgId: true },
      });
      if (!store) throw Object.assign(new Error('Store not found'), { statusCode: 404 });
      user = await tx.user.create({
        data:   { orgId: store.orgId, name, phone, userType: role as any, passwordHash },
        select: { userId: true, name: true, phone: true, userType: true, orgId: true },
      });
    }
    const storeRole = await tx.userStoreRole.create({
      data: {
        userId: user!.userId, storeId, role: role as any,
        permissions: resolvedPerms as any, grantedBy: callerId, isActive: true,
      },
    });
    return { user: user!, storeRole };
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
export async function listStoreUsers(
  request: FastifyRequest<{ Params: { storeId: string } }>,
  reply: FastifyReply,
) {
  if (!['OWNER', 'MANAGER'].includes(request.storeRole)) {
    return reply.status(403).send({
      success: false,
      error: { code: 'FORBIDDEN', message: 'OWNER or MANAGER role required', statusCode: 403 },
    });
  }

  const rows = await prisma.userStoreRole.findMany({
    where:   { storeId: request.storeId, isActive: true },
    include: {
      user: { select: { userId: true, name: true, phone: true, userType: true, isActive: true } },
    },
    orderBy: { grantedAt: 'asc' },
  });

  return reply.send({
    success: true,
    data: rows.map(r => ({
      userId:      r.user.userId,
      name:        r.user.name,
      phone:       r.user.phone,
      userType:    r.user.userType,
      isActive:    r.user.isActive,
      role:        r.role,
      permissions: r.permissions,
      grantedAt:   r.grantedAt,
    })),
  });
}

// ── PATCH /v1/stores/:storeId/users/:userId ──────────────────
export async function updateStoreUser(
  request: FastifyRequest<{
    Params: { storeId: string; userId: string };
    Body:   { role?: 'MANAGER' | 'OPERATOR'; permissions?: Record<string, boolean> };
  }>,
  reply: FastifyReply,
) {
  const callerRole = request.storeRole;
  if (!['OWNER', 'MANAGER'].includes(callerRole)) {
    return reply.status(403).send({
      success: false,
      error: { code: 'FORBIDDEN', message: 'OWNER or MANAGER role required', statusCode: 403 },
    });
  }

  const storeId      = request.storeId;
  const targetUserId = request.params.userId;
  const { role, permissions } = request.body ?? {};

  const targetRow = await prisma.userStoreRole.findFirst({
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

  const newRole = (role ?? targetRow.role) as string;
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

  const updated = await prisma.userStoreRole.update({
    where: { id: targetRow.id },
    data:  { ...(role && { role: role as any }), permissions: resolvedPerms as any },
  });

  await cacheDelete(`role:${targetUserId}:${storeId}`);

  return reply.send({
    success: true,
    data: { userId: targetUserId, role: updated.role, permissions: updated.permissions, storeId },
  });
}

// ── DELETE /v1/stores/:storeId/users/:userId ─────────────────
export async function removeStoreUser(
  request: FastifyRequest<{ Params: { storeId: string; userId: string } }>,
  reply: FastifyReply,
) {
  const callerRole = request.storeRole;
  const callerId   = request.authUser.userId;
  if (!['OWNER', 'MANAGER'].includes(callerRole)) {
    return reply.status(403).send({
      success: false,
      error: { code: 'FORBIDDEN', message: 'OWNER or MANAGER role required', statusCode: 403 },
    });
  }

  const storeId      = request.storeId;
  const targetUserId = request.params.userId;

  if (callerId === targetUserId) {
    return reply.status(400).send({
      success: false,
      error: { code: 'CANNOT_REMOVE_SELF', message: 'You cannot remove yourself from the store', statusCode: 400 },
    });
  }

  const targetRow = await prisma.userStoreRole.findFirst({
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

  await prisma.userStoreRole.update({
    where: { id: targetRow.id },
    data:  { isActive: false },
  });

  await cacheDelete(`role:${targetUserId}:${storeId}`);

  return reply.send({ success: true, data: { userId: targetUserId, storeId, isActive: false } });
}

// ── PATCH /v1/users/me ──────────────────────────────────────
export async function updateMe(
  request: FastifyRequest<{ Body: { name?: string } }>,
  reply: FastifyReply,
) {
  const { userId } = request.authUser;
  const { name }   = (request.body ?? {}) as { name?: string };

  if (!name || !name.trim()) {
    return reply.status(400).send({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'name is required', statusCode: 400 },
    });
  }

  const updated = await prisma.user.update({
    where:  { userId },
    data:   { name: name.trim() },
    select: { userId: true, name: true, phone: true, email: true, userType: true },
  });

  return reply.send({ success: true, data: updated });
}

// ── POST /v1/users/me/avatar ─────────────────────────────────
export async function uploadAvatar(
  request: FastifyRequest,
  reply: FastifyReply,
) {
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

  const extMap: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png':  'png',
    'image/webp': 'webp',
  };
  const ext        = extMap[data.mimetype];
  const uploadDir  = process.env.UPLOAD_DIR
    ?? path.join(process.cwd(), 'uploads');
  const avatarsDir = path.join(uploadDir, 'avatars');

  await fs.promises.mkdir(avatarsDir, { recursive: true });

  const filename  = `${userId}.${ext}`;
  const filepath  = path.join(avatarsDir, filename);
  const avatarUrl = `/uploads/avatars/${filename}`;

  await pipeline(data.file, fs.createWriteStream(filepath));

  await prisma.user.update({
    where: { userId },
    data:  { avatarUrl },
  });

  return reply.send({ success: true, data: { avatarUrl } });
}

// ── GET /v1/users/me/stores ──────────────────────────────────
export async function getMyStores(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { userId } = request.authUser;

  const roles = await prisma.userStoreRole.findMany({
    where:   { userId, isActive: true },
    include: {
      store: { select: { storeId: true, name: true, industryType: true, isActive: true } },
    },
    orderBy: { grantedAt: 'asc' },
  });

  return reply.send({
    success: true,
    data: roles.map(r => ({
      storeId:      r.store.storeId,
      storeName:    r.store.name,
      industryType: r.store.industryType,
      isActive:     r.store.isActive,
      role:         r.role,
      permissions:  r.permissions,
    })),
  });
}
