import admin from 'firebase-admin';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootJsonPath = path.resolve(__dirname, '../../../../vanikicropweb-firebase-adminsdk-fbsvc-39ad5b61d0.json');
const legacyJsonPath = path.resolve(__dirname, '../../../../vanikicrop-d9355-firebase-adminsdk-fbsvc-a1c26af925.json');

try {
  if (admin.apps.length === 0) {
    if (fs.existsSync(rootJsonPath)) {
      const fileContent = fs.readFileSync(rootJsonPath, 'utf8');
      const serviceAccount = JSON.parse(fileContent);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      console.log('[FIREBASE] Successfully initialized Firebase Admin using service account JSON file (vanikicropweb)');
    } else if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
      const decoded = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8');
      const serviceAccount = JSON.parse(decoded);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      console.log('[FIREBASE] Successfully initialized Firebase Admin using Base64 environment variable');
    } else if (fs.existsSync(legacyJsonPath)) {
      const fileContent = fs.readFileSync(legacyJsonPath, 'utf8');
      const serviceAccount = JSON.parse(fileContent);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      console.log('[FIREBASE] Successfully initialized Firebase Admin using legacy service account JSON file (vanikicrop-d9355)');
    } else {
      console.warn('[FIREBASE] Warning: No Firebase service account credentials found.');
    }
  }
} catch (error: any) {
  console.error('[FIREBASE] Initialization error:', error.message);
}

export function getFirebaseAdmin() {
  return admin.apps.length > 0 ? admin : null;
}

export { admin as firebaseAdmin };
