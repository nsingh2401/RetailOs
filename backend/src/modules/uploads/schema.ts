import { z } from 'zod';

// ── Camera angle enum (mirrors Prisma CameraAngle) ────────────
const CameraAngleEnum = z.enum(['FRONT', 'BACK', 'SIDE', 'BARCODE', 'LABEL', 'TOP']);

// ── Lighting condition enum (mirrors Prisma LightingCondition) ─
const LightingEnum = z.enum(['NATURAL', 'FLUORESCENT', 'POOR', 'BRIGHT']);

// ── POST /:storeId/upload/product-image ───────────────────────
export const RequestUploadUrlSchema = z.object({
  productId:     z.string().uuid(),
  mimeType:      z.enum(['image/jpeg', 'image/png', 'image/webp']),
  cameraAngle:   CameraAngleEnum.optional(),
  lighting:      LightingEnum.optional(),
  captureDevice: z.string().optional(),
});

// ── POST /:storeId/upload/confirm ─────────────────────────────
export const ConfirmUploadSchema = z.object({
  imageId:      z.string().min(1),
  imageUrl:     z.string().url(),
  thumbnailUrl: z.string().url().optional(),
  isPrimary:    z.boolean().default(false),
  cameraAngle:  CameraAngleEnum.optional(),
  lighting:     LightingEnum.optional(),
  captureDevice: z.string().optional(),
});

// ── Query param for confirmUpload ─────────────────────────────
export const ConfirmUploadQuerySchema = z.object({
  productId: z.string().uuid(),
});

// ── BulkImport query (file bytes handled as raw buffer) ───────
export const BulkImportQuerySchema = z.object({
  dryRun: z.coerce.boolean().default(false),
});

// ── Types ──────────────────────────────────────────────────────
export type RequestUploadUrlInput = z.infer<typeof RequestUploadUrlSchema>;
export type ConfirmUploadInput    = z.infer<typeof ConfirmUploadSchema>;
export type ConfirmUploadQuery    = z.infer<typeof ConfirmUploadQuerySchema>;
export type BulkImportQuery       = z.infer<typeof BulkImportQuerySchema>;
