"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BulkImportQuerySchema = exports.ConfirmUploadQuerySchema = exports.ConfirmUploadSchema = exports.RequestUploadUrlSchema = void 0;
const zod_1 = require("zod");
// ── Camera angle enum (mirrors Prisma CameraAngle) ────────────
const CameraAngleEnum = zod_1.z.enum(['FRONT', 'BACK', 'SIDE', 'BARCODE', 'LABEL', 'TOP']);
// ── Lighting condition enum (mirrors Prisma LightingCondition) ─
const LightingEnum = zod_1.z.enum(['NATURAL', 'FLUORESCENT', 'POOR', 'BRIGHT']);
// ── POST /:storeId/upload/product-image ───────────────────────
exports.RequestUploadUrlSchema = zod_1.z.object({
    productId: zod_1.z.string().uuid(),
    mimeType: zod_1.z.enum(['image/jpeg', 'image/png', 'image/webp']),
    cameraAngle: CameraAngleEnum.optional(),
    lighting: LightingEnum.optional(),
    captureDevice: zod_1.z.string().optional(),
});
// ── POST /:storeId/upload/confirm ─────────────────────────────
exports.ConfirmUploadSchema = zod_1.z.object({
    imageId: zod_1.z.string().min(1),
    imageUrl: zod_1.z.string().url(),
    thumbnailUrl: zod_1.z.string().url().optional(),
    isPrimary: zod_1.z.boolean().default(false),
    cameraAngle: CameraAngleEnum.optional(),
    lighting: LightingEnum.optional(),
    captureDevice: zod_1.z.string().optional(),
});
// ── Query param for confirmUpload ─────────────────────────────
exports.ConfirmUploadQuerySchema = zod_1.z.object({
    productId: zod_1.z.string().uuid(),
});
// ── BulkImport query (file bytes handled as raw buffer) ───────
exports.BulkImportQuerySchema = zod_1.z.object({
    dryRun: zod_1.z.coerce.boolean().default(false),
});
//# sourceMappingURL=schema.js.map