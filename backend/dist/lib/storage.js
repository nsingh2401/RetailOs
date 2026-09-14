"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateUploadSignedUrl = generateUploadSignedUrl;
exports.getPublicImageUrl = getPublicImageUrl;
const storage_1 = require("@google-cloud/storage");
// Lazy-initialise: only parse credentials when an upload is actually attempted.
// This prevents a startup crash when GCP_SERVICE_ACCOUNT_KEY is not configured
// (e.g. local dev environments that never call upload endpoints).
let _storage = null;
let _bucketName = null;
function getStorage() {
    if (!_storage) {
        const key = process.env.GCP_SERVICE_ACCOUNT_KEY;
        const projectId = process.env.GCP_PROJECT_ID;
        const bucketName = process.env.GCP_STORAGE_BUCKET;
        if (!key || !projectId || !bucketName) {
            throw new Error('GCP_SERVICE_ACCOUNT_KEY, GCP_PROJECT_ID, and GCP_STORAGE_BUCKET must be set');
        }
        _storage = new storage_1.Storage({ projectId, credentials: JSON.parse(key) });
        _bucketName = bucketName;
    }
    return { storage: _storage, bucketName: _bucketName };
}
/**
 * Generate a short-lived signed URL for direct Flutter → GCP upload.
 * Flutter uploads directly — backend never proxies the file bytes.
 */
async function generateUploadSignedUrl(params) {
    const { storeId, productId, imageId, mimeType, expiresInSeconds = 300 } = params;
    const { storage, bucketName } = getStorage();
    const filePath = `stores/${storeId}/products/${productId}/${imageId}.jpg`;
    const [url] = await storage.bucket(bucketName).file(filePath).getSignedUrl({
        action: 'write',
        expires: Date.now() + expiresInSeconds * 1000,
        contentType: mimeType,
    });
    return url;
}
/**
 * Get the public CDN URL for a stored product image.
 */
function getPublicImageUrl(storeId, productId, imageId) {
    const bucketName = process.env.GCP_STORAGE_BUCKET ?? '';
    return `https://storage.googleapis.com/${bucketName}/stores/${storeId}/products/${productId}/${imageId}.jpg`;
}
//# sourceMappingURL=storage.js.map