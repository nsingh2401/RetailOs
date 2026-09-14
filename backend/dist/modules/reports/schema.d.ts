import { z } from 'zod';
export declare const DateRangeQuerySchema: z.ZodObject<{
    from: z.ZodString;
    to: z.ZodString;
    groupBy: z.ZodDefault<z.ZodOptional<z.ZodEnum<["day", "week", "month"]>>>;
}, "strip", z.ZodTypeAny, {
    from: string;
    to: string;
    groupBy: "day" | "week" | "month";
}, {
    from: string;
    to: string;
    groupBy?: "day" | "week" | "month" | undefined;
}>;
export declare const TopProductsQuerySchema: z.ZodObject<{
    from: z.ZodString;
    to: z.ZodString;
    limit: z.ZodDefault<z.ZodNumber>;
    sortBy: z.ZodDefault<z.ZodEnum<["revenue", "quantity"]>>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    from: string;
    to: string;
    sortBy: "quantity" | "revenue";
}, {
    from: string;
    to: string;
    limit?: number | undefined;
    sortBy?: "quantity" | "revenue" | undefined;
}>;
export declare const ReportBaseQuerySchema: z.ZodObject<{
    from: z.ZodString;
    to: z.ZodString;
}, "strip", z.ZodTypeAny, {
    from: string;
    to: string;
}, {
    from: string;
    to: string;
}>;
export declare const ExportQuerySchema: z.ZodObject<{
    type: z.ZodEnum<["gstr1", "gstr3b", "sales"]>;
    format: z.ZodEnum<["json", "excel"]>;
    from: z.ZodString;
    to: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: "gstr1" | "gstr3b" | "sales";
    from: string;
    to: string;
    format: "json" | "excel";
}, {
    type: "gstr1" | "gstr3b" | "sales";
    from: string;
    to: string;
    format: "json" | "excel";
}>;
export declare const TallyExportQuerySchema: z.ZodObject<{
    format: z.ZodEnum<["xml", "csv"]>;
    tallyVersion: z.ZodDefault<z.ZodEnum<["erp9", "prime"]>>;
    from: z.ZodString;
    to: z.ZodString;
}, "strip", z.ZodTypeAny, {
    tallyVersion: "erp9" | "prime";
    from: string;
    to: string;
    format: "xml" | "csv";
}, {
    from: string;
    to: string;
    format: "xml" | "csv";
    tallyVersion?: "erp9" | "prime" | undefined;
}>;
export type DateRangeQuery = z.infer<typeof DateRangeQuerySchema>;
export type TopProductsQuery = z.infer<typeof TopProductsQuerySchema>;
export type ReportBaseQuery = z.infer<typeof ReportBaseQuerySchema>;
export type ExportQuery = z.infer<typeof ExportQuerySchema>;
export type TallyExportQuery = z.infer<typeof TallyExportQuerySchema>;
//# sourceMappingURL=schema.d.ts.map