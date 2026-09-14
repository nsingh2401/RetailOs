"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createInvoice = createInvoice;
exports.confirmInvoice = confirmInvoice;
exports.recordPayment = recordPayment;
exports.listInvoices = listInvoices;
exports.getInvoice = getInvoice;
exports.cancelInvoice = cancelInvoice;
const prisma_1 = require("../../lib/prisma");
const lowStockWorker_1 = require("../../jobs/lowStockWorker");
const schema_1 = require("./schema");
// ── POST /v1/stores/:storeId/invoices ─────────────────────────
async function createInvoice(request, reply) {
    const storeId = request.storeId;
    const { userId } = request.authUser;
    const parsed = schema_1.CreateInvoiceSchema.safeParse(request.body);
    if (!parsed.success) {
        return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message, statusCode: 400 } });
    }
    const body = parsed.data;
    // Deduplicate offline invoices via localId
    if (body.localId) {
        const existing = await prisma_1.prisma.invoice.findFirst({ where: { localId: body.localId, storeId } });
        if (existing)
            return reply.status(200).send({ success: true, data: existing });
    }
    // Auto-generate invoice number: INV-YYYYMM-XXXXX
    const count = await prisma_1.prisma.invoice.count({ where: { storeId } });
    const now = new Date();
    const invoiceDate = body.invoiceDate
        ? new Date(`${body.invoiceDate}T12:00:00.000Z`)
        : new Date(`${now.toISOString().slice(0, 10)}T12:00:00.000Z`);
    const invoiceNumber = body.invoiceNumber
        ?? `INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-${String(count + 1).padStart(5, '0')}`;
    // Fetch product name snapshots for all variants
    const variantIds = [...new Set(body.lineItems.map(i => i.variantId))];
    const variants = await prisma_1.prisma.productVariant.findMany({
        where: { variantId: { in: variantIds } },
        include: { product: { include: { taxRule: true } } },
    });
    const variantMap = new Map(variants.map(v => [v.variantId, v]));
    // Calculate totals
    let subtotal = 0, taxTotal = 0, discountTotal = 0;
    const lineData = body.lineItems.map(item => {
        const v = variantMap.get(item.variantId);
        const lineSubtotal = item.unitPrice * item.quantity;
        const discountAmt = item.discountPct > 0
            ? lineSubtotal * (item.discountPct / 100)
            : (item.discountAmount ?? 0);
        const taxableAmt = lineSubtotal - discountAmt;
        const totalRate = Number(v?.product?.taxRule?.totalRate ?? 0);
        const taxAmt = taxableAmt * (totalRate / 100);
        const taxBreakdown = totalRate > 0
            ? { CGST: { rate: totalRate / 2, amount: taxAmt / 2 },
                SGST: { rate: totalRate / 2, amount: taxAmt / 2 } }
            : {};
        subtotal += lineSubtotal;
        discountTotal += discountAmt;
        taxTotal += taxAmt;
        return {
            ...item,
            productName: v?.product.name ?? 'Unknown',
            variantAttrs: v?.variantAttributes ?? {},
            hsnCode: item.hsnCode ?? v?.product.hsnCode ?? null,
            discountAmount: discountAmt,
            taxableAmount: taxableAmt,
            taxAmount: taxAmt,
            taxBreakdown,
            lineTotal: taxableAmt + taxAmt,
        };
    });
    const grandTotal = subtotal - discountTotal + taxTotal;
    const creditAmount = body.paymentMode === 'CREDIT' ? grandTotal : 0;
    const invoice = await prisma_1.prisma.invoice.create({
        data: {
            storeId,
            customerId: body.customerId,
            invoiceNumber,
            invoiceDate: invoiceDate,
            currencyCode: body.currencyCode,
            exchangeRate: 1,
            subtotal,
            taxTotal,
            discountTotal,
            roundOff: 0,
            grandTotal,
            grandTotalBase: grandTotal,
            paidAmount: 0,
            creditAmount,
            status: 'DRAFT',
            paymentMode: body.paymentMode,
            notes: body.notes,
            billedBy: userId,
            localId: body.localId,
            lineItems: {
                create: lineData.map(item => ({
                    variantId: item.variantId,
                    batchId: item.batchId,
                    productName: item.productName,
                    variantAttrs: item.variantAttrs,
                    hsnCode: item.hsnCode,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    discountPct: item.discountPct,
                    discountAmount: item.discountAmount,
                    taxableAmount: item.taxableAmount,
                    taxRuleId: item.taxRuleId,
                    taxBreakdown: item.taxBreakdown,
                    taxAmount: item.taxAmount,
                    lineTotal: item.lineTotal,
                })),
            },
        },
        include: { lineItems: true },
    });
    return reply.status(201).send({ success: true, data: invoice });
}
// ── POST /v1/stores/:storeId/invoices/:invoiceId/confirm ──────
// ATOMIC — stock check + deduct + movement log + customer update
async function confirmInvoice(request, reply) {
    const storeId = request.storeId;
    const { invoiceId } = request.params;
    const { userId } = request.authUser;
    try {
        await prisma_1.prisma.$transaction(async (tx) => {
            // 1. Lock and load invoice
            const invoice = await tx.invoice.findUnique({
                where: { invoiceId },
                include: { lineItems: true },
            });
            if (!invoice)
                throw Object.assign(new Error('Invoice not found'), { code: 'NOT_FOUND', statusCode: 404 });
            if (invoice.storeId !== storeId)
                throw Object.assign(new Error('Invoice not found'), { code: 'NOT_FOUND', statusCode: 404 });
            if (invoice.status !== 'DRAFT')
                throw Object.assign(new Error('Invoice is not in DRAFT status'), { code: 'INVOICE_NOT_DRAFT', statusCode: 409 });
            // 2. Stock check for every line item
            for (const item of invoice.lineItems) {
                const inv = await tx.inventory.findUnique({
                    where: { storeId_variantId: { storeId, variantId: item.variantId } },
                });
                const available = Number(inv?.quantity ?? 0) - Number(inv?.reservedQty ?? 0);
                if (available < Number(item.quantity)) {
                    throw Object.assign(new Error(`Insufficient stock for variant ${item.variantId}. Available: ${available}, Requested: ${item.quantity}`), { code: 'INSUFFICIENT_STOCK', statusCode: 422, field: 'lineItems' });
                }
            }
            // 3. Deduct stock + write movement log
            for (const item of invoice.lineItems) {
                const inv = await tx.inventory.findUnique({
                    where: { storeId_variantId: { storeId, variantId: item.variantId } },
                });
                const qtyBefore = Number(inv.quantity);
                const qtyDelta = -Number(item.quantity);
                const qtyAfter = qtyBefore + qtyDelta;
                await tx.inventory.update({
                    where: { storeId_variantId: { storeId, variantId: item.variantId } },
                    data: { quantity: qtyAfter },
                });
                await tx.inventoryMovement.create({
                    data: {
                        storeId,
                        variantId: item.variantId,
                        batchId: item.batchId ?? null,
                        movementType: 'SALE',
                        quantityDelta: qtyDelta,
                        quantityBefore: qtyBefore,
                        quantityAfter: qtyAfter,
                        referenceType: 'INVOICE',
                        referenceId: invoiceId,
                        performedBy: userId,
                    },
                });
            }
            // 4. Confirm invoice — set terminal status by payment.
            //    Non-credit sales are paid in full at the counter → PAID;
            //    credit sales stay CONFIRMED until payment is collected.
            const isCredit = invoice.paymentMode === 'CREDIT' || Number(invoice.creditAmount) > 0;
            await tx.invoice.update({
                where: { invoiceId },
                data: isCredit
                    ? { status: 'CONFIRMED' }
                    : { status: 'PAID', paidAmount: invoice.grandTotal },
            });
            // 5. Update customer credit balance if credit sale
            if (invoice.customerId && Number(invoice.creditAmount) > 0) {
                const customer = await tx.customer.findUnique({ where: { customerId: invoice.customerId } });
                const newBalance = Number(customer?.outstandingBalance ?? 0) + Number(invoice.creditAmount);
                await tx.customer.update({
                    where: { customerId: invoice.customerId },
                    data: { outstandingBalance: newBalance },
                });
                await tx.customerCreditLedger.create({
                    data: {
                        customerId: invoice.customerId,
                        storeId,
                        entryType: 'CREDIT_SALE',
                        amount: invoice.creditAmount,
                        balanceAfter: newBalance,
                        referenceType: 'INVOICE',
                        referenceId: invoiceId,
                        recordedBy: userId,
                    },
                });
            }
            // 6. Update lifetime purchases
            if (invoice.customerId) {
                await tx.customer.update({
                    where: { customerId: invoice.customerId },
                    data: { totalPurchases: { increment: invoice.grandTotalBase } },
                });
            }
        });
    }
    catch (err) {
        if (err.code === 'NOT_FOUND') {
            return reply.status(err.statusCode ?? 404).send({ success: false, error: { code: err.code, message: err.message, statusCode: err.statusCode ?? 404 } });
        }
        if (err.code === 'INVOICE_NOT_DRAFT') {
            return reply.status(409).send({ success: false, error: { code: err.code, message: err.message, statusCode: 409 } });
        }
        if (err.code === 'INSUFFICIENT_STOCK') {
            return reply.status(422).send({ success: false, error: { code: err.code, message: err.message, field: 'lineItems', statusCode: 422 } });
        }
        throw err;
    }
    // 7. Enqueue low-stock check (outside transaction)
    await lowStockWorker_1.lowStockQueue.add('check', { storeId });
    return reply.send({ success: true, data: { invoiceId, status: 'CONFIRMED', confirmedAt: new Date() } });
}
// ── POST /v1/stores/:storeId/invoices/:invoiceId/payments ─────
async function recordPayment(request, reply) {
    const storeId = request.storeId;
    const { invoiceId } = request.params;
    const { userId } = request.authUser;
    const parsed = schema_1.RecordPaymentSchema.safeParse(request.body);
    if (!parsed.success) {
        return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message, statusCode: 400 } });
    }
    const { paymentMethod, amount, currencyCode, referenceNo } = parsed.data;
    const payment = await prisma_1.prisma.$transaction(async (tx) => {
        const invoice = await tx.invoice.findUnique({ where: { invoiceId } });
        if (!invoice)
            throw Object.assign(new Error('Invoice not found'), { code: 'NOT_FOUND', statusCode: 404 });
        if (invoice.storeId !== storeId)
            throw Object.assign(new Error('Invoice not found'), { code: 'NOT_FOUND', statusCode: 404 });
        if (invoice.status === 'CANCELLED')
            throw Object.assign(new Error('Cannot record payment on cancelled invoice'), { code: 'INVOICE_CANCELLED', statusCode: 409 });
        const pay = await tx.payment.create({
            data: {
                invoiceId,
                storeId,
                paymentMethod,
                amount,
                currencyCode,
                referenceNo,
                recordedBy: userId,
            },
        });
        const newPaidAmount = Number(invoice.paidAmount) + amount;
        const newStatus = newPaidAmount >= Number(invoice.grandTotal) ? 'PAID' : 'PARTIAL';
        await tx.invoice.update({
            where: { invoiceId },
            data: { paidAmount: newPaidAmount, status: newStatus },
        });
        return pay;
    });
    return reply.status(201).send({ success: true, data: payment });
}
// ── GET /v1/stores/:storeId/invoices ──────────────────────────
async function listInvoices(request, reply) {
    const storeId = request.storeId;
    const parsed = schema_1.InvoiceListQuerySchema.safeParse(request.query);
    if (!parsed.success) {
        return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message, statusCode: 400 } });
    }
    const { status, from, to, customerId, page, limit } = parsed.data;
    const where = {
        storeId,
        ...(status && { status }),
        ...(customerId && { customerId }),
        ...((from || to) && {
            invoiceDate: {
                ...(from && { gte: new Date(from) }),
                ...(to && { lte: new Date(to) }),
            },
        }),
    };
    const [invoices, total] = await Promise.all([
        prisma_1.prisma.invoice.findMany({
            where,
            orderBy: [
                { invoiceDate: 'desc' },
                { invoiceNumber: 'desc' },
            ],
            skip: (page - 1) * limit,
            take: limit,
            include: { customer: { select: { customerId: true, name: true, phone: true } } },
        }),
        prisma_1.prisma.invoice.count({ where }),
    ]);
    return reply.send({ success: true, data: invoices, meta: { page, limit, total, hasMore: page * limit < total } });
}
// ── GET /v1/stores/:storeId/invoices/:invoiceId ───────────────
async function getInvoice(request, reply) {
    const storeId = request.storeId;
    const { invoiceId } = request.params;
    const invoice = await prisma_1.prisma.invoice.findUnique({
        where: { invoiceId },
        include: {
            lineItems: true,
            payments: true,
            customer: { select: { customerId: true, name: true, phone: true, email: true } },
        },
    });
    if (!invoice || invoice.storeId !== storeId) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Invoice not found', statusCode: 404 } });
    }
    return reply.send({ success: true, data: invoice });
}
// ── POST /v1/stores/:storeId/invoices/:invoiceId/cancel ───────
async function cancelInvoice(request, reply) {
    const storeId = request.storeId;
    const { invoiceId } = request.params;
    const { userId } = request.authUser;
    const parsed = schema_1.CancelInvoiceSchema.safeParse(request.body);
    if (!parsed.success) {
        return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message, statusCode: 400 } });
    }
    const { reason } = parsed.data;
    try {
        await prisma_1.prisma.$transaction(async (tx) => {
            const invoice = await tx.invoice.findUnique({
                where: { invoiceId },
                include: { lineItems: true },
            });
            if (!invoice || invoice.storeId !== storeId) {
                throw Object.assign(new Error('Invoice not found'), { code: 'NOT_FOUND', statusCode: 404 });
            }
            if (!['CONFIRMED', 'PARTIAL', 'DRAFT'].includes(invoice.status)) {
                throw Object.assign(new Error(`Cannot cancel invoice in status ${invoice.status}`), { code: 'INVALID_STATUS', statusCode: 409 });
            }
            // 1. Reverse inventory for each line item (skip for DRAFT — stock never deducted)
            if (invoice.status !== 'DRAFT') {
                for (const item of invoice.lineItems) {
                    const inv = await tx.inventory.findUnique({
                        where: { storeId_variantId: { storeId, variantId: item.variantId } },
                    });
                    const qtyBefore = Number(inv?.quantity ?? 0);
                    const qtyDelta = Number(item.quantity); // add back
                    const qtyAfter = qtyBefore + qtyDelta;
                    await tx.inventory.update({
                        where: { storeId_variantId: { storeId, variantId: item.variantId } },
                        data: { quantity: qtyAfter },
                    });
                    await tx.inventoryMovement.create({
                        data: {
                            storeId,
                            variantId: item.variantId,
                            batchId: item.batchId ?? null,
                            movementType: 'RETURN',
                            quantityDelta: qtyDelta,
                            quantityBefore: qtyBefore,
                            quantityAfter: qtyAfter,
                            referenceType: 'INVOICE',
                            referenceId: invoiceId,
                            notes: `Invoice cancelled: ${reason}`,
                            performedBy: userId,
                        },
                    });
                }
            }
            // 2. Reverse customer credit balance if applicable
            if (invoice.customerId && Number(invoice.creditAmount) > 0) {
                const customer = await tx.customer.findUnique({ where: { customerId: invoice.customerId } });
                const newBalance = Math.max(0, Number(customer?.outstandingBalance ?? 0) - Number(invoice.creditAmount));
                await tx.customer.update({
                    where: { customerId: invoice.customerId },
                    data: { outstandingBalance: newBalance },
                });
                await tx.customerCreditLedger.create({
                    data: {
                        customerId: invoice.customerId,
                        storeId,
                        entryType: 'ADJUSTMENT',
                        amount: invoice.creditAmount,
                        balanceAfter: newBalance,
                        referenceType: 'INVOICE',
                        referenceId: invoiceId,
                        notes: `Invoice cancelled: ${reason}`,
                        recordedBy: userId,
                    },
                });
            }
            // 3. Reverse total purchases for customer
            if (invoice.customerId) {
                await tx.customer.update({
                    where: { customerId: invoice.customerId },
                    data: { totalPurchases: { decrement: invoice.grandTotalBase } },
                });
            }
            // 4. Mark invoice as cancelled
            await tx.invoice.update({
                where: { invoiceId },
                data: { status: 'CANCELLED', notes: reason },
            });
        });
    }
    catch (err) {
        if (err.code === 'NOT_FOUND') {
            return reply.status(404).send({ success: false, error: { code: err.code, message: err.message, statusCode: 404 } });
        }
        if (err.code === 'INVALID_STATUS') {
            return reply.status(409).send({ success: false, error: { code: err.code, message: err.message, statusCode: 409 } });
        }
        throw err;
    }
    return reply.send({ success: true, data: { invoiceId, status: 'CANCELLED', cancelledAt: new Date() } });
}
//# sourceMappingURL=handler.js.map