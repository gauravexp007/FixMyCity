import fs from 'fs';
import path from 'path';
import { initializeApp, cert, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const APP_NAME = 'civictrack';
const DEFAULT_PROJECT_ID = 'fixmycity-51576';

function parseServiceAccount() {
  const raw = (
    process.env.FIREBASE_SERVICE_ACCOUNT ||
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
    ''
  ).trim();
  if (!raw) return null;
  if (raw.startsWith('{')) return JSON.parse(raw);

  const resolved = path.isAbsolute(raw) ? raw : path.resolve(process.cwd(), raw);
  if (fs.existsSync(resolved)) {
    return JSON.parse(fs.readFileSync(resolved, 'utf8'));
  }

  const decoded = Buffer.from(raw, 'base64').toString('utf8').trim();
  if (decoded.startsWith('{')) return JSON.parse(decoded);

  throw new Error(
    'FIREBASE_SERVICE_ACCOUNT must be service-account JSON, a path to that JSON, or base64-encoded JSON'
  );
}

/**
 * Firestore is used only when credentials (or the emulator) are available.
 * The Firebase web config in the browser is public and cannot authorise
 * server-side database access, so the API needs a service account.
 */
export function isFirestoreConfigured() {
  return Boolean(
    process.env.FIRESTORE_EMULATOR_HOST ||
      process.env.FIREBASE_SERVICE_ACCOUNT ||
      process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
      process.env.GOOGLE_APPLICATION_CREDENTIALS
  );
}

export async function initFirestore() {
  if (!isFirestoreConfigured()) {
    throw new Error(
      'Firestore is not configured. Set FIREBASE_SERVICE_ACCOUNT (service-account JSON from Firebase console) ' +
        'or GOOGLE_APPLICATION_CREDENTIALS, or FIRESTORE_EMULATOR_HOST for local development.'
    );
  }

  const serviceAccount = parseServiceAccount();
  const projectId =
    process.env.FIREBASE_PROJECT_ID ||
    serviceAccount?.project_id ||
    (process.env.FIRESTORE_EMULATOR_HOST ? 'demo-civictrack' : DEFAULT_PROJECT_ID);

  const existing = getApps().find((app) => app.name === APP_NAME);
  const app =
    existing ||
    initializeApp(
      {
        credential: serviceAccount ? cert(serviceAccount) : applicationDefault(),
        projectId,
      },
      APP_NAME
    );

  const db = getFirestore(app);
  db.settings({ ignoreUndefinedProperties: true });
  return db;
}
