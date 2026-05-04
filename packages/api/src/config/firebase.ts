// import admin from 'firebase-admin';

// const serviceAccountBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;

// if (serviceAccountBase64) {
//   try {
//     const serviceAccount = JSON.parse(Buffer.from(serviceAccountBase64, 'base64').toString('utf8'));
//     admin.initializeApp({
//       credential: admin.credential.cert(serviceAccount),
//     });
//     console.log('🔥 Firebase Admin initialized with service account.');
//   } catch (error) {
//     console.error('❌ Failed to parse FIREBASE_SERVICE_ACCOUNT_BASE64:', error);
//   }
// } else {
//   console.warn('⚠️ FIREBASE_SERVICE_ACCOUNT_BASE64 not found. Firebase features will be disabled.');
// }

export const firebaseAdmin = {} as any;
