import fs   from 'node:fs/promises';
import path from 'node:path';
import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../../lib/prisma';
import { generateUploadSignedUrl, getPublicImageUrl } from '../../lib/storage';
import {
  RequestUploadUrlSchema,
  ConfirmUploadSchema,
  ConfirmUploadQuerySchema,
} from './schema';
import type {
  RequestUploadUrlInput,
  ConfirmUploadInput,
  ConfirmUploadQuery,
} from './schema';

// ── POST /:storeId/upload/product-image ───────────────────────
export async function requestUploadUrl(
  request: FastifyRequest<{ Params: { storeId: string }; Body: RequestUploadUrlInput }>,
  reply: FastifyReply,
) {
  const storeId = request.storeId;

  const parsed = RequestUploadUrlSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message, statusCode: 400 } });
  }
  const { productId, mimeType, cameraAngle, lighting, captureDevice } = parsed.data;

  // Verify product belongs to this store
  const product = await prisma.product.findFirst({
    where: { productId, storeId, isActive: true },
    select: { productId: true },
  });
  if (!product) {
    return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Product not found in this store', statusCode: 404 } });
  }

  // Generate unique imageId: img_{first8}_timestamp_random4
  const prefix    = productId.replace(/-/g, '').slice(0, 8);
  const timestamp = Date.now();
  const random    = Math.random().toString(36).slice(2, 6);
  const imageId   = `img_${prefix}_${timestamp}_${random}`;

  const uploadUrl = await generateUploadSignedUrl({
    storeId,
    productId,
    imageId,
    mimeType,
    expiresInSeconds: 300,
  });

  const publicUrl = getPublicImageUrl(storeId, productId, imageId);

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
export async function confirmUpload(
  request: FastifyRequest<{ Params: { storeId: string }; Body: ConfirmUploadInput; Querystring: ConfirmUploadQuery }>,
  reply: FastifyReply,
) {
  const storeId = request.storeId;

  const queryParsed = ConfirmUploadQuerySchema.safeParse(request.query);
  if (!queryParsed.success) {
    return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: queryParsed.error.errors[0].message, statusCode: 400 } });
  }
  const { productId } = queryParsed.data;

  const parsed = ConfirmUploadSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message, statusCode: 400 } });
  }
  const { imageId, imageUrl, thumbnailUrl, isPrimary, cameraAngle, lighting, captureDevice } = parsed.data;

  // Verify product belongs to this store
  const product = await prisma.product.findFirst({
    where: { productId, storeId, isActive: true },
    select: { productId: true },
  });
  if (!product) {
    return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Product not found in this store', statusCode: 404 } });
  }

  // Deduplication: if a record with this imageUrl already exists, return it
  const existing = await prisma.productImage.findFirst({
    where: { productId, storeId, imageUrl },
  });
  if (existing) {
    return reply.send({ success: true, data: existing });
  }

  // If isPrimary, demote all other images for this product first
  if (isPrimary) {
    await prisma.productImage.updateMany({
      where: { productId, storeId, isPrimary: true },
      data:  { isPrimary: false },
    });
  }

  const image = await prisma.productImage.create({
    data: {
      productId,
      storeId,
      imageUrl,
      thumbnailUrl:  thumbnailUrl  ?? null,
      isPrimary,
      cameraAngle:   cameraAngle   ?? null,
      lighting:      lighting      ?? null,
      captureDevice: captureDevice ?? null,
      isLabeled: false,
      aiLabels:  null as any,
    },
  });

  return reply.status(201).send({ success: true, data: image });
}

// ── POST /:storeId/upload/product-image/direct ───────────────
// Local-dev bypass: saves image bytes directly to UPLOAD_DIR
// (no GCS credentials needed). Flutter uploads multipart form:
//   fields: productId (required), angle (optional)
//   file:   binary image data (field name = "file")
export async function uploadProductImageDirect(
  request: FastifyRequest<{ Params: { storeId: string } }>,
  reply: FastifyReply,
) {
  const storeId = request.storeId;

  const fields:     Record<string, string> = {};
  let   fileBuffer: Buffer | null          = null;

  for await (const part of request.parts()) {
    if (part.type === 'file') {
      const chunks: Buffer[] = [];
      for await (const chunk of part.file) chunks.push(chunk);
      fileBuffer = Buffer.concat(chunks);
    } else {
      fields[part.fieldname] = part.value as string;
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
  const product = await prisma.product.findFirst({
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
  const prefix    = productId.replace(/-/g, '').slice(0, 8);
  const timestamp = Date.now();
  const random    = Math.random().toString(36).slice(2, 6);
  const imageId   = `img_${prefix}_${timestamp}_${random}`;

  // Write to UPLOAD_DIR/stores/{storeId}/products/{productId}/{imageId}.jpg
  const uploadDir = process.env.UPLOAD_DIR ?? path.join(process.cwd(), 'uploads');
  const dir       = path.join(uploadDir, 'stores', storeId, 'products', productId);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, `${imageId}.jpg`), fileBuffer);

  const publicPath = `/uploads/stores/${storeId}/products/${productId}/${imageId}.jpg`;

  return reply.status(201).send({
    success: true,
    data: { imageId, publicPath, productId, storeId, angle: angle ?? null },
  });
}

// ── GET /:storeId/upload/history/:productId ───────────────────
export async function getUploadHistory(
  request: FastifyRequest<{ Params: { storeId: string; productId: string } }>,
  reply: FastifyReply,
) {
  const storeId           = request.storeId;
  const { productId }     = request.params;

  // Verify product belongs to this store
  const product = await prisma.product.findFirst({
    where: { productId, storeId, isActive: true },
    select: { productId: true },
  });
  if (!product) {
    return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Product not found in this store', statusCode: 404 } });
  }

  const images = await prisma.productImage.findMany({
    where:   { productId, storeId },
    orderBy: { capturedAt: 'desc' },
  });

  return reply.send({ success: true, data: images });
}
