/**
 * Generate a short-lived signed URL for direct Flutter → GCP upload.
 * Flutter uploads directly — backend never proxies the file bytes.
 */
export declare function generateUploadSignedUrl(params: {
    storeId: string;
    productId: string;
    imageId: string;
    mimeType: string;
    expiresInSeconds?: number;
}): Promise<string>;
/**
 * Get the public CDN URL for a stored product image.
 */
export declare function getPublicImageUrl(storeId: string, productId: string, imageId: string): string;
//# sourceMappingURL=storage.d.ts.map