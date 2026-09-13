import * as admin from 'firebase-admin';

export const otpAuthEnabled = process.env.OTP_AUTH === 'true';

// Lazy-initialise: defer JSON.parse until the first auth call so a missing or
// malformed FIREBASE_SERVICE_ACCOUNT_KEY does not crash the server on startup.
function getFirebaseApp(): admin.app.App {
  if (admin.apps.length) return admin.apps[0]!;

  const key       = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  const projectId = process.env.FIREBASE_PROJECT_ID;

  if (!key || !projectId) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY and FIREBASE_PROJECT_ID must be set');
  }

  return admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(key)),
    projectId,
  });
}

export const firebaseAuth      = { verifyIdToken: (token: string) => getFirebaseApp().auth().verifyIdToken(token) };
export const firebaseMessaging = { send: (msg: admin.messaging.Message) => getFirebaseApp().messaging().send(msg) };

/**
 * Verify Firebase idToken and return the decoded UID.
 * Throws if token is invalid or expired.
 */
export async function verifyFirebaseToken(idToken: string): Promise<string> {
  if (process.env.NODE_ENV !== 'production'
      && idToken.startsWith('dev-uid-')) {
    return idToken.slice('dev-uid-'.length);
  }
  const decoded = await firebaseAuth.verifyIdToken(idToken);
  return decoded.uid;
}

/**
 * Verify Firebase idToken and return uid + phone_number.
 * For dev bypass tokens, phone is undefined (lookup falls back to uid).
 * For real OTP tokens, phone is the E.164 number Firebase verified.
 */
export async function verifyFirebaseTokenFull(
  idToken: string,
): Promise<{ uid: string; phone?: string }> {
  if (process.env.NODE_ENV !== 'production'
      && idToken.startsWith('dev-uid-')) {
    return { uid: idToken.slice('dev-uid-'.length), phone: undefined };
  }
  const decoded = await firebaseAuth.verifyIdToken(idToken);
  return { uid: decoded.uid, phone: decoded.phone_number };
}

/**
 * Send FCM push notification to a device or topic.
 */
export async function sendPushNotification(params: {
  deviceToken?: string;
  topic?: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}) {
  const message: admin.messaging.Message = {
    notification: { title: params.title, body: params.body },
    data: params.data,
    ...(params.deviceToken ? { token: params.deviceToken } : { topic: params.topic! }),
  };
  return firebaseMessaging.send(message);
}
