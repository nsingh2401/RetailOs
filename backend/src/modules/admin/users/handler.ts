import { FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcryptjs';
import { prisma } from '../../../lib/prisma';

// ── GET /v1/admin/users ───────────────────────────────────────────
export async function listUsers(
  request: FastifyRequest<{
    Querystring: { page?: string; limit?: string; search?: string; isActive?: string };
  }>,
  reply: FastifyReply,
) {
  const page    = Math.max(1, parseInt(request.query.page  ?? '1',  10));
  const limit   = Math.min(100, Math.max(1, parseInt(request.query.limit ?? '20', 10)));
  const search  = (request.query.search ?? '').trim();
  const isActive = request.query.isActive;

  const where: Record<string, unknown> = {};
  if (search) {
    where.OR = [
      { name:  { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ];
  }
  if (isActive === 'true')  where.isActive = true;
  if (isActive === 'false') where.isActive = false;

  const [users, total] = await Promise.all([
    prisma.platformUser.findMany({
      where,
      include: {
        userRoles: {
          include: {
            role: { select: { id: true, name: true, permissions: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip:  (page - 1) * limit,
      take:  limit,
    }),
    prisma.platformUser.count({ where }),
  ]);

  return reply.send({
    success: true,
    data: {
      items: users.map((u) => ({
        id:        u.id,
        name:      u.name,
        email:     u.email,
        isActive:  u.isActive,
        createdAt: u.createdAt,
        roles:     u.userRoles.map((ur) => ({
          id:          ur.role.id,
          name:        ur.role.name,
          permissions: ur.role.permissions,
        })),
      })),
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    },
  });
}

// ── POST /v1/admin/users ──────────────────────────────────────────
export async function createUser(
  request: FastifyRequest<{
    Body: { name: string; email: string; password: string; roleIds?: string[] };
  }>,
  reply: FastifyReply,
) {
  const { name, email, password, roleIds = [] } = request.body ?? {};

  if (!name || !email || !password) {
    return reply.status(400).send({
      success: false,
      error: { code: 'MISSING_FIELDS', message: 'name, email and password are required', statusCode: 400 },
    });
  }

  const existing = await prisma.platformUser.findUnique({
    where: { email: email.toLowerCase().trim() },
    select: { id: true },
  });
  if (existing) {
    return reply.status(409).send({
      success: false,
      error: { code: 'EMAIL_TAKEN', message: 'A user with this email already exists', statusCode: 409 },
    });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.$transaction(async (tx) => {
    const u = await tx.platformUser.create({
      data: { name: name.trim(), email: email.toLowerCase().trim(), passwordHash },
    });
    if (roleIds.length > 0) {
      await tx.platformUserRole.createMany({
        data: roleIds.map((roleId) => ({ userId: u.id, roleId })),
        skipDuplicates: true,
      });
    }
    return u;
  });

  return reply.status(201).send({
    success: true,
    data: { id: user.id, name: user.name, email: user.email, isActive: user.isActive },
  });
}

// ── PATCH /v1/admin/users/:userId ────────────────────────────────
export async function updateUser(
  request: FastifyRequest<{
    Params: { userId: string };
    Body:   { name?: string; email?: string; isActive?: boolean; roleIds?: string[] };
  }>,
  reply: FastifyReply,
) {
  const { userId } = request.params;
  const { name, email, isActive, roleIds } = request.body ?? {};

  const user = await prisma.platformUser.findUnique({
    where: { id: userId }, select: { id: true },
  });
  if (!user) {
    return reply.status(404).send({
      success: false,
      error: { code: 'NOT_FOUND', message: 'User not found', statusCode: 404 },
    });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const data: Record<string, unknown> = {};
    if (name     !== undefined) data.name     = name.trim();
    if (email    !== undefined) data.email    = email.toLowerCase().trim();
    if (isActive !== undefined) data.isActive = isActive;

    const u = Object.keys(data).length > 0
      ? await tx.platformUser.update({ where: { id: userId }, data })
      : await tx.platformUser.findUniqueOrThrow({ where: { id: userId } });

    if (roleIds !== undefined) {
      await tx.platformUserRole.deleteMany({ where: { userId } });
      if (roleIds.length > 0) {
        await tx.platformUserRole.createMany({
          data: roleIds.map((roleId) => ({ userId, roleId })),
          skipDuplicates: true,
        });
      }
    }
    return u;
  });

  return reply.send({ success: true, data: { id: updated.id, name: updated.name, email: updated.email, isActive: updated.isActive } });
}

// ── POST /v1/admin/users/:userId/reset-password ───────────────────
export async function resetPassword(
  request: FastifyRequest<{
    Params: { userId: string };
    Body:   { newPassword: string };
  }>,
  reply: FastifyReply,
) {
  const { userId }     = request.params;
  const { newPassword } = request.body ?? {};

  if (!newPassword || newPassword.length < 6) {
    return reply.status(400).send({
      success: false,
      error: { code: 'WEAK_PASSWORD', message: 'Password must be at least 6 characters', statusCode: 400 },
    });
  }

  try {
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.platformUser.update({
      where: { id: userId },
      data:  { passwordHash },
    });
    return reply.send({ success: true });
  } catch (err: any) {
    if (err.code === 'P2025') {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'User not found', statusCode: 404 },
      });
    }
    throw err;
  }
}

// ── DELETE /v1/admin/users/:userId ────────────────────────────────
export async function deleteUser(
  request: FastifyRequest<{ Params: { userId: string } }>,
  reply: FastifyReply,
) {
  const { userId } = request.params;

  if (userId === request.platformUser.platformUserId) {
    return reply.status(400).send({
      success: false,
      error: { code: 'SELF_DELETE', message: 'Cannot deactivate your own account', statusCode: 400 },
    });
  }

  try {
    await prisma.platformUser.update({ where: { id: userId }, data: { isActive: false } });
    return reply.status(204).send();
  } catch (err: any) {
    if (err.code === 'P2025') {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'User not found', statusCode: 404 },
      });
    }
    throw err;
  }
}
