import { z } from 'zod';

// ── Individual sync record ─────────────────────────────────────
export const SyncRecordSchema = z.object({
  localId:       z.string().min(1),
  entityType:    z.enum(['INVOICE', 'INVENTORY_MOVEMENT', 'PAYMENT', 'CUSTOMER', 'PURCHASE_ENTRY']),
  operation:     z.enum(['INSERT', 'UPDATE', 'DELETE']),
  localSequence: z.number().int(),
  storeId:       z.string().uuid(),
  payload:       z.record(z.unknown()),
});

// ── Sync push body ─────────────────────────────────────────────
export const SyncPushSchema = z.object({
  deviceId: z.string().min(1),
  records:  z.array(SyncRecordSchema).min(1).max(100),
});

// ── Sync pull query ────────────────────────────────────────────
export const SyncPullQuerySchema = z.object({
  since:   z.string().datetime(),
  storeId: z.string().uuid(),
});

// ── Conflict resolution ────────────────────────────────────────
export const ResolveConflictSchema = z.object({
  syncId:          z.string().uuid(),
  resolution:      z.enum(['CLIENT_WINS', 'SERVER_WINS']),
  resolvedPayload: z.record(z.unknown()).optional(),
});

// ── Device registration ────────────────────────────────────────
export const RegisterDeviceSchema = z.object({
  deviceId:   z.string().min(1).max(100),
  storeId:    z.string().uuid(),
  platform:   z.enum(['ANDROID', 'IOS']),
  appVersion: z.string().min(1),
  deviceName: z.string().optional(),
});

// ── Device update ──────────────────────────────────────────────
export const UpdateDeviceSchema = z.object({
  appVersion: z.string().optional(),
  userId:     z.string().uuid().optional(),
});

// ── Types ──────────────────────────────────────────────────────
export type SyncRecord           = z.infer<typeof SyncRecordSchema>;
export type SyncPushInput        = z.infer<typeof SyncPushSchema>;
export type SyncPullQuery        = z.infer<typeof SyncPullQuerySchema>;
export type ResolveConflictInput = z.infer<typeof ResolveConflictSchema>;
export type RegisterDeviceInput  = z.infer<typeof RegisterDeviceSchema>;
export type UpdateDeviceInput    = z.infer<typeof UpdateDeviceSchema>;
