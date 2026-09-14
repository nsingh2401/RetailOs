"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestUploadUrl = requestUploadUrl;
exports.confirmUpload = confirmUpload;
exports.uploadProductImageDirect = uploadProductImageDirect;
exports.getUploadHistory = getUploadHistory;
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
const prisma_1 = require("../../lib/prisma");
const storage_1 = require("../../lib/storage");
const schema_1 = require("./schema");
// ── POST /:storeId/upload/product-image ───────────────────────
async function requestUploadUrl(request, reply) {
    const storeId = request.storeId;
    const parsed = schema_1.RequestUploadUrlSchema.safeParse(request.body);
    if (!parsed.success) {
        return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message, statusCode: 400 } });
    }
    const { productId, mimeType, cameraAngle, lighting, captureDevice } = parsed.data;
    // Verify product belongs to this store
    const product = await prisma_1.prisma.product.findFirst({
        where: { productId, storeId, isActive: true },
        select: { productId: true },
    });
    if (!product) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Product not found in this store', statusCode: 404 } });
    }
    // Generate unique imageId: img_{first8}_timestamp_random4
    const prefix = productId.replace(/-/g, '').slice(0, 8);
    const timestamp = Date.now();
    const random = Math.random().toString(36).slice(2, 6);
    const imageId = `img_${prefix}_${timestamp}_${random}`;
    const uploadUrl = await (0, storage_1.generateUploadSignedUrl)({
        storeId,
        productId,
        imageId,
        mimeType,
        expiresInSeconds: 300,
    });
    const publicUrl = (0, storage_1.getPublicImageUrl)(storeId, productId, imageId);
    return reply.send({
        success: true,
        data: {
            imageId,
            uploadUrl,
            publicUrl,
            expiresIn: 300,
            productId,
            storeId,
        },
    });
}
// ── POST /:storeId/upload/confirm ─────────────────────────────
async function confirmUpload(request, reply) {
    const storeId = request.storeId;
    const queryParsed = schema_1.ConfirmUploadQuerySchema.safeParse(request.query);
    if (!queryParsed.success) {
        return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: queryParsed.error.errors[0].message, statusCode: 400 } });
    }
    const { productId } = queryParsed.data;
    const parsed = schema_1.ConfirmUploadSchema.safeParse(request.body);
    if (!parsed.success) {
        return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message, statusCode: 400 } });
    }
    const { imageId, imageUrl, thumbnailUrl, isPrimary, cameraAngle, lighting, captureDevice } = parsed.data;
    // Verify product belongs to this store
    const product = await prisma_1.prisma.product.findFirst({
        where: { productId, storeId, isActive: true },
        select: { productId: true },
    });
    if (!product) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Product not found in this store', statusCode: 404 } });
    }
    // Deduplication: if a record with this imageUrl already exists, return it
    const existing = await prisma_1.prisma.productImage.findFirst({
        where: { productId, storeId, imageUrl },
    });
    if (existing) {
        return reply.send({ success: true, data: existing });
    }
    // If isPrimary, demote all other images for this product first
    if (isPrimary) {
        await prisma_1.prisma.productImage.updateMany({
            where: { productId, storeId, isPrimary: true },
            data: { isPrimary: false },
        });
    }
    const image = await prisma_1.prisma.productImage.create({
        data: {
            productId,
            storeId,
            imageUrl,
            thumbnailUrl: thumbnailUrl ?? null,
            isPrimary,
            cameraAngle: cameraAngle ?? null,
            lighting: lighting ?? null,
            captureDevice: captureDevice ?? null,
            isLabeled: false,
            aiLabels: null,
        },
    });
    return reply.status(201).send({ success: true, data: image });
}
// ── POST /:storeId/upload/product-image/direct ───────────────
// Local-dev bypass: saves image bytes directly to UPLOAD_DIR
// (no GCS credentials needed). Flutter uploads multipart form:
//   fields: productId (required), angle (optional)
//   file:   binary image data (field name = "file")
async function uploadProductImageDirect(request, reply) {
    const storeId = request.storeId;
    const fields = {};
    let fileBuffer = null;
    for await (const part of request.parts()) {
        if (part.type === 'file') {
            const chunks = [];
            for await (const chunk of part.file)
                chunks.push(chunk);
            fileBuffer = Buffer.concat(chunks);
        }
        else {
            fields[part.fieldname] = part.value;
        }
    }
    const { productId, angle } = fields;
    if (!productId) {
        return reply.status(400).send({
            success: false,
            error: { code: 'VALIDATION_ERROR', message: 'productId is required', statusCode: 400 },
        });
    }
    if (!fileBuffer || fileBuffer.length === 0) {
        return reply.status(400).send({
            success: false,
            error: { code: 'VALIDATION_ERROR', message: 'No file data received', statusCode: 400 },
        });
    }
    // Verify product belongs to this store
    const product = await prisma_1.prisma.product.findFirst({
        where: { productId, storeId, isActive: true },
        select: { productId: true },
    });
    if (!product) {
        return reply.status(404).send({
            success: false,
            error: { code: 'NOT_FOUND', message: 'Product not found in this store', statusCode: 404 },
        });
    }
    // Generate imageId using same pattern as GCS handler
    const prefix = productId.replace(/-/g, '').slice(0, 8);
    const timestamp = Date.now();
    const random = Math.random().toString(36).slice(2, 6);
    const imageId = `img_${prefix}_${timestamp}_${random}`;
    // Write to UPLOAD_DIR/stores/{storeId}/products/{productId}/{imageId}.jpg
    const uploadDir = process.env.UPLOAD_DIR ?? node_path_1.default.join(process.cwd(), 'uploads');
    const dir = node_path_1.default.join(uploadDir, 'stores', storeId, 'products', productId);
    await promises_1.default.mkdir(dir, { recursive: true });
    await promises_1.default.writeFile(node_path_1.default.join(dir, `${imageId}.jpg`), fileBuffer);
    const publicPath = `/uploads/stores/${storeId}/products/${productId}/${imageId}.jpg`;
    return reply.status(201).send({
        success: true,
        data: { imageId, publicPath, productId, storeId, angle: angle ?? null },
    });
}
// ── GET /:storeId/upload/history/:productId ───────────────────
async function getUploadHistory(request, reply) {
    const storeId = request.storeId;
    const { productId } = request.params;
    // Verify product belongs to this store
    const product = await prisma_1.prisma.product.findFirst({
        where: { productId, storeId, isActive: true },
        select: { productId: true },
    });
    if (!product) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Product not found in this store', statusCode: 404 } });
    }
    const images = await prisma_1.prisma.productImage.findMany({
        where: { productId, storeId },
        orderBy: { capturedAt: 'desc' },
    });
    return reply.send({ success: true, data: images });
}
//# sourceMappingURL=handler.js.map