import * as admin from 'firebase-admin';
export declare const otpAuthEnabled: boolean;
export declare const firebaseAuth: {
    verifyIdToken: (token: string) => Promise<import("firebase-admin/lib/auth/token-verifier").DecodedIdToken>;
};
export declare const firebaseMessaging: {
    send: (msg: admin.messaging.Message) => Promise<string>;
};
/**
 * Verify Firebase idToken and return the decoded UID.
 * Throws if token is invalid or expired.
 */
export declare function verifyFirebaseToken(idToken: string): Promise<string>;
/**
 * Verify Firebase idToken and return uid + phone_number.
 * For dev bypass tokens, phone is undefined (lookup falls back to uid).
 * For real OTP tokens, phone is the E.164 number Firebase verified.
 */
export declare function verifyFirebaseTokenFull(idToken: string): Promise<{
    uid: string;
    phone?: string;
}>;
/**
 * Send FCM push notification to a device or topic.
 */
export declare function sendPushNotification(params: {
    deviceToken?: string;
    topic?: string;
    title: string;
    body: string;
    data?: Record<string, string>;
}): Promise<string>;
//# sourceMappingURL=firebase.d.ts.map