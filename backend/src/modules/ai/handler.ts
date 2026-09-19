import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../../lib/prisma';

const MOONDREAM_URL = process.env.MOONDREAM_SERVER_URL ?? 'http://localhost:8001';

const VALID_INDUSTRY_TYPES = new Set([
  'GROCERY', 'PHARMACY', 'APPAREL', 'FOOTWEAR', 'OPTICAL', 'BAKERY',
  'HARDWARE', 'ELECTRONICS', 'ELECTRICAL', 'JEWELRY', 'FURNITURE',
  'PAINT', 'STATIONERY', 'GIFT', 'KITCHENWARE', 'TOYS', 'TEA_CAFE',
  'BAGS', 'GENERAL',
]);

// ── POST /v1/ai/identify-product ──────────────────────────────
// Accepts a multipart image, forwards to Moondream2, enriches
// with HSN lookup, returns structured product info.
export async function identifyProduct(
  request: FastifyRequest,
  reply:   FastifyReply,
) {
  // ── Read uploaded image ───────────────────────────────────
  const data = await request.file();
  if (!data) {
    return reply.status(400).send({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Image file required', statusCode: 400 },
    });
  }

  const chunks: Buffer[] = [];
  for await (const chunk of data.file) chunks.push(chunk);
  const fileBuffer = Buffer.concat(chunks);

  if (fileBuffer.length === 0) {
    return reply.status(400).send({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Empty file received', statusCode: 400 },
    });
  }

  // ── Forward to Moondream2 server ──────────────────────────
  let raw: Record<string, unknown>;
  try {
    const formData = new FormData();
    const blob     = new Blob([fileBuffer], { type: data.mimetype ?? 'image/jpeg' });
    formData.append('file', blob, data.filename ?? 'image.jpg');

    const resp = await fetch(`${MOONDREAM_URL}/analyze`, {
      method: 'POST',
      body:   formData,
      signal: AbortSignal.timeout(180_000), // 180s — LLaVA inference can be slow on CPU
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      throw new Error(`Moondream HTTP ${resp.status}: ${errText.slice(0, 200)}`);
    }

    raw = (await resp.json()) as Record<string, unknown>;
  } catch (err: unknown) {
    request.log.warn({ err }, 'Moondream inference failed');
    return reply.status(503).send({
      success: false,
      error: {
        code:       'AI_SERVICE_UNAVAILABLE',
        message:    'AI identification service is offline. Run scripts/ai/start_ai_server.bat first.',
        statusCode: 503,
      },
    });
  }

  // ── HSN enrichment ────────────────────────────────────────
  const rawHsn = (raw.hsn_code_suggestion as string | null | undefined) ?? '';
  let hsnCode        = '';
  let hsnDescription = '';
  let defaultGstRate: number | null = null;

  if (rawHsn.length >= 4) {
    try {
      const hsn = await (prisma as any).hSNCode.findFirst({
        where:   { hsnCode: { startsWith: rawHsn.slice(0, 4) } },
        select:  { hsnCode: true, description: true, defaultGstRate: true },
        orderBy: { hsnCode: 'asc' },
      }) as { hsnCode: string; description: string; defaultGstRate: number } | null;

      if (hsn) {
        hsnCode        = hsn.hsnCode;
        hsnDescription = hsn.description;
        defaultGstRate = Number(hsn.defaultGstRate);
      }
    } catch {
      // HSN lookup non-fatal — continue without it
    }
  }

  // ── Duplicate check ──────────────────────────────────────────
  const rawProductName = String(raw.product_name ?? '').trim();
  const rawBarcode     = (raw.barcode_if_visible as string | null) ?? null;
  const storeIdHdr     = (request.headers['x-store-id'] as string | undefined) ?? '';

  let isDuplicate     = false;
  let existingProduct: object | null = null;

  if (storeIdHdr) {
    try {
      // 1. Exact barcode match
      if (rawBarcode) {
        const variant = await (prisma as any).productVariant.findFirst({
          where: { storeId: storeIdHdr, barcode: rawBarcode, isActive: true },
          include: {
            product: { select: { productId: true, name: true, internalSku: true } },
          },
        });
        if (variant) {
          isDuplicate     = true;
          existingProduct = { ...variant.product, variantId: variant.variantId };
        }
      }
      // 2. Exact name match (case-insensitive) if no barcode hit
      if (!isDuplicate && rawProductName) {
        const prod = await (prisma as any).product.findFirst({
          where: {
            storeId:  storeIdHdr,
            name:     { equals: rawProductName, mode: 'insensitive' },
            isActive: true,
          },
          select: { productId: true, name: true, internalSku: true },
        });
        if (prod) {
          isDuplicate     = true;
          existingProduct = prod;
        }
      }
    } catch {
      // Duplicate check is non-fatal — continue without it
    }
  }

  // ── Validate industry type ────────────────────────────────
  const rawIndustry      = String(raw.industry_type ?? 'GENERAL').toUpperCase();
  const suggestedIndustry = VALID_INDUSTRY_TYPES.has(rawIndustry) ? rawIndustry : 'GENERAL';

  // ── Parse numeric fields safely ───────────────────────────
  const mrp = raw.mrp_if_visible != null
    ? (Number(raw.mrp_if_visible) || null)
    : null;

  const confidence = Math.max(0, Math.min(1, Number(raw.confidence ?? 0.5)));

  return reply.send({
    success: true,
    data: {
      productName:       String(raw.product_name      ?? ''),
      brand:             String(raw.brand             ?? ''),
      category:          String(raw.category          ?? ''),
      weight:            String(raw.weight_or_volume  ?? ''),
      unit:              String(raw.unit              ?? ''),
      color:             String(raw.color             ?? ''),
      material:          String(raw.material          ?? ''),
      suggestedIndustry,
      hsnCode,
      hsnDescription,
      defaultGstRate,
      mrp,
      expiryDate:   (raw.expiry_date_if_visible  as string | null) ?? null,
      barcode:      (raw.barcode_if_visible       as string | null) ?? null,
      confidence,
      isDuplicate,
      existingProduct,
    },
  });
}
