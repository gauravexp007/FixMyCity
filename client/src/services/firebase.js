import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAnalytics, isSupported } from 'firebase/analytics';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';

// Firebase web config is public by design (it only identifies the project).
// Values can be overridden per environment with VITE_FIREBASE_* variables.
const env = import.meta.env || {};

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || 'AIzaSyC_fHGHJs_7ux9W7KCFLhU6_7JjMYC-5w8',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || 'fixmycity-51576.firebaseapp.com',
  projectId: env.VITE_FIREBASE_PROJECT_ID || 'fixmycity-51576',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || 'fixmycity-51576.firebasestorage.app',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '398656960196',
  appId: env.VITE_FIREBASE_APP_ID || '1:398656960196:web:f61c754d3704caa6d3bb91',
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID || 'G-8KF5186762',
};

// Reuse the existing app during Vite hot reloads instead of initializing twice.
export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

// The database is Firebase Firestore; there is no application server.
export const db = getFirestore(firebaseApp);
export const storage = getStorage(firebaseApp);

// Local development can point at the Firebase emulator instead of the live
// project. The flag is kept on globalThis because Vite re-evaluates modules on
// hot reload and an instance can only be connected to an emulator once.
const EMULATOR_FLAG = '__civictrackFirebaseEmulator';
if (env.VITE_FIRESTORE_EMULATOR_HOST && !globalThis[EMULATOR_FLAG]) {
  try {
    const [host, port] = env.VITE_FIRESTORE_EMULATOR_HOST.split(':');
    connectFirestoreEmulator(db, host || '127.0.0.1', Number(port) || 8080);
    if (env.VITE_FIREBASE_STORAGE_EMULATOR_HOST) {
      const [storageHost, storagePort] = env.VITE_FIREBASE_STORAGE_EMULATOR_HOST.split(':');
      connectStorageEmulator(storage, storageHost || '127.0.0.1', Number(storagePort) || 9199);
    }
    globalThis[EMULATOR_FLAG] = true;
  } catch {
    /* an emulator connection is a development convenience only */
  }
}

// Analytics is unavailable in some browsers/embedded previews, so initialization
// is best-effort and never blocks rendering.
export const analyticsReady = typeof window !== 'undefined'
  ? isSupported()
      .then((supported) => (supported ? getAnalytics(firebaseApp) : null))
      .catch(() => null)
  : Promise.resolve(null);

export default firebaseApp;
