import { z } from 'zod';
export declare const CreateCustomerSchema: z.ZodObject<{
    name: z.ZodString;
    phone: z.ZodOptional<z.ZodString>;
    email: z.ZodOptional<z.ZodString>;
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
    creditLimit: z.ZodDefault<z.ZodNumber>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    creditLimit: number;
    email?: string | undefined;
    phone?: string | undefined;
    address?: {
        line1?: string | undefined;
        city?: string | undefined;
        state?: string | undefined;
        pincode?: string | undefined;
        country?: string | undefined;
    } | undefined;
    notes?: string | undefined;
}, {
    name: string;
    email?: string | undefined;
    phone?: string | undefined;
    address?: {
        line1?: string | undefined;
        city?: string | undefined;
        state?: string | undefined;
        pincode?: string | undefined;
        country?: string | undefined;
    } | undefined;
    notes?: string | undefined;
    creditLimit?: number | undefined;
}>;
export declare const UpdateCustomerSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    phone: z.ZodOptional<z.ZodString>;
    email: z.ZodOptional<z.ZodString>;
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
    creditLimit: z.ZodOptional<z.ZodNumber>;
    notes: z.ZodOptional<z.ZodString>;
    isActive: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    email?: string | undefined;
    phone?: string | undefined;
    name?: string | undefined;
    isActive?: boolean | undefined;
    address?: {
        line1?: string | undefined;
        city?: string | undefined;
        state?: string | undefined;
        pincode?: string | undefined;
        country?: string | undefined;
    } | undefined;
    notes?: string | undefined;
    creditLimit?: number | undefined;
}, {
    email?: string | undefined;
    phone?: string | undefined;
    name?: string | undefined;
    isActive?: boolean | undefined;
    address?: {
        line1?: string | undefined;
        city?: string | undefined;
        state?: string | undefined;
        pincode?: string | undefined;
        country?: string | undefined;
    } | undefined;
    notes?: string | undefined;
    creditLimit?: number | undefined;
}>;
export declare const CustomerSearchQuerySchema: z.ZodObject<{
    q: z.ZodString;
    limit: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    q: string;
}, {
    q: string;
    limit?: number | undefined;
}>;
export declare const CustomerListQuerySchema: z.ZodObject<{
    hasBalance: z.ZodOptional<z.ZodBoolean>;
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    page: number;
    limit: number;
    hasBalance?: boolean | undefined;
}, {
    page?: number | undefined;
    limit?: number | undefined;
    hasBalance?: boolean | undefined;
}>;
export declare const RecordCreditPaymentSchema: z.ZodObject<{
    amount: z.ZodNumber;
    paymentMethod: z.ZodEnum<["CASH", "UPI", "CARD", "CHEQUE", "OTHER"]>;
    referenceNo: z.ZodOptional<z.ZodString>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    paymentMethod: "CASH" | "UPI" | "CARD" | "CHEQUE" | "OTHER";
    amount: number;
    notes?: string | undefined;
    referenceNo?: string | undefined;
}, {
    paymentMethod: "CASH" | "UPI" | "CARD" | "CHEQUE" | "OTHER";
    amount: number;
    notes?: string | undefined;
    referenceNo?: string | undefined;
}>;
export declare const CreditLedgerQuerySchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    page: number;
    limit: number;
}, {
    page?: number | undefined;
    limit?: number | undefined;
}>;
export type CreateCustomerInput = z.infer<typeof CreateCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof UpdateCustomerSchema>;
export type CustomerSearchQuery = z.infer<typeof CustomerSearchQuerySchema>;
export type CustomerListQuery = z.infer<typeof CustomerListQuerySchema>;
export type RecordCreditPaymentInput = z.infer<typeof RecordCreditPaymentSchema>;
export type CreditLedgerQuery = z.infer<typeof CreditLedgerQuerySchema>;
//# sourceMappingURL=schema.d.ts.map