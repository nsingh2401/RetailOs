import { FastifyRequest, FastifyReply } from 'fastify';
import { XMLParser } from 'fast-xml-parser';
import { prisma } from '../../lib/prisma';

interface ImportSummary {
  productsImported:  number;
  customersImported: number;
  invoicesImported:  number;
  errors:            string[];
}

// ── POST /v1/stores/:storeId/import/tally ────────────────────
export async function importTallyXml(
  request: FastifyRequest<{ Params: { storeId: string } }>,
  reply:   FastifyReply,
) {
  const storeId = request.storeId;

  // Read multipart file
  const data = await (request as any).file();
  if (!data) {
    return reply.status(400).send({
      success: false,
      error: { code: 'NO_FILE', message: 'No XML file uploaded', statusCode: 400 },
    });
  }

  // Verify store belongs to this session
  const store = await prisma.store.findUnique({
    where:  { storeId },
    select: { storeId: true, orgId: true, currencyCode: true },
  });
  if (!store) {
    return reply.status(404).send({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Store not found', statusCode: 404 },
    });
  }

  // Stream XML body to string
  const chunks: Buffer[] = [];
  for await (const chunk of data.file) chunks.push(chunk);
  const xmlText = Buffer.concat(chunks).toString('utf-8');

  if (!xmlText.trim()) {
    return reply.status(400).send({
      success: false,
      error: { code: 'EMPTY_FILE', message: 'Uploaded file is empty', statusCode: 400 },
    });
  }

  const summary: ImportSummary = {
    productsImported:  0,
    customersImported: 0,
    invoicesImported:  0,
    errors:            [],
  };

  try {
    const parser = new XMLParser({
      ignoreAttributes:   false,
      attributeNamePrefix: '@_',
      isArray: (name) => ['STOCKITEM', 'LEDGER', 'VOUCHER', 'INVENTORYENTRY', 'ALLINVENTORYENTRIES'].includes(name),
    });
    const parsed = parser.parse(xmlText);

    // Tally exports use ENVELOPE as root (TallyPrime) or TALLYMESSAGE (ERP9)
    const envelope  = parsed.ENVELOPE ?? parsed.TALLYMESSAGE ?? {};
    const masters   = envelope.MASTER   ?? envelope.MASTERS  ?? {};
    const vouchers  = envelope.VOUCHERS ?? {};

    // ── 1. Import STOCKITEM → Product + ProductVariant ────────
    const stockItems: any[] = toArray(
      masters.STOCKITEM ??
      envelope.STOCKITEM ??
      envelope['STOCKITEM.LIST'],
    );

    for (const item of stockItems) {
      const name = str(item.NAME ?? item['@_NAME'] ?? item.name);
      if (!name) continue;

      try {
        // Upsert product by name within this store
        const existing = await prisma.product.findFirst({
          where: { storeId, name },
          select: { productId: true },
        });

        let productId: string;
        if (existing) {
          productId = existing.productId;
        } else {
          const sku0 = `TALLY-${name.replace(/[^A-Z0-9]/gi, '-').toUpperCase().slice(0, 20)}-001`;
          const created = await prisma.product.create({
            data: {
              storeId,
              name,
              internalSku:   sku0,
              pricingType:   'FIXED' as any,
              sellingPrice:  num(item.SELLINGPRICE ?? item.RATE ?? 0),
              purchasePrice: num(item.PURCHASEPRICE ?? item.COSTPRICE ?? 0),
              unitOfMeasure: mapTallyUnit(str(item.BASEUNITS ?? item.UNITS ?? '')) as any,
              hasVariants:   false,
              hasBatches:    false,
            },
          });
          productId = created.productId;

          // Create a default variant
          const sku = sku0;
          await prisma.productVariant.create({
            data: {
              storeId,
              productId,
              variantSku: sku,
              priceOverride: num(item.SELLINGPRICE ?? item.RATE ?? 0) || undefined,
            },
          });
          summary.productsImported++;
        }
      } catch (err: any) {
        summary.errors.push(`Product "${name}": ${err.message}`);
      }
    }

    // ── 2. Import LEDGER (party) → Customer ──────────────────
    const ledgers: any[] = toArray(
      masters.LEDGER ??
      envelope.LEDGER ??
      envelope['LEDGER.LIST'],
    );

    for (const ledger of ledgers) {
      const name         = str(ledger.NAME ?? ledger['@_NAME']);
      const partyType    = str(ledger.PARENT ?? '').toLowerCase();
      // Only import "Sundry Debtors" / "Sundry Creditors" (party ledgers)
      if (!name) continue;
      const isParty = partyType.includes('sundry') ||
                      partyType.includes('debtor') ||
                      partyType.includes('creditor') ||
                      partyType.includes('party');
      if (!isParty) continue;

      try {
        const existing = await prisma.customer.findFirst({
          where: { storeId, name },
          select: { customerId: true },
        });
        if (!existing) {
          const gstin = str(ledger.GSTREGISTRATIONTYPE !== 'Unknown' ? (ledger.GSTNO ?? '') : '');
          await prisma.customer.create({
            data: {
              storeId,
              name,
              creditLimit:  Math.abs(num(ledger.OPENINGBALANCE ?? 0)),
              customerType: gstin ? 'B2B' : 'B2C',
              gstin:        gstin || undefined,
              legalName:    str(ledger.LEDGERNAME ?? name) || undefined,
            },
          });
          summary.customersImported++;
        }
      } catch (err: any) {
        summary.errors.push(`Customer "${name}": ${err.message}`);
      }
    }

    // ── 3. Import VOUCHER (Sales) → Invoice ──────────────────
    const voucherList: any[] = toArray(
      vouchers.VOUCHER ??
      envelope.VOUCHER ??
      envelope['VOUCHER.LIST'],
    );

    for (const voucher of voucherList) {
      const vtype = str(voucher.VOUCHERTYPENAME ?? voucher['@_VCHTYPE'] ?? '').toLowerCase();
      if (!vtype.includes('sale')) continue;

      const partyName   = str(voucher.PARTYLEDGERNAME ?? voucher.PARTYNAME ?? '');
      const voucherDate = str(voucher.DATE ?? '');          // YYYYMMDD
      const voucherNo   = str(voucher.VOUCHERNUMBER ?? voucher.VOUCHERNO ?? '');

      try {
        // Skip if already imported (by invoice number)
        if (voucherNo) {
          const dup = await prisma.invoice.findFirst({
            where: { storeId, invoiceNumber: `TALLY-${voucherNo}` },
            select: { invoiceId: true },
          });
          if (dup) continue;
        }

        // Find or create customer
        let customerId: string | null = null;
        if (partyName) {
          const cust = await prisma.customer.findFirst({
            where:  { storeId, name: partyName },
            select: { customerId: true },
          });
          customerId = cust?.customerId ?? null;
        }

        // Parse line items from INVENTORYENTRIES / ALLINVENTORYENTRIES
        const invEntries: any[] = toArray(
          voucher.INVENTORYENTRIES ??
          voucher.ALLINVENTORYENTRIES ??
          voucher['INVENTORYENTRIES.LIST'],
        );

        const lineItems: Array<{
          variantId:     string;
          quantity:      number;
          unitPrice:     number;
          discountPct:   number;
          discountAmount: number;
        }> = [];

        let subtotal = 0;
        for (const entry of invEntries) {
          const itemName = str(entry.STOCKITEMNAME ?? entry.STOCKITEM ?? '');
          const qty      = Math.abs(num(entry.ACTUALQTY ?? entry.BILLEDQTY ?? 1));
          const rate     = Math.abs(num(entry.RATE ?? entry.AMOUNT ?? 0) / (qty || 1));

          if (!itemName || !qty) continue;

          const variant = await prisma.productVariant.findFirst({
            where:  { storeId, product: { name: itemName } },
            select: { variantId: true },
          });
          if (!variant) {
            summary.errors.push(`Invoice ${voucherNo}: product "${itemName}" not found — import products first`);
            continue;
          }

          lineItems.push({
            variantId:     variant.variantId,
            quantity:      qty,
            unitPrice:     rate,
            discountPct:   0,
            discountAmount: 0,
          });
          subtotal += qty * rate;
        }

        if (lineItems.length === 0) continue;

        // Parse invoice date (YYYYMMDD)
        let invoiceDate = new Date();
        if (voucherDate.length === 8) {
          invoiceDate = new Date(
            `${voucherDate.slice(0, 4)}-${voucherDate.slice(4, 6)}-${voucherDate.slice(6, 8)}T12:00:00.000Z`,
          );
        }

        const invoiceNumber = voucherNo ? `TALLY-${voucherNo}` : `TALLY-${Date.now()}`;

        await prisma.invoice.create({
          data: {
            storeId,
            customerId,
            invoiceNumber,
            invoiceDate,
            currencyCode:   store.currencyCode,
            exchangeRate:   1,
            subtotal,
            taxTotal:       0,
            discountTotal:  0,
            roundOff:       0,
            grandTotal:     subtotal,
            grandTotalBase: subtotal,
            paidAmount:     subtotal,
            creditAmount:   0,
            status:         'CONFIRMED',
            paymentMode:    'CASH',
            notes:          'Imported from Tally',
            billedBy:       (request as any).authUser.userId,
            lineItems: {
              create: lineItems.map(li => ({
                variantId:     li.variantId,
                productName:   'Imported',
                variantAttrs:  {},
                quantity:      li.quantity,
                unitPrice:     li.unitPrice,
                discountPct:   0,
                discountAmount: 0,
                taxableAmount: li.quantity * li.unitPrice,
                taxAmount:     0,
                taxBreakdown:  {},
                lineTotal:     li.quantity * li.unitPrice,
              })),
            },
          },
        });
        summary.invoicesImported++;
      } catch (err: any) {
        summary.errors.push(`Invoice "${voucherNo}": ${err.message}`);
      }
    }
  } catch (parseErr: any) {
    return reply.status(400).send({
      success: false,
      error: { code: 'INVALID_XML', message: `Could not parse XML: ${parseErr.message}`, statusCode: 400 },
    });
  }

  return reply.send({ success: true, data: summary });
}

// ── Helpers ──────────────────────────────────────────────────
function toArray(val: unknown): any[] {
  if (!val) return [];
  return Array.isArray(val) ? val : [val];
}

function str(val: unknown): string {
  if (val == null) return '';
  return String(val).trim();
}

function num(val: unknown): number {
  const n = parseFloat(String(val ?? 0).replace(/[^0-9.\-]/g, ''));
  return isNaN(n) ? 0 : n;
}

function mapTallyUnit(unit: string): string {
  const u = unit.toUpperCase();
  if (u === 'NOS' || u === 'NO' || u === 'PCS' || u === 'PC') return 'PCS';
  if (u === 'KGS' || u === 'KG')  return 'KG';
  if (u === 'GM'  || u === 'GMS') return 'GM';
  if (u === 'LTR' || u === 'L')   return 'LTR';
  if (u === 'ML')                  return 'ML';
  if (u === 'MTR' || u === 'M')   return 'MTR';
  if (u === 'BOX')                 return 'BOX';
  if (u === 'DOZ')                 return 'DOZEN';
  return 'PCS';
}
