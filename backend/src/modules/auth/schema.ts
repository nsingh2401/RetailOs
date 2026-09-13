import { z } from 'zod';

export const VerifyTokenSchema = z.object({
  idToken: z.string().min(1, 'idToken is required'),
});

export const InviteUserSchema = z.object({
  name:     z.string().min(1),
  phone:    z.string().regex(/^\+[1-9]\d{7,14}$/).optional(),
  email:    z.string().email().optional(),
  userType: z.enum(['OWNER', 'MANAGER', 'OPERATOR']),
}).refine(d => d.phone || d.email, { message: 'phone or email is required' });

export const UpdateUserSchema = z.object({
  name:     z.string().min(1).optional(),
  phone:    z.string().regex(/^\+[1-9]\d{7,14}$/).optional(),
  isActive: z.boolean().optional(),
});

export const AssignStoreRoleSchema = z.object({
  userId: z.string().uuid(),
  role:   z.enum(['OWNER', 'MANAGER', 'OPERATOR']),
});

export const UpdateStoreRoleSchema = z.object({
  role: z.enum(['OWNER', 'MANAGER', 'OPERATOR']),
});

// ── Address sub-object (reused in store schemas) ──────────────
const AddressSchema = z.object({
  line1:   z.string().optional(),
  city:    z.string().optional(),
  state:   z.string().optional(),
  pincode: z.string().optional(),
  country: z.string().optional(),
});

// ── Create store ───────────────────────────────────────────────
export const CreateStoreSchema = z.object({
  name:              z.string().min(1).max(200),
  storeCode:         z.string().min(1).max(30),
  industryType:      z.enum([
    'APPAREL', 'FOOTWEAR', 'GROCERY', 'PHARMACY', 'ELECTRONICS',
    'HARDWARE', 'OPTICAL', 'KITCHENWARE', 'STATIONERY', 'TOYS',
    'GIFT', 'BAKERY', 'PAINT', 'FURNITURE', 'JEWELRY', 'BAGS',
    'TEA_CAFE', 'PAAN_CIGARETTE', 'GENERAL',
  ] as const).default('GENERAL'),
  phone:             z.string().optional(),
  gstin:             z.string().max(20).optional(),
  currencyCode:      z.string().length(3).default('INR'),
  timezone:          z.string().default('Asia/Kolkata'),
  lowStockThreshold: z.number().int().default(10),
  address:           AddressSchema.optional(),
});

// ── Update store ───────────────────────────────────────────────
export const UpdateStoreSchema = z.object({
  name:              z.string().optional(),
  phone:             z.string().optional(),
  gstin:             z.string().optional(),
  lowStockThreshold: z.number().int().optional(),
  address:           AddressSchema.optional(),
  isActive:          z.boolean().optional(),
});

// ── Update org settings ────────────────────────────────────────
export const UpdateOrgSettingsSchema = z.object({
  settings:        z.record(z.unknown()),
  defaultCurrency: z.string().length(3).optional(),
  locale:          z.string().optional(),
});

export const LoginSchema = z.object({
  phone:    z.string().regex(/^\+[1-9]\d{7,14}$/),
  password: z.string().min(6),
});

export const SetPasswordSchema = z.object({
  password:        z.string().min(6),
  confirmPassword: z.string().min(6),
}).refine(d => d.password === d.confirmPassword, {
  message: 'Passwords do not match',
});

export const ForgotPasswordSchema = z.object({
  phone: z.string().regex(/^\+[1-9]\d{7,14}$/),
});

export const ResetPasswordSchema = z.object({
  phone:           z.string().regex(/^\+[1-9]\d{7,14}$/),
  idToken:         z.string().min(1),
  newPassword:     z.string().min(6),
  confirmPassword: z.string().min(6),
}).refine(d => d.newPassword === d.confirmPassword, {
  message: 'Passwords do not match',
});

export const SignupSchema = z.object({
  idToken:      z.string().min(1),
  ownerName:    z.string().min(1).max(150),
  phone:        z.string().regex(/^\+[1-9]\d{7,14}$/),
  businessName: z.string().min(1).max(200),
  storeName:    z.string().min(1).max(200),
  password:     z.string().min(6),
  industryType: z.enum([
    'GROCERY','PHARMACY','APPAREL','FOOTWEAR',
    'OPTICAL','BAKERY','HARDWARE','ELECTRONICS',
    'ELECTRICAL','JEWELRY','FURNITURE','PAINT',
    'STATIONERY','GIFT','KITCHENWARE','TOYS',
    'TEA_CAFE','BAGS','GENERAL',
  ]),
});

export type VerifyTokenInput        = z.infer<typeof VerifyTokenSchema>;
export type InviteUserInput         = z.infer<typeof InviteUserSchema>;
export type UpdateUserInput         = z.infer<typeof UpdateUserSchema>;
export type AssignStoreRoleInput    = z.infer<typeof AssignStoreRoleSchema>;
export type UpdateStoreRoleInput    = z.infer<typeof UpdateStoreRoleSchema>;
export type CreateStoreInput        = z.infer<typeof CreateStoreSchema>;
export type UpdateStoreInput        = z.infer<typeof UpdateStoreSchema>;
export type UpdateOrgSettingsInput  = z.infer<typeof UpdateOrgSettingsSchema>;
export type LoginInput              = z.infer<typeof LoginSchema>;
export type SetPasswordInput        = z.infer<typeof SetPasswordSchema>;
export type ForgotPasswordInput     = z.infer<typeof ForgotPasswordSchema>;
export type ResetPasswordInput      = z.infer<typeof ResetPasswordSchema>;
export type SignupInput             = z.infer<typeof SignupSchema>;
