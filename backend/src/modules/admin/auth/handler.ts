import { FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../../lib/prisma';
import { cacheSet, cacheGet } from '../../../lib/redis';
import type { AdminJwtPayload } from '../../../middleware/adminAuth';

const JWT_SECRET = process.env.ADMIN_JWT_SECRET ?? 'change-me-in-production';
const JWT_EXPIRY  = 24 * 60 * 60; // 24 h in seconds

function mergePermissions(
  userRoles: Array<{ role: { permissions: unknown } }>,
): string[] {
  const set = new Set<string>();
  for (const ur of userRoles) {
    const perms = ur.role.permissions as Record<string, boolean>;
    for (const [key, val] of Object.entries(perms)) {
      if (val) set.add(key);
    }
  }
  return Array.from(set);
}

// ── POST /v1/admin/auth/login ─────────────────────────────────
export async function loginAdmin(
  request: FastifyRequest<{ Body: { email: string; password: string } }>,
  reply: FastifyReply,
) {
  const { email, password } = request.body ?? {};

  if (!email || !password) {
    return reply.status(400).send({
      success: false,
      error: { code: 'MISSING_FIELDS', message: 'Email and password required', statusCode: 400 },
    });
  }

  const user = await prisma.platformUser.findUnique({
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

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return reply.status(401).send({
      success: false,
      error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password', statusCode: 401 },
    });
  }

  const permissions = mergePermissions(user.userRoles);
  const jti   = crypto.randomUUID();
  const token = jwt.sign(
    { platformUserId: user.id, email: user.email, permissions, jti },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY },
  );

  return reply.send({
    success: true,
    data: {
      token,
      user: { id: user.id, email: user.email, name: user.name, permissions },
    },
  });
}

// ── POST /v1/admin/auth/logout ────────────────────────────────
export async function logoutAdmin(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const p = request.platformUser;
  if (p?.jti) {
    const remaining = p.exp - Math.floor(Date.now() / 1000);
    if (remaining > 0) {
      await cacheSet(`admin_blacklist:${p.jti}`, '1', remaining);
    }
  }
  return reply.send({ success: true });
}

// ── GET /v1/admin/auth/me ─────────────────────────────────────
export async function meAdmin(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { platformUserId } = request.platformUser;

  const user = await prisma.platformUser.findUnique({
    where: { id: platformUserId },
    select: {
      id:       true,
      email:    true,
      name:     true,
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

  const roles       = user.userRoles.map((ur) => ur.role.name);
  const permissions = mergePermissions(user.userRoles);

  return reply.send({
    success: true,
    data: { id: user.id, email: user.email, name: user.name, roles, permissions },
  });
}
