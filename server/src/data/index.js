import * as mongoBackend from './mongo.js';
import * as firestoreBackend from './firestore.js';
import { isFirestoreConfigured } from '../config/firebaseAdmin.js';

/**
 * Chooses the persistence backend once at boot:
 *   - Firestore when FIREBASE_SERVICE_ACCOUNT / GOOGLE_APPLICATION_CREDENTIALS
 *     (or FIRESTORE_EMULATOR_HOST) is configured, or when DB_BACKEND=firestore
 *   - MongoDB otherwise (real MONGODB_URI, else in-memory MongoDB for the demo)
 *
 * Controllers only ever talk to this module, so the HTTP API, RBAC and the
 * React client are identical whichever database is active.
 */

let active = null;
let backendName = null;

export function getDataBackend() {
  return backendName;
}

export function dataLayerReady() {
  return Boolean(active);
}

export async function initData() {
  const requested = String(process.env.DB_BACKEND || '').trim().toLowerCase();
  const wantsFirestore =
    requested === 'firestore' || (requested !== 'mongodb' && isFirestoreConfigured());

  if (wantsFirestore) {
    try {
      await firestoreBackend.init();
      active = firestoreBackend;
      backendName = 'firestore';
      console.log(
        `Data backend: Firestore${process.env.FIRESTORE_EMULATOR_HOST ? ' (emulator)' : ''}`
      );
      return backendName;
    } catch (error) {
      if (requested === 'firestore') throw error;
      console.warn(
        `Firestore is configured but unavailable (${error.message}). Falling back to MongoDB.`
      );
    }
  }

  await mongoBackend.init();
  active = mongoBackend;
  backendName = 'mongodb';
  console.log('Data backend: MongoDB');
  return backendName;
}

export async function closeData() {
  if (active?.close) await active.close();
  active = null;
  backendName = null;
}

function backend() {
  if (!active) throw new Error('Data layer is not initialised. Call initData() first.');
  return active;
}

/**
 * Namespace proxies (users / complaints / notifications / counters) forward
 * every call to the backend chosen at boot, so importing code never needs to
 * know whether Firestore or MongoDB is active.
 */
function backendNamespace(name) {
  return new Proxy(
    {},
    {
      get(_target, property) {
        const namespace = backend()[name];
        const value = namespace[property];
        return typeof value === 'function' ? value.bind(namespace) : value;
      },
    }
  );
}

export const users = backendNamespace('users');
export const complaints = backendNamespace('complaints');
export const notifications = backendNamespace('notifications');
export const counters = backendNamespace('counters');

export async function clearSeedData(seedEmails = []) {
  return backend().clearSeedData(seedEmails);
}
