import { z } from 'zod';
export declare const CreateTaxRuleSchema: z.ZodObject<{
    name: z.ZodString;
    taxRegime: z.ZodEnum<["GST", "VAT", "SALES_TAX", "EXEMPT", "CUSTOM"]>;
    countryCode: z.ZodDefault<z.ZodString>;
    totalRate: z.ZodNumber;
    isInclusive: z.ZodDefault<z.ZodBoolean>;
    components: z.ZodDefault<z.ZodArray<z.ZodObject<{
        componentName: z.ZodString;
        rate: z.ZodNumber;
        ledgerAccount: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        rate: number;
        componentName: string;
        ledgerAccount?: string | undefined;
    }, {
        rate: number;
        componentName: string;
        ledgerAccount?: string | undefined;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    name: string;
    countryCode: string;
    taxRegime: "GST" | "VAT" | "SALES_TAX" | "EXEMPT" | "CUSTOM";
    totalRate: number;
    isInclusive: boolean;
    components: {
        rate: number;
        componentName: string;
        ledgerAccount?: string | undefined;
    }[];
}, {
    name: string;
    taxRegime: "GST" | "VAT" | "SALES_TAX" | "EXEMPT" | "CUSTOM";
    totalRate: number;
    countryCode?: string | undefined;
    isInclusive?: boolean | undefined;
    components?: {
        rate: number;
        componentName: string;
        ledgerAccount?: string | undefined;
    }[] | undefined;
}>;
export declare const UpdateTaxRuleSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    totalRate: z.ZodOptional<z.ZodNumber>;
    isInclusive: z.ZodOptional<z.ZodBoolean>;
    isActive: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    isActive?: boolean | undefined;
    totalRate?: number | undefined;
    isInclusive?: boolean | undefined;
}, {
    name?: string | undefined;
    isActive?: boolean | undefined;
    totalRate?: number | undefined;
    isInclusive?: boolean | undefined;
}>;
export declare const HsnSearchQuerySchema: z.ZodObject<{
    q: z.ZodString;
    limit: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    q: string;
}, {
    q: string;
    limit?: number | undefined;
}>;
export declare const CreateStoreTaxRuleSchema: z.ZodObject<{
    name: z.ZodString;
    totalRate: z.ZodNumber;
    isInclusive: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    name: string;
    totalRate: number;
    isInclusive: boolean;
}, {
    name: string;
    totalRate: number;
    isInclusive?: boolean | undefined;
}>;
export type CreateTaxRuleInput = z.infer<typeof CreateTaxRuleSchema>;
export type UpdateTaxRuleInput = z.infer<typeof UpdateTaxRuleSchema>;
export type HsnSearchQuery = z.infer<typeof HsnSearchQuerySchema>;
export type CreateStoreTaxRuleInput = z.infer<typeof CreateStoreTaxRuleSchema>;
//# sourceMappingURL=schema.d.ts.map