import { z } from 'zod';
export declare const VerifyTokenSchema: z.ZodObject<{
    idToken: z.ZodString;
}, "strip", z.ZodTypeAny, {
    idToken: string;
}, {
    idToken: string;
}>;
export declare const InviteUserSchema: z.ZodEffects<z.ZodObject<{
    name: z.ZodString;
    phone: z.ZodOptional<z.ZodString>;
    email: z.ZodOptional<z.ZodString>;
    userType: z.ZodEnum<["OWNER", "MANAGER", "OPERATOR"]>;
}, "strip", z.ZodTypeAny, {
    name: string;
    userType: "OWNER" | "MANAGER" | "OPERATOR";
    email?: string | undefined;
    phone?: string | undefined;
}, {
    name: string;
    userType: "OWNER" | "MANAGER" | "OPERATOR";
    email?: string | undefined;
    phone?: string | undefined;
}>, {
    name: string;
    userType: "OWNER" | "MANAGER" | "OPERATOR";
    email?: string | undefined;
    phone?: string | undefined;
}, {
    name: string;
    userType: "OWNER" | "MANAGER" | "OPERATOR";
    email?: string | undefined;
    phone?: string | undefined;
}>;
export declare const UpdateUserSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    phone: z.ZodOptional<z.ZodString>;
    isActive: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    phone?: string | undefined;
    name?: string | undefined;
    isActive?: boolean | undefined;
}, {
    phone?: string | undefined;
    name?: string | undefined;
    isActive?: boolean | undefined;
}>;
export declare const AssignStoreRoleSchema: z.ZodObject<{
    userId: z.ZodString;
    role: z.ZodEnum<["OWNER", "MANAGER", "OPERATOR"]>;
}, "strip", z.ZodTypeAny, {
    userId: string;
    role: "OWNER" | "MANAGER" | "OPERATOR";
}, {
    userId: string;
    role: "OWNER" | "MANAGER" | "OPERATOR";
}>;
export declare const UpdateStoreRoleSchema: z.ZodObject<{
    role: z.ZodEnum<["OWNER", "MANAGER", "OPERATOR"]>;
}, "strip", z.ZodTypeAny, {
    role: "OWNER" | "MANAGER" | "OPERATOR";
}, {
    role: "OWNER" | "MANAGER" | "OPERATOR";
}>;
export declare const CreateStoreSchema: z.ZodObject<{
    name: z.ZodString;
    storeCode: z.ZodString;
    industryType: z.ZodDefault<z.ZodEnum<["APPAREL", "FOOTWEAR", "GROCERY", "PHARMACY", "ELECTRONICS", "HARDWARE", "OPTICAL", "KITCHENWARE", "STATIONERY", "TOYS", "GIFT", "BAKERY", "PAINT", "FURNITURE", "JEWELRY", "BAGS", "TEA_CAFE", "PAAN_CIGARETTE", "GENERAL"]>>;
    phone: z.ZodOptional<z.ZodString>;
    gstin: z.ZodOptional<z.ZodString>;
    currencyCode: z.ZodDefault<z.ZodString>;
    timezone: z.ZodDefault<z.ZodString>;
    lowStockThreshold: z.ZodDefault<z.ZodNumber>;
    address: z.ZodOptional<z.ZodObject<{
        line1: z.ZodOptional<z.ZodString>;
        city: z.ZodOptional<z.ZodString>;
        state: z.ZodOptional<z.ZodString>;
        pincode: z.ZodOptional<z.ZodString>;
        country: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        line1?: string | undefined;
        city?: string | undefined;
        state?: string | undefined;
        pincode?: string | undefined;
        country?: string | undefined;
    }, {
        line1?: string | undefined;
        city?: string | undefined;
        state?: string | undefined;
        pincode?: string | undefined;
        country?: string | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    industryType: "APPAREL" | "FOOTWEAR" | "GROCERY" | "PHARMACY" | "ELECTRONICS" | "HARDWARE" | "OPTICAL" | "KITCHENWARE" | "STATIONERY" | "TOYS" | "GIFT" | "BAKERY" | "PAINT" | "FURNITURE" | "JEWELRY" | "BAGS" | "TEA_CAFE" | "PAAN_CIGARETTE" | "GENERAL";
    storeCode: string;
    currencyCode: string;
    timezone: string;
    lowStockThreshold: number;
    phone?: string | undefined;
    gstin?: string | undefined;
    address?: {
        line1?: string | undefined;
        city?: string | undefined;
        state?: string | undefined;
        pincode?: string | undefined;
        country?: string | undefined;
    } | undefined;
}, {
    name: string;
    storeCode: string;
    phone?: string | undefined;
    industryType?: "APPAREL" | "FOOTWEAR" | "GROCERY" | "PHARMACY" | "ELECTRONICS" | "HARDWARE" | "OPTICAL" | "KITCHENWARE" | "STATIONERY" | "TOYS" | "GIFT" | "BAKERY" | "PAINT" | "FURNITURE" | "JEWELRY" | "BAGS" | "TEA_CAFE" | "PAAN_CIGARETTE" | "GENERAL" | undefined;
    gstin?: string | undefined;
    currencyCode?: string | undefined;
    timezone?: string | undefined;
    lowStockThreshold?: number | undefined;
    address?: {
        line1?: string | undefined;
        city?: string | undefined;
        state?: string | undefined;
        pincode?: string | undefined;
        country?: string | undefined;
    } | undefined;
}>;
export declare const UpdateStoreSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    phone: z.ZodOptional<z.ZodString>;
    gstin: z.ZodOptional<z.ZodString>;
    lowStockThreshold: z.ZodOptional<z.ZodNumber>;
    address: z.ZodOptional<z.ZodObject<{
        line1: z.ZodOptional<z.ZodString>;
        city: z.ZodOptional<z.ZodString>;
        state: z.ZodOptional<z.ZodString>;
        pincode: z.ZodOptional<z.ZodString>;
        country: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        line1?: string | undefined;
        city?: string | undefined;
        state?: string | undefined;
        pincode?: string | undefined;
        country?: string | undefined;
    }, {
        line1?: string | undefined;
        city?: string | undefined;
        state?: string | undefined;
        pincode?: string | undefined;
        country?: string | undefined;
    }>>;
    isActive: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    phone?: string | undefined;
    name?: string | undefined;
    isActive?: boolean | undefined;
    gstin?: string | undefined;
    lowStockThreshold?: number | undefined;
    address?: {
        line1?: string | undefined;
        city?: string | undefined;
        state?: string | undefined;
        pincode?: string | undefined;
        country?: string | undefined;
    } | undefined;
}, {
    phone?: string | undefined;
    name?: string | undefined;
    isActive?: boolean | undefined;
    gstin?: string | undefined;
    lowStockThreshold?: number | undefined;
    address?: {
        line1?: string | undefined;
        city?: string | undefined;
        state?: string | undefined;
        pincode?: string | undefined;
        country?: string | undefined;
    } | undefined;
}>;
export declare const UpdateOrgSettingsSchema: z.ZodObject<{
    settings: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    defaultCurrency: z.ZodOptional<z.ZodString>;
    locale: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    settings: Record<string, unknown>;
    defaultCurrency?: string | undefined;
    locale?: string | undefined;
}, {
    settings: Record<string, unknown>;
    defaultCurrency?: string | undefined;
    locale?: string | undefined;
}>;
export declare const LoginSchema: z.ZodObject<{
    phone: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    phone: string;
    password: string;
}, {
    phone: string;
    password: string;
}>;
export declare const SetPasswordSchema: z.ZodEffects<z.ZodObject<{
    password: z.ZodString;
    confirmPassword: z.ZodString;
}, "strip", z.ZodTypeAny, {
    password: string;
    confirmPassword: string;
}, {
    password: string;
    confirmPassword: string;
}>, {
    password: string;
    confirmPassword: string;
}, {
    password: string;
    confirmPassword: string;
}>;
export declare const ForgotPasswordSchema: z.ZodObject<{
    phone: z.ZodString;
}, "strip", z.ZodTypeAny, {
    phone: string;
}, {
    phone: string;
}>;
export declare const ResetPasswordSchema: z.ZodEffects<z.ZodObject<{
    phone: z.ZodString;
    idToken: z.ZodString;
    newPassword: z.ZodString;
    confirmPassword: z.ZodString;
}, "strip", z.ZodTypeAny, {
    phone: string;
    idToken: string;
    confirmPassword: string;
    newPassword: string;
}, {
    phone: string;
    idToken: string;
    confirmPassword: string;
    newPassword: string;
}>, {
    phone: string;
    idToken: string;
    confirmPassword: string;
    newPassword: string;
}, {
    phone: string;
    idToken: string;
    confirmPassword: string;
    newPassword: string;
}>;
export declare const SignupSchema: z.ZodObject<{
    idToken: z.ZodString;
    ownerName: z.ZodString;
    phone: z.ZodString;
    businessName: z.ZodString;
    storeName: z.ZodString;
    password: z.ZodString;
    industryType: z.ZodEnum<["GROCERY", "PHARMACY", "APPAREL", "FOOTWEAR", "OPTICAL", "BAKERY", "HARDWARE", "ELECTRONICS", "ELECTRICAL", "JEWELRY", "FURNITURE", "PAINT", "STATIONERY", "GIFT", "KITCHENWARE", "TOYS", "TEA_CAFE", "BAGS", "GENERAL"]>;
}, "strip", z.ZodTypeAny, {
    phone: string;
    industryType: "APPAREL" | "FOOTWEAR" | "GROCERY" | "PHARMACY" | "ELECTRONICS" | "HARDWARE" | "OPTICAL" | "KITCHENWARE" | "STATIONERY" | "TOYS" | "GIFT" | "BAKERY" | "PAINT" | "FURNITURE" | "JEWELRY" | "BAGS" | "TEA_CAFE" | "GENERAL" | "ELECTRICAL";
    idToken: string;
    password: string;
    ownerName: string;
    businessName: string;
    storeName: string;
}, {
    phone: string;
    industryType: "APPAREL" | "FOOTWEAR" | "GROCERY" | "PHARMACY" | "ELECTRONICS" | "HARDWARE" | "OPTICAL" | "KITCHENWARE" | "STATIONERY" | "TOYS" | "GIFT" | "BAKERY" | "PAINT" | "FURNITURE" | "JEWELRY" | "BAGS" | "TEA_CAFE" | "GENERAL" | "ELECTRICAL";
    idToken: string;
    password: string;
    ownerName: string;
    businessName: string;
    storeName: string;
}>;
export type VerifyTokenInput = z.infer<typeof VerifyTokenSchema>;
export type InviteUserInput = z.infer<typeof InviteUserSchema>;
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
export type AssignStoreRoleInput = z.infer<typeof AssignStoreRoleSchema>;
export type UpdateStoreRoleInput = z.infer<typeof UpdateStoreRoleSchema>;
export type CreateStoreInput = z.infer<typeof CreateStoreSchema>;
export type UpdateStoreInput = z.infer<typeof UpdateStoreSchema>;
export type UpdateOrgSettingsInput = z.infer<typeof UpdateOrgSettingsSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type SetPasswordInput = z.infer<typeof SetPasswordSchema>;
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;
export type SignupInput = z.infer<typeof SignupSchema>;
//# sourceMappingURL=schema.d.ts.map