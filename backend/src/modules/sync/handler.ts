import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../../lib/prisma';
import {
  SyncPushSchema,
  SyncPullQuerySchema,
  ResolveConflictSchema,
  RegisterDeviceSchema,
  UpdateDeviceSchema,
} from './schema';
import type {
  SyncPushInput,
  SyncPullQuery,
  ResolveConflictInput,
  RegisterDeviceInput,
  UpdateDeviceInput,
} from './schema';

// UUID regex for safe entity_id queries (DB column is UUID type)
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type SyncResultEntry =
  | { localId: string; status: 'SYNCED';     serverId: string }
  | { localId: string; status: 'DUPLICATE';  serverId: string }
  | { localId: string; status: 'SKIPPED';    reason: string  }
  | { localId: string; status: 'FAILED';     error: string   };

// ── POST /v1/sync/push ────────────────────────────────────────
export async function syncPush(
  request: FastifyRequest<{ Body: SyncPushInput }>,
  reply: FastifyReply,
) {
  const parsed = SyncPushSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message, statusCode: 400 } });
  }
  const { deviceId, records } = parsed.data;
  const { userId } = request.authUser;

  // Sort by localSequence to preserve offline ordering
  const sorted = [...records].sort((a, b) => a.localSequence - b.localSequence);

  const results: SyncResultEntry[] = [];
  let totalSynced    = 0;
  let totalFailed    = 0;
  let totalDuplicate = 0;

  for (const record of sorted) {
    try {
      // ── a. Deduplication check ─────────────────────────────
      if (UUID_RE.test(record.localId)) {
        const existing = await prisma.syncQueue.findFirst({
          where: { deviceId, entityId: record.localId, status: 'SYNCED' },
        });
        if (existing) {
          results.push({ localId: record.localId, status: 'DUPLICATE', serverId: existing.entityId });
          totalDuplicate++;
          continue;
        }
      }

      // ── b. Route by entityType ─────────────────────────────
      let serverId: string;

      switch (record.entityType) {

        // ── INVOICE ──────────────────────────────────────────
        case 'INVOICE': {
          // Only INSERT supported — check for existing by localId
          const existingInvoice = await prisma.invoice.findFirst({
            where:  { localId: record.localId, storeId: record.storeId },
            select: { invoiceId: true },
          });
          if (existingInvoice) {
            results.push({ localId: record.localId, status: 'DUPLICATE', serverId: existingInvoice.invoiceId });
            totalDuplicate++;
            continue;
          }

          const p   = record.payload;
          const now = new Date();

          // Auto-generate invoice number if not supplied
          let invoiceNumber = p.invoiceNumber as string | undefined;
          if (!invoiceNumber) {
            const count = await prisma.invoice.count({ where: { storeId: record.storeId } });
            invoiceNumber = `INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-${String(count + 1).padStart(5, '0')}`;
          }

          const invoice = await prisma.invoice.create({
            data: {
              storeId:        record.storeId,
              invoiceNumber,
              invoiceDate:    p.invoiceDate ? new Date(p.invoiceDate as string) : now,
              currencyCode:   (p.currencyCode as string) || 'INR',
              subtotal:       Number(p.subtotal ?? 0),
              taxTotal:       Number(p.taxTotal ?? 0),
              discountTotal:  Number(p.discountTotal ?? 0),
              grandTotal:     Number(p.grandTotal ?? 0),
              grandTotalBase: Number(p.grandTotalBase ?? p.grandTotal ?? 0),
              paymentMode:    (p.paymentMode as any) ?? null,
              status:         'DRAFT',
              billedBy:       userId,
              localId:        record.localId,
              deviceId,
              syncedAt:       now,
            },
          });
          serverId = invoice.invoiceId;
          break;
        }

        // ── CUSTOMER ──────────────────────────────────────────
        case 'CUSTOMER': {
          const p = record.payload;

          if (record.operation === 'INSERT') {
            const customer = await prisma.customer.create({
              data: {
                storeId:    record.storeId,
                name:       p.name as string,
                phone:      (p.phone  as string) || undefined,
                email:      (p.email  as string) || undefined,
                notes:      (p.notes  as string) || undefined,
                creditLimit: p.creditLimit ? Number(p.creditLimit) : 0,
              },
            });
            serverId = customer.customerId;
          } else {
            // UPDATE — serverId or customerId in payload identifies the record
            const customerId = (p.customerId ?? p.serverId) as string;
            const updateData: Record<string, unknown> = {};
            if (p.name        !== undefined) updateData.name        = p.name        as string;
            if (p.phone       !== undefined) updateData.phone       = p.phone       as string;
            if (p.email       !== undefined) updateData.email       = p.email       as string;
            if (p.notes       !== undefined) updateData.notes       = p.notes       as string;
            if (p.creditLimit !== undefined) updateData.creditLimit = Number(p.creditLimit);
            await prisma.customer.update({ where: { customerId }, data: updateData as any });
            serverId = customerId;
          }
          break;
        }

        // ── PAYMENT ───────────────────────────────────────────
        case 'PAYMENT': {
          const p = record.payload;
          const payment = await prisma.payment.create({
            data: {
              invoiceId:     p.invoiceId    as string,
              storeId:       record.storeId,
              paymentMethod: p.paymentMethod as any,
              amount:        Number(p.amount),
              currencyCode:  (p.currencyCode as string) || 'INR',
              referenceNo:   (p.referenceNo as string) || undefined,
              recordedBy:    userId,
              syncedAt:      new Date(),
            },
          });
          serverId = payment.paymentId;
          break;
        }

        // ── PURCHASE_ENTRY ────────────────────────────────────
        case 'PURCHASE_ENTRY': {
          const p = record.payload;
          const purchase = await prisma.purchaseEntry.create({
            data: {
              storeId:         record.storeId,
              purchaseDate:    new Date(p.purchaseDate as string),
              currencyCode:    (p.currencyCode as string) || 'INR',
              totalAmount:     Number(p.totalAmount),
              totalAmountBase: Number(p.totalAmountBase),
              notes:           (p.notes as string) || undefined,
              createdBy:       userId,
            },
          });
          serverId = purchase.purchaseId;
          break;
        }

        // ── INVENTORY_MOVEMENT ────────────────────────────────
        case 'INVENTORY_MOVEMENT': {
          results.push({ localId: record.localId, status: 'SKIPPED', reason: 'Inventory movements sync not supported' });
          continue;
        }

        default: {
          results.push({ localId: record.localId, status: 'SKIPPED', reason: 'Unknown entity type' });
          continue;
        }
      }

      // ── c. Record successful sync in sync_queue ────────────
      await prisma.syncQueue.create({
        data: {
          deviceId,
          storeId:       record.storeId,
          entityType:    record.entityType as any,
          entityId:      serverId,
          operation:     record.operation as any,
          payload:       record.payload as any,
          localSequence: BigInt(record.localSequence),
          status:        'SYNCED',
          syncedAt:      new Date(),
        },
      });

      results.push({ localId: record.localId, status: 'SYNCED', serverId });
      totalSynced++;

    } catch (err: any) {
      // ── d. Per-record failure — do not abort remaining records
      results.push({ localId: record.localId, status: 'FAILED', error: err.message ?? 'Unknown error' });
      totalFailed++;
    }
  }

  // Update device last_seen_at (non-fatal if device not registered yet)
  await prisma.deviceRegistry.updateMany({
    where: { deviceId },
    data:  { lastSeenAt: new Date() },
  });

  return reply.send({
    success: true,
    data: { results, totalSynced, totalFailed, totalDuplicate },
  });
}

// ── GET /v1/sync/pull ─────────────────────────────────────────
export async function syncPull(
  request: FastifyRequest<{ Querystring: SyncPullQuery }>,
  reply: FastifyReply,
) {
  const parsed = SyncPullQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message, statusCode: 400 } });
  }
  const { since, storeId } = parsed.data;
  const sinceDate          = new Date(since);
  const serverTimestamp    = new Date();

  const [products, variants, customers, invoices] = await Promise.all([

    // a. Products updated after sinceDate for this store
    prisma.product.findMany({
      where: { storeId, isActive: true, updatedAt: { gt: sinceDate } },
      select: {
        productId:    true,
        name:         true,
        sellingPrice: true,
        isActive:     true,
        updatedAt:    true,
      },
      take: 200,
    }),

    // b. Product variants — filter via product.updatedAt (variant has no updatedAt)
    prisma.productVariant.findMany({
      where: {
        storeId,
        isActive: true,
        product: { isActive: true, updatedAt: { gt: sinceDate } },
      },
      select: {
        variantId:         true,
        variantSku:        true,
        stockQuantity:     true,
        isActive:          true,
        product:           { select: { name: true } },
      },
      take: 500,
    }),

    // c. Customers updated after sinceDate
    prisma.customer.findMany({
      where: { storeId, updatedAt: { gt: sinceDate } },
      select: {
        customerId:         true,
        name:               true,
        phone:              true,
        outstandingBalance: true,
        updatedAt:          true,
      },
      take: 200,
    }),

    // d. Invoices created after sinceDate (Invoice has no updatedAt)
    prisma.invoice.findMany({
      where:  { storeId, createdAt: { gt: sinceDate } },
      select: { invoiceId: true, status: true, paidAmount: true, createdAt: true },
      take:   200,
    }),
  ]);

  return reply.send({
    success: true,
    data: {
      serverTimestamp: serverTimestamp.toISOString(),
      since,
      changes: {
        products:  products.map(p => ({ ...p, _op: 'UPDATE' })),
        variants:  variants.map(v => ({ ...v, _op: 'UPDATE' })),
        customers: customers.map(c => ({ ...c, _op: 'UPDATE' })),
        invoices:  invoices.map(i => ({ ...i, updatedAt: i.createdAt, _op: 'UPDATE' })),
      },
      counts: {
        products:  products.length,
        variants:  variants.length,
        customers: customers.length,
        invoices:  invoices.length,
      },
      hasMore: false,
    },
  });
}

// ── GET /v1/sync/status/:deviceId ─────────────────────────────
export async function getSyncStatus(
  request: FastifyRequest<{ Params: { deviceId: string } }>,
  reply: FastifyReply,
) {
  const { deviceId } = request.params;

  const [pendingRecords, conflictRecords, device] = await Promise.all([
    prisma.syncQueue.count({
      where: { deviceId, status: { in: ['PENDING', 'FAILED'] } },
    }),
    prisma.syncQueue.count({
      where: { deviceId, status: 'CONFLICT' },
    }),
    prisma.deviceRegistry.findUnique({ where: { deviceId } }),
  ]);

  return reply.send({
    success: true,
    data: {
      deviceId,
      pendingRecords,
      conflictRecords,
      lastSyncAt: device?.lastSyncAt   ?? null,
      lastSeenAt: device?.lastSeenAt   ?? null,
      isActive:   device?.isActive     ?? false,
    },
  });
}

// ── POST /v1/sync/resolve-conflict ────────────────────────────
export async function resolveConflict(
  request: FastifyRequest<{ Body: ResolveConflictInput }>,
  reply: FastifyReply,
) {
  // MANAGER or OWNER required
  if (request.authUser.userType !== 'OWNER' && request.authUser.userType !== 'MANAGER') {
    return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'MANAGER or OWNER role required', statusCode: 403 } });
  }

  const parsed = ResolveConflictSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message, statusCode: 400 } });
  }
  const { syncId, resolution, resolvedPayload } = parsed.data;

  const syncRecord = await prisma.syncQueue.findUnique({ where: { syncId } });
  if (!syncRecord || syncRecord.status !== 'CONFLICT') {
    return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Conflict record not found', statusCode: 404 } });
  }

  if (resolution === 'CLIENT_WINS' && resolvedPayload) {
    // Apply resolved payload to the entity based on entityType
    // Full per-entity implementation deferred; mark as resolved for now
    // (the payload can be re-processed by a worker if needed)
  }
  // SERVER_WINS: entity already has the correct server state — no update needed

  const resolvedAt = new Date();
  await prisma.syncQueue.update({
    where: { syncId },
    data:  { status: 'SYNCED', syncedAt: resolvedAt },
  });

  return reply.send({
    success: true,
    data: { syncId, resolution, resolvedAt },
  });
}

// ── POST /v1/devices/register ─────────────────────────────────
export async function registerDevice(
  request: FastifyRequest<{ Body: RegisterDeviceInput }>,
  reply: FastifyReply,
) {
  const parsed = RegisterDeviceSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message, statusCode: 400 } });
  }
  const { deviceId, storeId, platform, appVersion, deviceName } = parsed.data;
  const { userId } = request.authUser;

  const device = await prisma.deviceRegistry.upsert({
    where:  { deviceId },
    create: { deviceId, storeId, userId, platform, appVersion, deviceName, lastSeenAt: new Date() },
    update: { userId, appVersion, lastSeenAt: new Date(), isActive: true },
  });

  return reply.status(201).send({ success: true, data: device });
}

// ── PATCH /v1/devices/:deviceId ───────────────────────────────
export async function updateDevice(
  request: FastifyRequest<{ Params: { deviceId: string }; Body: UpdateDeviceInput }>,
  reply: FastifyReply,
) {
  const { deviceId } = request.params;

  const parsed = UpdateDeviceSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message, statusCode: 400 } });
  }
  const { appVersion, userId } = parsed.data;

  try {
    const device = await prisma.deviceRegistry.update({
      where: { deviceId },
      data: {
        lastSeenAt: new Date(),
        ...(appVersion && { appVersion }),
        ...(userId     && { userId }),
      },
    });
    return reply.send({ success: true, data: device });
  } catch (err: any) {
    if (err.code === 'P2025') {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Device not found', statusCode: 404 } });
    }
    throw err;
  }
}
