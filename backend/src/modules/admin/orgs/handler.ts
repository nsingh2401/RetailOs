import { FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { prisma } from '../../../lib/prisma';
import { provisionStoreCategories } from '../../../services/categoryProvisioning';

// ── GET /v1/admin/orgs ────────────────────────────────────────
export async function listOrgs(
  request: FastifyRequest<{
    Querystring: {
      page?:         string;
      limit?:        string;
      search?:       string;
      isActive?:     string;
      industryType?: string;
    };
  }>,
  reply: FastifyReply,
) {
  const page         = Math.max(1, parseInt(request.query.page  ?? '1',  10));
  const limit        = Math.min(100, Math.max(1, parseInt(request.query.limit ?? '20', 10)));
  const search       = (request.query.search ?? '').trim();
  const isActive     = request.query.isActive;
  const industryType = (request.query.industryType ?? '').trim();

  const where: Record<string, unknown> = {};
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { slug: { contains: search, mode: 'insensitive' } },
    ];
  }
  if (isActive === 'true')  where.isActive = true;
  if (isActive === 'false') where.isActive = false;
  if (industryType)         where.stores   = { some: { industryType } };

  const [orgs, total] = await prisma.$transaction([
    prisma.organization.findMany({
      where,
      include: {
        _count: { select: { stores: true, users: true } },
        users: {
          where:   { userType: 'OWNER' },
          select:  { name: true, phone: true },
          take:    1,
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip:  (page - 1) * limit,
      take:  limit,
    }),
    prisma.organization.count({ where }),
  ]);

  return reply.send({
    success: true,
    data: {
      items: orgs.map((o) => ({
        orgId:      o.orgId,
        name:       o.name,
        slug:       o.slug,
        planId:     o.planId,
        isActive:   o.isActive,
        createdAt:  o.createdAt,
        storeCount: o._count.stores,
        userCount:  o._count.users,
        ownerName:  o.users[0]?.name  ?? null,
        ownerPhone: o.users[0]?.phone ?? null,
      })),
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    },
  });
}

// ── GET /v1/admin/orgs/:orgId ─────────────────────────────────
export async function getOrg(
  request: FastifyRequest<{ Params: { orgId: string } }>,
  reply: FastifyReply,
) {
  const { orgId } = request.params;

  const org = await prisma.organization.findUnique({
    where: { orgId },
    include: {
      stores: {
        select: {
          storeId:      true,
          name:         true,
          storeCode:    true,
          industryType: true,
          isActive:     true,
          createdAt:    true,
        },
        orderBy: { createdAt: 'asc' },
      },
      users: {
        select: {
          userId:    true,
          name:      true,
          phone:     true,
          email:     true,
          userType:  true,
          isActive:  true,
          createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!org) {
    return reply.status(404).send({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Organization not found', statusCode: 404 },
    });
  }

  return reply.send({ success: true, data: org });
}

// ── POST /v1/admin/orgs ───────────────────────────────────────
export async function createOrg(
  request: FastifyRequest<{
    Body: {
      orgName:       string;
      storeName:     string;
      industryType:  string;
      ownerName:     string;
      ownerPhone:    string;
      ownerPassword: string;
      planId?:       string;
    };
  }>,
  reply: FastifyReply,
) {
  const {
    orgName, storeName, industryType,
    ownerName, ownerPhone, ownerPassword,
    planId,
  } = request.body ?? {};

  if (!orgName || !storeName || !industryType ||
      !ownerName || !ownerPhone || !ownerPassword) {
    return reply.status(400).send({
      success: false,
      error: { code: 'MISSING_FIELDS', message: 'All fields are required', statusCode: 400 },
    });
  }

  const existingUser = await prisma.user.findUnique({
    where:  { phone: ownerPhone },
    select: { userId: true },
  });
  if (existingUser) {
    return reply.status(409).send({
      success: false,
      error: { code: 'PHONE_TAKEN', message: 'A user with this phone already exists', statusCode: 409 },
    });
  }

  const passwordHash = await bcrypt.hash(ownerPassword, 12);

  const slug = orgName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    + '-' + randomBytes(2).toString('hex');

  const storeCode = storeName
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 4)
    .padEnd(4, 'X')
    + (1000 + Math.floor(Math.random() * 9000)).toString();

  try {
    const result = await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name:            orgName,
          slug,
          planId:          planId ?? 'free',
          countryCode:     'IN',
          defaultCurrency: 'INR',
          taxRegime:       'GST',
          locale:          'en-IN',
        },
      });

      const user = await tx.user.create({
        data: {
          orgId:        org.orgId,
          name:         ownerName,
          phone:        ownerPhone,
          userType:     'OWNER',
          passwordHash,
        },
      });

      const store = await tx.store.create({
        data: {
          orgId:        org.orgId,
          name:         storeName,
          storeCode,
          industryType: industryType as any,
          currencyCode: 'INR',
          timezone:     'Asia/Kolkata',
        },
      });

      await tx.userStoreRole.create({
        data: {
          userId:    user.userId,
          storeId:   store.storeId,
          role:      'OWNER',
          grantedBy: user.userId,
          isActive:  true,
        },
      });

      await provisionStoreCategories(store.storeId, industryType, tx);

      return { org, user, store };
    });

    return reply.status(201).send({
      success: true,
      data: {
        orgId:      result.org.orgId,
        name:       result.org.name,
        slug:       result.org.slug,
        planId:     result.org.planId,
        storeId:    result.store.storeId,
        storeCode:  result.store.storeCode,
        ownerId:    result.user.userId,
        ownerPhone: result.user.phone,
      },
    });
  } catch (err: any) {
    if (err.code === 'P2002') {
      return reply.status(409).send({
        success: false,
        error: {
          code:       'CONFLICT',
          message:    'Duplicate slug or storeCode — try a different name',
          statusCode: 409,
        },
      });
    }
    throw err;
  }
}

// ── PATCH /v1/admin/orgs/:orgId ───────────────────────────────
export async function updateOrg(
  request: FastifyRequest<{
    Params: { orgId: string };
    Body:   { planId?: string; isActive?: boolean };
  }>,
  reply: FastifyReply,
) {
  const { orgId } = request.params;
  const { planId, isActive } = request.body ?? {};

  const data: Record<string, unknown> = {};
  if (planId   !== undefined) data.planId   = planId;
  if (isActive !== undefined) data.isActive = isActive;

  if (Object.keys(data).length === 0) {
    return reply.status(400).send({
      success: false,
      error: { code: 'NO_FIELDS', message: 'No fields to update', statusCode: 400 },
    });
  }

  try {
    const org = await prisma.organization.update({
      where:  { orgId },
      data,
      select: {
        orgId:     true,
        name:      true,
        planId:    true,
        isActive:  true,
        updatedAt: true,
      },
    });
    return reply.send({ success: true, data: org });
  } catch (err: any) {
    if (err.code === 'P2025') {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Organization not found', statusCode: 404 },
      });
    }
    throw err;
  }
}
