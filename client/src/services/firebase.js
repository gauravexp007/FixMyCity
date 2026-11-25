import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAnalytics, isSupported } from 'firebase/analytics';

// Firebase web config is public by design (it only identifies the project).
// Values can be overridden per environment with VITE_FIREBASE_* variables.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyC_fHGHJs_7ux9W7KCFLhU6_7JjMYC-5w8',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'fixmycity-51576.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'fixmycity-51576',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'fixmycity-51576.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '398656960196',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:398656960196:web:f61c754d3704caa6d3bb91',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-8KF5186762',
};

// Reuse the existing app during Vite hot reloads instead of initializing twice.
export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Analytics is unavailable in some browsers/embedded previews, so initialization
// is best-effort and never blocks rendering.
export const analyticsReady = typeof window !== 'undefined'
  ? isSupported()
      .then((supported) => (supported ? getAnalytics(firebaseApp) : null))
      .catch(() => null)
  : Promise.resolve(null);

export default firebaseApp;
