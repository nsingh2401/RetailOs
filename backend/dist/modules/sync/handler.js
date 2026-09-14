"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncPush = syncPush;
exports.syncPull = syncPull;
exports.getSyncStatus = getSyncStatus;
exports.resolveConflict = resolveConflict;
exports.registerDevice = registerDevice;
exports.updateDevice = updateDevice;
const prisma_1 = require("../../lib/prisma");
const schema_1 = require("./schema");
// UUID regex for safe entity_id queries (DB column is UUID type)
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// ── POST /v1/sync/push ────────────────────────────────────────
async function syncPush(request, reply) {
    const parsed = schema_1.SyncPushSchema.safeParse(request.body);
    if (!parsed.success) {
        return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message, statusCode: 400 } });
    }
    const { deviceId, records } = parsed.data;
    const { userId } = request.authUser;
    // Sort by localSequence to preserve offline ordering
    const sorted = [...records].sort((a, b) => a.localSequence - b.localSequence);
    const results = [];
    let totalSynced = 0;
    let totalFailed = 0;
    let totalDuplicate = 0;
    for (const record of sorted) {
        try {
            // ── a. Deduplication check ─────────────────────────────
            if (UUID_RE.test(record.localId)) {
                const existing = await prisma_1.prisma.syncQueue.findFirst({
                    where: { deviceId, entityId: record.localId, status: 'SYNCED' },
                });
                if (existing) {
                    results.push({ localId: record.localId, status: 'DUPLICATE', serverId: existing.entityId });
                    totalDuplicate++;
                    continue;
                }
            }
            // ── b. Route by entityType ─────────────────────────────
            let serverId;
            switch (record.entityType) {
                // ── INVOICE ──────────────────────────────────────────
                case 'INVOICE': {
                    // Only INSERT supported — check for existing by localId
                    const existingInvoice = await prisma_1.prisma.invoice.findFirst({
                        where: { localId: record.localId, storeId: record.storeId },
                        select: { invoiceId: true },
                    });
                    if (existingInvoice) {
                        results.push({ localId: record.localId, status: 'DUPLICATE', serverId: existingInvoice.invoiceId });
                        totalDuplicate++;
                        continue;
                    }
                    const p = record.payload;
                    const now = new Date();
                    // Auto-generate invoice number if not supplied
                    let invoiceNumber = p.invoiceNumber;
                    if (!invoiceNumber) {
                        const count = await prisma_1.prisma.invoice.count({ where: { storeId: record.storeId } });
                        invoiceNumber = `INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-${String(count + 1).padStart(5, '0')}`;
                    }
                    const invoice = await prisma_1.prisma.invoice.create({
                        data: {
                            storeId: record.storeId,
                            invoiceNumber,
                            invoiceDate: p.invoiceDate ? new Date(p.invoiceDate) : now,
                            currencyCode: p.currencyCode || 'INR',
                            subtotal: Number(p.subtotal ?? 0),
                            taxTotal: Number(p.taxTotal ?? 0),
                            discountTotal: Number(p.discountTotal ?? 0),
                            grandTotal: Number(p.grandTotal ?? 0),
                            grandTotalBase: Number(p.grandTotalBase ?? p.grandTotal ?? 0),
                            paymentMode: p.paymentMode ?? null,
                            status: 'DRAFT',
                            billedBy: userId,
                            localId: record.localId,
                            deviceId,
                            syncedAt: now,
                        },
                    });
                    serverId = invoice.invoiceId;
                    break;
                }
                // ── CUSTOMER ──────────────────────────────────────────
                case 'CUSTOMER': {
                    const p = record.payload;
                    if (record.operation === 'INSERT') {
                        const customer = await prisma_1.prisma.customer.create({
                            data: {
                                storeId: record.storeId,
                                name: p.name,
                                phone: p.phone || undefined,
                                email: p.email || undefined,
                                notes: p.notes || undefined,
                                creditLimit: p.creditLimit ? Number(p.creditLimit) : 0,
                            },
                        });
                        serverId = customer.customerId;
                    }
                    else {
                        // UPDATE — serverId or customerId in payload identifies the record
                        const customerId = (p.customerId ?? p.serverId);
                        const updateData = {};
                        if (p.name !== undefined)
                            updateData.name = p.name;
                        if (p.phone !== undefined)
                            updateData.phone = p.phone;
                        if (p.email !== undefined)
                            updateData.email = p.email;
                        if (p.notes !== undefined)
                            updateData.notes = p.notes;
                        if (p.creditLimit !== undefined)
                            updateData.creditLimit = Number(p.creditLimit);
                        await prisma_1.prisma.customer.update({ where: { customerId }, data: updateData });
                        serverId = customerId;
                    }
                    break;
                }
                // ── PAYMENT ───────────────────────────────────────────
                case 'PAYMENT': {
                    const p = record.payload;
                    const payment = await prisma_1.prisma.payment.create({
                        data: {
                            invoiceId: p.invoiceId,
                            storeId: record.storeId,
                            paymentMethod: p.paymentMethod,
                            amount: Number(p.amount),
                            currencyCode: p.currencyCode || 'INR',
                            referenceNo: p.referenceNo || undefined,
                            recordedBy: userId,
                            syncedAt: new Date(),
                        },
                    });
                    serverId = payment.paymentId;
                    break;
                }
                // ── PURCHASE_ENTRY ────────────────────────────────────
                case 'PURCHASE_ENTRY': {
                    const p = record.payload;
                    const purchase = await prisma_1.prisma.purchaseEntry.create({
                        data: {
                            storeId: record.storeId,
                            purchaseDate: new Date(p.purchaseDate),
                            currencyCode: p.currencyCode || 'INR',
                            totalAmount: Number(p.totalAmount),
                            totalAmountBase: Number(p.totalAmountBase),
                            notes: p.notes || undefined,
                            createdBy: userId,
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
            await prisma_1.prisma.syncQueue.create({
                data: {
                    deviceId,
                    storeId: record.storeId,
                    entityType: record.entityType,
                    entityId: serverId,
                    operation: record.operation,
                    payload: record.payload,
                    localSequence: BigInt(record.localSequence),
                    status: 'SYNCED',
                    syncedAt: new Date(),
                },
            });
            results.push({ localId: record.localId, status: 'SYNCED', serverId });
            totalSynced++;
        }
        catch (err) {
            // ── d. Per-record failure — do not abort remaining records
            results.push({ localId: record.localId, status: 'FAILED', error: err.message ?? 'Unknown error' });
            totalFailed++;
        }
    }
    // Update device last_seen_at (non-fatal if device not registered yet)
    await prisma_1.prisma.deviceRegistry.updateMany({
        where: { deviceId },
        data: { lastSeenAt: new Date() },
    });
    return reply.send({
        success: true,
        data: { results, totalSynced, totalFailed, totalDuplicate },
    });
}
// ── GET /v1/sync/pull ─────────────────────────────────────────
async function syncPull(request, reply) {
    const parsed = schema_1.SyncPullQuerySchema.safeParse(request.query);
    if (!parsed.success) {
        return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message, statusCode: 400 } });
    }
    const { since, storeId } = parsed.data;
    const sinceDate = new Date(since);
    const serverTimestamp = new Date();
    const [products, variants, customers, invoices] = await Promise.all([
        // a. Products updated after sinceDate for this store
        prisma_1.prisma.product.findMany({
            where: { storeId, isActive: true, updatedAt: { gt: sinceDate } },
            select: {
                productId: true,
                name: true,
                sellingPrice: true,
                isActive: true,
                updatedAt: true,
            },
            take: 200,
        }),
        // b. Product variants — filter via product.updatedAt (variant has no updatedAt)
        prisma_1.prisma.productVariant.findMany({
            where: {
                storeId,
                isActive: true,
                product: { isActive: true, updatedAt: { gt: sinceDate } },
            },
            select: {
                variantId: true,
                variantSku: true,
                stockQuantity: true,
                isActive: true,
                product: { select: { name: true } },
            },
            take: 500,
        }),
        // c. Customers updated after sinceDate
        prisma_1.prisma.customer.findMany({
            where: { storeId, updatedAt: { gt: sinceDate } },
            select: {
                customerId: true,
                name: true,
                phone: true,
                outstandingBalance: true,
                updatedAt: true,
            },
            take: 200,
        }),
        // d. Invoices created after sinceDate (Invoice has no updatedAt)
        prisma_1.prisma.invoice.findMany({
            where: { storeId, createdAt: { gt: sinceDate } },
            select: { invoiceId: true, status: true, paidAmount: true, createdAt: true },
            take: 200,
        }),
    ]);
    return reply.send({
        success: true,
        data: {
            serverTimestamp: serverTimestamp.toISOString(),
            since,
            changes: {
                products: products.map(p => ({ ...p, _op: 'UPDATE' })),
                variants: variants.map(v => ({ ...v, _op: 'UPDATE' })),
                customers: customers.map(c => ({ ...c, _op: 'UPDATE' })),
                invoices: invoices.map(i => ({ ...i, updatedAt: i.createdAt, _op: 'UPDATE' })),
            },
            counts: {
                products: products.length,
                variants: variants.length,
                customers: customers.length,
                invoices: invoices.length,
            },
            hasMore: false,
        },
    });
}
// ── GET /v1/sync/status/:deviceId ─────────────────────────────
async function getSyncStatus(request, reply) {
    const { deviceId } = request.params;
    const [pendingRecords, conflictRecords, device] = await Promise.all([
        prisma_1.prisma.syncQueue.count({
            where: { deviceId, status: { in: ['PENDING', 'FAILED'] } },
        }),
        prisma_1.prisma.syncQueue.count({
            where: { deviceId, status: 'CONFLICT' },
        }),
        prisma_1.prisma.deviceRegistry.findUnique({ where: { deviceId } }),
    ]);
    return reply.send({
        success: true,
        data: {
            deviceId,
            pendingRecords,
            conflictRecords,
            lastSyncAt: device?.lastSyncAt ?? null,
            lastSeenAt: device?.lastSeenAt ?? null,
            isActive: device?.isActive ?? false,
        },
    });
}
// ── POST /v1/sync/resolve-conflict ────────────────────────────
async function resolveConflict(request, reply) {
    // MANAGER or OWNER required
    if (request.authUser.userType !== 'OWNER' && request.authUser.userType !== 'MANAGER') {
        return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'MANAGER or OWNER role required', statusCode: 403 } });
    }
    const parsed = schema_1.ResolveConflictSchema.safeParse(request.body);
    if (!parsed.success) {
        return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message, statusCode: 400 } });
    }
    const { syncId, resolution, resolvedPayload } = parsed.data;
    const syncRecord = await prisma_1.prisma.syncQueue.findUnique({ where: { syncId } });
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
    await prisma_1.prisma.syncQueue.update({
        where: { syncId },
        data: { status: 'SYNCED', syncedAt: resolvedAt },
    });
    return reply.send({
        success: true,
        data: { syncId, resolution, resolvedAt },
    });
}
// ── POST /v1/devices/register ─────────────────────────────────
async function registerDevice(request, reply) {
    const parsed = schema_1.RegisterDeviceSchema.safeParse(request.body);
    if (!parsed.success) {
        return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message, statusCode: 400 } });
    }
    const { deviceId, storeId, platform, appVersion, deviceName } = parsed.data;
    const { userId } = request.authUser;
    const device = await prisma_1.prisma.deviceRegistry.upsert({
        where: { deviceId },
        create: { deviceId, storeId, userId, platform, appVersion, deviceName, lastSeenAt: new Date() },
        update: { userId, appVersion, lastSeenAt: new Date(), isActive: true },
    });
    return reply.status(201).send({ success: true, data: device });
}
// ── PATCH /v1/devices/:deviceId ───────────────────────────────
async function updateDevice(request, reply) {
    const { deviceId } = request.params;
    const parsed = schema_1.UpdateDeviceSchema.safeParse(request.body);
    if (!parsed.success) {
        return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message, statusCode: 400 } });
    }
    const { appVersion, userId } = parsed.data;
    try {
        const device = await prisma_1.prisma.deviceRegistry.update({
            where: { deviceId },
            data: {
                lastSeenAt: new Date(),
                ...(appVersion && { appVersion }),
                ...(userId && { userId }),
            },
        });
        return reply.send({ success: true, data: device });
    }
    catch (err) {
        if (err.code === 'P2025') {
            return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Device not found', statusCode: 404 } });
        }
        throw err;
    }
}
//# sourceMappingURL=handler.js.map