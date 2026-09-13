import { z } from 'zod';

const TaxComponentSchema = z.object({
  componentName:  z.string().min(1).max(50),
  rate:           z.number().nonnegative(),
  ledgerAccount:  z.string().max(50).optional(),
});

export const CreateTaxRuleSchema = z.object({
  name:         z.string().min(1).max(100),
  taxRegime:    z.enum(['GST', 'VAT', 'SALES_TAX', 'EXEMPT', 'CUSTOM']),
  countryCode:  z.string().length(2).default('IN'),
  totalRate:    z.number().nonnegative(),
  isInclusive:  z.boolean().default(false),
  components:   z.array(TaxComponentSchema).default([]),
});

export const UpdateTaxRuleSchema = z.object({
  name:        z.string().min(1).max(100).optional(),
  totalRate:   z.number().nonnegative().optional(),
  isInclusive: z.boolean().optional(),
  isActive:    z.boolean().optional(),
});

export const HsnSearchQuerySchema = z.object({
  q:     z.string().min(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const CreateStoreTaxRuleSchema = z.object({
  name:        z.string().min(1).max(100),
  totalRate:   z.number().nonnegative(),
  isInclusive: z.boolean().default(false),
});

export type CreateTaxRuleInput      = z.infer<typeof CreateTaxRuleSchema>;
export type UpdateTaxRuleInput      = z.infer<typeof UpdateTaxRuleSchema>;
export type HsnSearchQuery          = z.infer<typeof HsnSearchQuerySchema>;
export type CreateStoreTaxRuleInput = z.infer<typeof CreateStoreTaxRuleSchema>;
