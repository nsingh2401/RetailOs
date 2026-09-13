import { z } from 'zod';

export const LineItemSchema = z.object({
  variantId:     z.string().uuid(),
  hsnCode:       z.string().optional(),
  batchId:       z.string().uuid().optional(),
  quantity:      z.number().positive(),
  unitPrice:     z.number().nonnegative(),
  discountPct:    z.number().min(0).max(100).default(0),
  discountAmount: z.number().nonnegative().default(0),
  taxRuleId:     z.string().uuid().optional(),
});

export const CreateInvoiceSchema = z.object({
  invoiceDate:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  customerId:    z.string().uuid().optional(),
  invoiceNumber: z.string().optional(),           // Auto-generated if omitted
  currencyCode:  z.string().length(3).default('INR'),
  paymentMode:   z.enum(['CASH','UPI','CREDIT','CARD','CHEQUE','OTHER']).optional(),
  notes:         z.string().optional(),
  localId:       z.string().optional(),           // WatermelonDB/Drift offline UUID
  lineItems:     z.array(LineItemSchema).min(1, 'At least one line item required'),
});

export const RecordPaymentSchema = z.object({
  paymentMethod: z.enum(['CASH','UPI','CREDIT','CARD','CHEQUE','OTHER']),
  amount:        z.number().positive(),
  currencyCode:  z.string().length(3).default('INR'),
  referenceNo:   z.string().optional(),           // UPI txn ID, cheque no, etc.
});

export const InvoiceListQuerySchema = z.object({
  status:      z.enum(['DRAFT','CONFIRMED','PAID','PARTIAL','CANCELLED']).optional(),
  from:        z.string().datetime().optional(),
  to:          z.string().datetime().optional(),
  customerId:  z.string().uuid().optional(),
  page:        z.coerce.number().int().positive().default(1),
  limit:       z.coerce.number().int().min(1).max(100).default(20),
});

export const CancelInvoiceSchema = z.object({
  reason: z.string().min(1),
});

export type CreateInvoiceInput  = z.infer<typeof CreateInvoiceSchema>;
export type RecordPaymentInput  = z.infer<typeof RecordPaymentSchema>;
export type InvoiceListQuery    = z.infer<typeof InvoiceListQuerySchema>;
export type CancelInvoiceInput  = z.infer<typeof CancelInvoiceSchema>;
