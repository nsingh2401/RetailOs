"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.firebaseMessaging = exports.firebaseAuth = exports.otpAuthEnabled = void 0;
exports.verifyFirebaseToken = verifyFirebaseToken;
exports.verifyFirebaseTokenFull = verifyFirebaseTokenFull;
exports.sendPushNotification = sendPushNotification;
const admin = __importStar(require("firebase-admin"));
exports.otpAuthEnabled = process.env.OTP_AUTH === 'true';
// Lazy-initialise: defer JSON.parse until the first auth call so a missing or
// malformed FIREBASE_SERVICE_ACCOUNT_KEY does not crash the server on startup.
function getFirebaseApp() {
    if (admin.apps.length)
        return admin.apps[0];
    const key = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    const projectId = process.env.FIREBASE_PROJECT_ID;
    if (!key || !projectId) {
        throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY and FIREBASE_PROJECT_ID must be set');
    }
    return admin.initializeApp({
        credential: admin.credential.cert(JSON.parse(key)),
        projectId,
    });
}
exports.firebaseAuth = { verifyIdToken: (token) => getFirebaseApp().auth().verifyIdToken(token) };
exports.firebaseMessaging = { send: (msg) => getFirebaseApp().messaging().send(msg) };
/**
 * Verify Firebase idToken and return the decoded UID.
 * Throws if token is invalid or expired.
 */
async function verifyFirebaseToken(idToken) {
    if (process.env.NODE_ENV !== 'production'
        && idToken.startsWith('dev-uid-')) {
        return idToken.slice('dev-uid-'.length);
    }
    const decoded = await exports.firebaseAuth.verifyIdToken(idToken);
    return decoded.uid;
}
/**
 * Verify Firebase idToken and return uid + phone_number.
 * For dev bypass tokens, phone is undefined (lookup falls back to uid).
 * For real OTP tokens, phone is the E.164 number Firebase verified.
 */
async function verifyFirebaseTokenFull(idToken) {
    if (process.env.NODE_ENV !== 'production'
        && idToken.startsWith('dev-uid-')) {
        return { uid: idToken.slice('dev-uid-'.length), phone: undefined };
    }
    const decoded = await exports.firebaseAuth.verifyIdToken(idToken);
    return { uid: decoded.uid, phone: decoded.phone_number };
}
/**
 * Send FCM push notification to a device or topic.
 */
async function sendPushNotification(params) {
    const message = {
        notification: { title: params.title, body: params.body },
        data: params.data,
        ...(params.deviceToken ? { token: params.deviceToken } : { topic: params.topic }),
    };
    return exports.firebaseMessaging.send(message);
}
//# sourceMappingURL=firebase.js.map