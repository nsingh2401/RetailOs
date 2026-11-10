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
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Integration tests for the restoreBatch handler.
 * Uses the real Prisma client + local PostgreSQL (mpos_ai_bot).
 * Reuses an existing variant from the GENERAL store to avoid schema drift issues.
 *
 * Run:  npx vitest run src/tests/restore-batch.test.ts
 */
const vitest_1 = require("vitest");
const crypto_1 = require("crypto");
const client_1 = require("@prisma/client");
const handler = __importStar(require("../modules/inventory/handler"));
const prisma = new client_1.PrismaClient();
const STORE_ID = '8688cf42-de73-4cb3-bbc2-7cc577a9e284';
const USER_ID = 'd430fea0-37ca-4d4a-b737-81c4da7c5206';
// Resolved at runtime
let VARIANT_ID = '';
let ORIG_INV_QTY = 0; // original inventory.quantity — restored after each test
const BATCH_ID = (0, crypto_1.randomUUID)();
// ── request / reply factories ─────────────────────────────────────────
function makeRequest(body) {
    return {
        storeId: STORE_ID,
        storeRole: 'OWNER',
        authUser: { userId: USER_ID },
        params: { storeId: STORE_ID, batchId: BATCH_ID },
        body,
    };
}
function makeReply() {
    let statusCode = 200;
    let payload;
    const reply = {
        status: (code) => { statusCode = code; return reply; },
        send: (data) => { payload = data; return reply; },
        get statusCode() { return statusCode; },
        get payload() { return payload; },
    };
    return reply;
}
// ── global setup: find or create inventory row ────────────────────────
(0, vitest_1.beforeAll)(async () => {
    // Pick any active variant from the GENERAL store
    const v = await prisma.productVariant.findFirst({
        where: { storeId: STORE_ID, isActive: true },
        select: { variantId: true },
    });
    if (!v)
        throw new Error('No active variant found in GENERAL store. Seed the DB first.');
    VARIANT_ID = v.variantId;
    // Ensure an inventory row exists for this variant
    const inv = await prisma.inventory.upsert({
        where: { storeId_variantId: { storeId: STORE_ID, variantId: VARIANT_ID } },
        create: { storeId: STORE_ID, variantId: VARIANT_ID, quantity: 5 },
        update: {},
    });
    ORIG_INV_QTY = Number(inv.quantity);
});
// ── per-test seed / cleanup ───────────────────────────────────────────
async function seedExpiredBatch(writeOffQty, remainingQty = 0) {
    // Reset inventory to known baseline
    await prisma.inventory.update({
        where: { storeId_variantId: { storeId: STORE_ID, variantId: VARIANT_ID } },
        data: { quantity: 5 },
    });
    await prisma.batch.create({
        data: {
            batchId: BATCH_ID,
            storeId: STORE_ID,
            variantId: VARIANT_ID,
            batchNumber: `RESTORE-TEST-${BATCH_ID.substring(0, 8)}`,
            quantity: writeOffQty,
            remainingQty,
            purchasePrice: 10,
            expiryDate: new Date('2024-01-01'),
            isExpired: true,
        },
    });
    await prisma.inventoryMovement.create({
        data: {
            storeId: STORE_ID,
            variantId: VARIANT_ID,
            batchId: BATCH_ID,
            movementType: 'EXPIRED_CLEARANCE',
            quantityDelta: -writeOffQty,
            quantityBefore: 5 + writeOffQty,
            quantityAfter: 5,
            referenceType: 'BATCH',
            referenceId: BATCH_ID,
            performedBy: USER_ID,
        },
    });
}
async function cleanup() {
    await prisma.inventoryMovement.deleteMany({ where: { batchId: BATCH_ID } });
    await prisma.batch.deleteMany({ where: { batchId: BATCH_ID } });
    // Restore inventory to original quantity
    await prisma.inventory.update({
        where: { storeId_variantId: { storeId: STORE_ID, variantId: VARIANT_ID } },
        data: { quantity: ORIG_INV_QTY },
    });
}
// ── tests ─────────────────────────────────────────────────────────────
(0, vitest_1.describe)('restoreBatch', () => {
    (0, vitest_1.afterEach)(cleanup);
    (0, vitest_1.it)('succeeds once — remaining_qty and inventory.quantity both increase by cleared amount', async () => {
        const writeOff = 7;
        await seedExpiredBatch(writeOff);
        const req = makeRequest({ newExpiryDate: '2027-06-01' });
        const reply = makeReply();
        await handler.restoreBatch(req, reply);
        (0, vitest_1.expect)(reply.statusCode).toBe(200);
        const data = reply.payload.data;
        (0, vitest_1.expect)(data.restoredQty).toBe(writeOff);
        const batch = await prisma.batch.findUnique({ where: { batchId: BATCH_ID } });
        (0, vitest_1.expect)(batch?.isExpired).toBe(false);
        (0, vitest_1.expect)(Number(batch?.remainingQty)).toBe(writeOff);
        const inv = await prisma.inventory.findUnique({
            where: { storeId_variantId: { storeId: STORE_ID, variantId: VARIANT_ID } },
        });
        (0, vitest_1.expect)(Number(inv?.quantity)).toBe(5 + writeOff); // 5 baseline + 7 restored = 12
        const movement = await prisma.inventoryMovement.findFirst({
            where: { batchId: BATCH_ID, referenceType: 'BATCH_RESTORE' },
        });
        (0, vitest_1.expect)(Number(movement?.quantityDelta)).toBe(writeOff);
        (0, vitest_1.expect)(Number(movement?.quantityAfter)).toBe(5 + writeOff);
    });
    (0, vitest_1.it)('refuses a second restore — batch is no longer expired', async () => {
        await seedExpiredBatch(4);
        // First restore succeeds
        await handler.restoreBatch(makeRequest({ newExpiryDate: '2027-06-01' }), makeReply());
        // Second restore on the now-active batch
        const reply2 = makeReply();
        await handler.restoreBatch(makeRequest({ newExpiryDate: '2027-07-01' }), reply2);
        (0, vitest_1.expect)(reply2.statusCode).toBe(409);
        (0, vitest_1.expect)(reply2.payload.error.code).toBe('ALREADY_ACTIVE');
    });
    (0, vitest_1.it)('refuses a past or today expiry date', async () => {
        await seedExpiredBatch(3);
        const reply = makeReply();
        await handler.restoreBatch(makeRequest({ newExpiryDate: '2020-01-01' }), reply);
        (0, vitest_1.expect)(reply.statusCode).toBe(400);
        (0, vitest_1.expect)(reply.payload.error.code).toBe('EXPIRY_NOT_FUTURE');
    });
    (0, vitest_1.it)('refuses when no EXPIRED_CLEARANCE movement exists', async () => {
        await seedExpiredBatch(5);
        await prisma.inventoryMovement.deleteMany({
            where: { batchId: BATCH_ID, movementType: 'EXPIRED_CLEARANCE' },
        });
        const reply = makeReply();
        await handler.restoreBatch(makeRequest({ newExpiryDate: '2027-06-01' }), reply);
        (0, vitest_1.expect)(reply.statusCode).toBe(400);
        (0, vitest_1.expect)(reply.payload.error.code).toBe('NO_CLEARANCE_MOVEMENT');
    });
});
//# sourceMappingURL=restore-batch.test.js.map