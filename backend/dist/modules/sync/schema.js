"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateDeviceSchema = exports.RegisterDeviceSchema = exports.ResolveConflictSchema = exports.SyncPullQuerySchema = exports.SyncPushSchema = exports.SyncRecordSchema = void 0;
const zod_1 = require("zod");
// ── Individual sync record ─────────────────────────────────────
exports.SyncRecordSchema = zod_1.z.object({
    localId: zod_1.z.string().min(1),
    entityType: zod_1.z.enum(['INVOICE', 'INVENTORY_MOVEMENT', 'PAYMENT', 'CUSTOMER', 'PURCHASE_ENTRY']),
    operation: zod_1.z.enum(['INSERT', 'UPDATE', 'DELETE']),
    localSequence: zod_1.z.number().int(),
    storeId: zod_1.z.string().uuid(),
    payload: zod_1.z.record(zod_1.z.unknown()),
});
// ── Sync push body ─────────────────────────────────────────────
exports.SyncPushSchema = zod_1.z.object({
    deviceId: zod_1.z.string().min(1),
    records: zod_1.z.array(exports.SyncRecordSchema).min(1).max(100),
});
// ── Sync pull query ────────────────────────────────────────────
exports.SyncPullQuerySchema = zod_1.z.object({
    since: zod_1.z.string().datetime(),
    storeId: zod_1.z.string().uuid(),
});
// ── Conflict resolution ────────────────────────────────────────
exports.ResolveConflictSchema = zod_1.z.object({
    syncId: zod_1.z.string().uuid(),
    resolution: zod_1.z.enum(['CLIENT_WINS', 'SERVER_WINS']),
    resolvedPayload: zod_1.z.record(zod_1.z.unknown()).optional(),
});
// ── Device registration ────────────────────────────────────────
exports.RegisterDeviceSchema = zod_1.z.object({
    deviceId: zod_1.z.string().min(1).max(100),
    storeId: zod_1.z.string().uuid(),
    platform: zod_1.z.enum(['ANDROID', 'IOS']),
    appVersion: zod_1.z.string().min(1),
    deviceName: zod_1.z.string().optional(),
});
// ── Device update ──────────────────────────────────────────────
exports.UpdateDeviceSchema = zod_1.z.object({
    appVersion: zod_1.z.string().optional(),
    userId: zod_1.z.string().uuid().optional(),
});
//# sourceMappingURL=schema.js.map