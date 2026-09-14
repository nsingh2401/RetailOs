import { z } from 'zod';
export declare const RequestUploadUrlSchema: z.ZodObject<{
    productId: z.ZodString;
    mimeType: z.ZodEnum<["image/jpeg", "image/png", "image/webp"]>;
    cameraAngle: z.ZodOptional<z.ZodEnum<["FRONT", "BACK", "SIDE", "BARCODE", "LABEL", "TOP"]>>;
    lighting: z.ZodOptional<z.ZodEnum<["NATURAL", "FLUORESCENT", "POOR", "BRIGHT"]>>;
    captureDevice: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    productId: string;
    mimeType: "image/jpeg" | "image/png" | "image/webp";
    cameraAngle?: "FRONT" | "BACK" | "SIDE" | "BARCODE" | "LABEL" | "TOP" | undefined;
    lighting?: "NATURAL" | "FLUORESCENT" | "POOR" | "BRIGHT" | undefined;
    captureDevice?: string | undefined;
}, {
    productId: string;
    mimeType: "image/jpeg" | "image/png" | "image/webp";
    cameraAngle?: "FRONT" | "BACK" | "SIDE" | "BARCODE" | "LABEL" | "TOP" | undefined;
    lighting?: "NATURAL" | "FLUORESCENT" | "POOR" | "BRIGHT" | undefined;
    captureDevice?: string | undefined;
}>;
export declare const ConfirmUploadSchema: z.ZodObject<{
    imageId: z.ZodString;
    imageUrl: z.ZodString;
    thumbnailUrl: z.ZodOptional<z.ZodString>;
    isPrimary: z.ZodDefault<z.ZodBoolean>;
    cameraAngle: z.ZodOptional<z.ZodEnum<["FRONT", "BACK", "SIDE", "BARCODE", "LABEL", "TOP"]>>;
    lighting: z.ZodOptional<z.ZodEnum<["NATURAL", "FLUORESCENT", "POOR", "BRIGHT"]>>;
    captureDevice: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    imageUrl: string;
    isPrimary: boolean;
    imageId: string;
    thumbnailUrl?: string | undefined;
    cameraAngle?: "FRONT" | "BACK" | "SIDE" | "BARCODE" | "LABEL" | "TOP" | undefined;
    lighting?: "NATURAL" | "FLUORESCENT" | "POOR" | "BRIGHT" | undefined;
    captureDevice?: string | undefined;
}, {
    imageUrl: string;
    imageId: string;
    thumbnailUrl?: string | undefined;
    isPrimary?: boolean | undefined;
    cameraAngle?: "FRONT" | "BACK" | "SIDE" | "BARCODE" | "LABEL" | "TOP" | undefined;
    lighting?: "NATURAL" | "FLUORESCENT" | "POOR" | "BRIGHT" | undefined;
    captureDevice?: string | undefined;
}>;
export declare const ConfirmUploadQuerySchema: z.ZodObject<{
    productId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    productId: string;
}, {
    productId: string;
}>;
export declare const BulkImportQuerySchema: z.ZodObject<{
    dryRun: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    dryRun: boolean;
}, {
    dryRun?: boolean | undefined;
}>;
export type RequestUploadUrlInput = z.infer<typeof RequestUploadUrlSchema>;
export type ConfirmUploadInput = z.infer<typeof ConfirmUploadSchema>;
export type ConfirmUploadQuery = z.infer<typeof ConfirmUploadQuerySchema>;
export type BulkImportQuery = z.infer<typeof BulkImportQuerySchema>;
//# sourceMappingURL=schema.d.ts.map