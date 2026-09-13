import { z } from 'zod';

// ── Address sub-schema ─────────────────────────────────────────
const AddressSchema = z.object({
  line1:   z.string().optional(),
  city:    z.string().optional(),
  state:   z.string().optional(),
  pincode: z.string().optional(),
  country: z.string().optional(),
});

// ── Create ─────────────────────────────────────────────────────
export const CreateCustomerSchema = z.object({
  name:        z.string().min(1).max(200),
  phone:       z.string().regex(/^\+[1-9]\d{7,14}$/).optional(),
  email:       z.string().email().optional(),
  address:     AddressSchema.optional(),
  creditLimit: z.number().nonnegative().default(0),
  notes:       z.string().optional(),
});

// ── Update ─────────────────────────────────────────────────────
export const UpdateCustomerSchema = z.object({
  name:        z.string().min(1).max(200).optional(),
  phone:       z.string().regex(/^\+[1-9]\d{7,14}$/).optional(),
  email:       z.string().email().optional(),
  address:     AddressSchema.optional(),
  creditLimit: z.number().nonnegative().optional(),
  notes:       z.string().optional(),
  isActive:    z.boolean().optional(),
});

// ── Search ─────────────────────────────────────────────────────
export const CustomerSearchQuerySchema = z.object({
  q:     z.string().min(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

// ── List ───────────────────────────────────────────────────────
export const CustomerListQuerySchema = z.object({
  hasBalance: z.coerce.boolean().optional(),
  page:       z.coerce.number().int().positive().default(1),
  limit:      z.coerce.number().int().min(1).max(100).default(20),
});

// ── Credit payment ─────────────────────────────────────────────
export const RecordCreditPaymentSchema = z.object({
  amount:        z.number().positive(),
  paymentMethod: z.enum(['CASH', 'UPI', 'CARD', 'CHEQUE', 'OTHER']),
  referenceNo:   z.string().optional(),
  notes:         z.string().optional(),
});

// ── Credit ledger query ────────────────────────────────────────
export const CreditLedgerQuerySchema = z.object({
  page:  z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ── Types ──────────────────────────────────────────────────────
export type CreateCustomerInput      = z.infer<typeof CreateCustomerSchema>;
export type UpdateCustomerInput      = z.infer<typeof UpdateCustomerSchema>;
export type CustomerSearchQuery      = z.infer<typeof CustomerSearchQuerySchema>;
export type CustomerListQuery        = z.infer<typeof CustomerListQuerySchema>;
export type RecordCreditPaymentInput = z.infer<typeof RecordCreditPaymentSchema>;
export type CreditLedgerQuery        = z.infer<typeof CreditLedgerQuerySchema>;
