"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listCustomers = listCustomers;
exports.createCustomer = createCustomer;
exports.searchCustomers = searchCustomers;
exports.getOutstandingCustomers = getOutstandingCustomers;
exports.getCustomer = getCustomer;
exports.updateCustomer = updateCustomer;
exports.getCreditLedger = getCreditLedger;
exports.recordCreditPayment = recordCreditPayment;
const client_1 = require("@prisma/client");
const prisma_1 = require("../../lib/prisma");
const typesense_1 = require("../../lib/typesense");
const schema_1 = require("./schema");
// ── GET /v1/stores/:storeId/customers ─────────────────────────
async function listCustomers(request, reply) {
    const storeId = request.storeId;
    const parsed = schema_1.CustomerListQuerySchema.safeParse(request.query);
    if (!parsed.success) {
        return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message, statusCode: 400 } });
    }
    const { hasBalance, page, limit } = parsed.data;
    const where = {
        storeId,
        isActive: true,
        ...(hasBalance === true && {
            outstandingBalance: { gt: 0 },
        }),
    };
    const [customers, total] = await Promise.all([
        prisma_1.prisma.customer.findMany({
            where,
            orderBy: { name: 'asc' },
            skip: (page - 1) * limit,
            take: limit,
            select: {
                customerId: true,
                name: true,
                phone: true,
                email: true,
                outstandingBalance: true,
                creditLimit: true,
                loyaltyPoints: true,
                isActive: true,
                createdAt: true,
            },
        }),
        prisma_1.prisma.customer.count({ where }),
    ]);
    return reply.send({ success: true, data: customers, meta: { page, limit, total, hasMore: page * limit < total } });
}
// ── POST /v1/stores/:storeId/customers ────────────────────────
async function createCustomer(request, reply) {
    const storeId = request.storeId;
    const parsed = schema_1.CreateCustomerSchema.safeParse(request.body);
    if (!parsed.success) {
        return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message, statusCode: 400 } });
    }
    const { name, phone, email, address, creditLimit, notes } = parsed.data;
    try {
        const customer = await prisma_1.prisma.customer.create({
            data: {
                storeId,
                name,
                phone,
                email,
                address: address,
                creditLimit,
                notes,
            },
        });
        void (0, typesense_1.indexCustomer)({
            customerId: customer.customerId,
            storeId: customer.storeId,
            name: customer.name,
            phone: customer.phone ?? '',
            email: customer.email ?? '',
            isActive: customer.isActive,
        });
        return reply.status(201).send({ success: true, data: customer });
    }
    catch (err) {
        if (err.code === 'P2002') {
            return reply.status(409).send({
                success: false,
                error: { code: 'DUPLICATE_CUSTOMER', message: 'A customer with this phone or email already exists in this store', statusCode: 409 },
            });
        }
        throw err;
    }
}
// ── GET /v1/stores/:storeId/customers/search ──────────────────
async function searchCustomers(request, reply) {
    const storeId = request.storeId;
    const parsed = schema_1.CustomerSearchQuerySchema.safeParse(request.query);
    if (!parsed.success) {
        return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message, statusCode: 400 } });
    }
    const { q, limit } = parsed.data;
    try {
        const hits = await (0, typesense_1.searchCustomers)(storeId, q, limit);
        if (!hits || hits.length === 0) {
            throw new Error('No Typesense results');
        }
        const data = hits.map((h) => h.document);
        return reply.send({ success: true, data });
    }
    catch {
        // Typesense unavailable — fall back to PostgreSQL ILIKE search
        const customers = await prisma_1.prisma.$queryRaw `
      SELECT
        customer_id    AS "customerId",
        name,
        phone,
        email,
        outstanding_balance AS "outstandingBalance",
        credit_limit   AS "creditLimit",
        loyalty_points AS "loyaltyPoints",
        is_active      AS "isActive"
      FROM customers
      WHERE store_id = ${storeId}::uuid
        AND is_active = true
        AND (
          name  ILIKE ${'%' + q + '%'}
          OR phone LIKE ${'%' + q + '%'}
        )
      ORDER BY name ASC
      LIMIT ${limit}
    `;
        return reply.send({ success: true, data: customers });
    }
}
// ── GET /v1/stores/:storeId/customers/outstanding ─────────────
async function getOutstandingCustomers(request, reply) {
    const storeId = request.storeId;
    const rows = await prisma_1.prisma.$queryRaw(client_1.Prisma.sql `
      SELECT
        store_id,
        customer_id,
        customer_name,
        phone,
        outstanding_balance,
        credit_limit,
        available_credit,
        total_purchases,
        loyalty_points
      FROM v_customer_outstanding
      WHERE store_id = ${storeId}::uuid
    `);
    return reply.send({ success: true, data: rows });
}
// ── GET /v1/stores/:storeId/customers/:customerId ─────────────
async function getCustomer(request, reply) {
    const storeId = request.storeId;
    const { customerId } = request.params;
    const customer = await prisma_1.prisma.customer.findFirst({
        where: { customerId, storeId },
    });
    if (!customer) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Customer not found', statusCode: 404 } });
    }
    const availableCredit = Number(customer.creditLimit) - Number(customer.outstandingBalance);
    return reply.send({
        success: true,
        data: {
            ...customer,
            availableCredit,
        },
    });
}
// ── PATCH /v1/stores/:storeId/customers/:customerId ───────────
async function updateCustomer(request, reply) {
    const storeId = request.storeId;
    const { customerId } = request.params;
    // MANAGER or OWNER required
    if (request.storeRole !== 'OWNER' && request.storeRole !== 'MANAGER') {
        return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'MANAGER or OWNER role required', statusCode: 403 } });
    }
    const parsed = schema_1.UpdateCustomerSchema.safeParse(request.body);
    if (!parsed.success) {
        return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message, statusCode: 400 } });
    }
    const existing = await prisma_1.prisma.customer.findFirst({ where: { customerId, storeId } });
    if (!existing) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Customer not found', statusCode: 404 } });
    }
    const { address, ...rest } = parsed.data;
    const customer = await prisma_1.prisma.customer.update({
        where: { customerId },
        data: { ...rest, ...(address !== undefined && { address: address }) },
    });
    void (0, typesense_1.indexCustomer)({
        customerId: customer.customerId,
        storeId: customer.storeId,
        name: customer.name,
        phone: customer.phone ?? '',
        email: customer.email ?? '',
        isActive: customer.isActive,
    });
    return reply.send({ success: true, data: customer });
}
// ── GET /v1/stores/:storeId/customers/:customerId/ledger ───────
async function getCreditLedger(request, reply) {
    const storeId = request.storeId;
    const { customerId } = request.params;
    // MANAGER or OWNER required
    if (request.storeRole !== 'OWNER' && request.storeRole !== 'MANAGER') {
        return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'MANAGER or OWNER role required', statusCode: 403 } });
    }
    const parsed = schema_1.CreditLedgerQuerySchema.safeParse(request.query);
    if (!parsed.success) {
        return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message, statusCode: 400 } });
    }
    const { page, limit } = parsed.data;
    const customer = await prisma_1.prisma.customer.findFirst({
        where: { customerId, storeId },
        select: { outstandingBalance: true, creditLimit: true },
    });
    if (!customer) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Customer not found', statusCode: 404 } });
    }
    const [entries, total] = await Promise.all([
        prisma_1.prisma.customerCreditLedger.findMany({
            where: { customerId, storeId },
            orderBy: { createdAt: 'desc' },
            skip: (page - 1) * limit,
            take: limit,
            include: { recordedByUser: { select: { name: true } } },
        }),
        prisma_1.prisma.customerCreditLedger.count({ where: { customerId, storeId } }),
    ]);
    // Resolve invoice numbers for INVOICE-referenced entries so the
    // ledger can show a human reference instead of a raw UUID.
    const invoiceIds = entries
        .filter(e => e.referenceType === 'INVOICE' && e.referenceId)
        .map(e => e.referenceId);
    const invoiceMap = new Map();
    if (invoiceIds.length > 0) {
        const invoices = await prisma_1.prisma.invoice.findMany({
            where: { invoiceId: { in: invoiceIds } },
            select: { invoiceId: true, invoiceNumber: true },
        });
        for (const inv of invoices)
            invoiceMap.set(inv.invoiceId, inv.invoiceNumber);
    }
    const enrichedEntries = entries.map(e => ({
        ...e,
        referenceLabel: e.referenceType === 'INVOICE' && e.referenceId
            ? invoiceMap.get(e.referenceId) ?? null
            : null,
    }));
    return reply.send({
        success: true,
        data: {
            outstandingBalance: customer.outstandingBalance,
            creditLimit: customer.creditLimit,
            entries: enrichedEntries,
        },
        meta: { page, limit, total, hasMore: page * limit < total },
    });
}
// ── POST /v1/stores/:storeId/customers/:customerId/payment ────
async function recordCreditPayment(request, reply) {
    const storeId = request.storeId;
    const { customerId } = request.params;
    const { userId } = request.authUser;
    const parsed = schema_1.RecordCreditPaymentSchema.safeParse(request.body);
    if (!parsed.success) {
        return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message, statusCode: 400 } });
    }
    const { amount, paymentMethod, referenceNo, notes } = parsed.data;
    let ledgerEntry;
    try {
        ledgerEntry = await prisma_1.prisma.$transaction(async (tx) => {
            // 1. Lock and read current balance
            const customer = await tx.customer.findFirst({ where: { customerId, storeId } });
            if (!customer) {
                throw Object.assign(new Error('Customer not found'), { code: 'NOT_FOUND', statusCode: 404 });
            }
            const currentBalance = Number(customer.outstandingBalance);
            // 2. Validate: payment must not exceed outstanding balance
            if (amount > currentBalance) {
                throw Object.assign(new Error(`Payment amount ${amount} exceeds outstanding balance ${currentBalance}`), { code: 'PAYMENT_EXCEEDS_BALANCE', statusCode: 422 });
            }
            const newBalance = currentBalance - amount;
            // 3. Reduce customer outstanding balance
            await tx.customer.update({
                where: { customerId },
                data: { outstandingBalance: newBalance },
            });
            // 4. Find oldest CONFIRMED/PARTIAL invoice to apply payment to
            const oldestInvoice = await tx.invoice.findFirst({
                where: {
                    customerId,
                    storeId,
                    status: { in: ['CONFIRMED', 'PARTIAL'] },
                },
                orderBy: { createdAt: 'asc' },
                select: { invoiceId: true },
            });
            // 5. Create ledger entry (negative amount — payment reduces balance)
            const entry = await tx.customerCreditLedger.create({
                data: {
                    customerId,
                    storeId,
                    entryType: 'PAYMENT',
                    amount: -amount,
                    balanceAfter: newBalance,
                    referenceType: 'PAYMENT',
                    referenceId: oldestInvoice?.invoiceId ?? null,
                    notes: notes ?? (referenceNo ? `Ref: ${referenceNo}` : null),
                    recordedBy: userId,
                },
            });
            // 6. Create payment record against invoice if one was found
            if (oldestInvoice) {
                await tx.payment.create({
                    data: {
                        invoiceId: oldestInvoice.invoiceId,
                        storeId,
                        paymentMethod: paymentMethod,
                        amount,
                        currencyCode: 'INR',
                        referenceNo,
                        recordedBy: userId,
                    },
                });
            }
            return entry;
        });
    }
    catch (err) {
        if (err.code === 'NOT_FOUND') {
            return reply.status(404).send({ success: false, error: { code: err.code, message: err.message, statusCode: 404 } });
        }
        if (err.code === 'PAYMENT_EXCEEDS_BALANCE') {
            return reply.status(422).send({ success: false, error: { code: err.code, message: err.message, statusCode: 422 } });
        }
        throw err;
    }
    return reply.status(201).send({ success: true, data: ledgerEntry });
}
//# sourceMappingURL=handler.js.map