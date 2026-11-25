import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit as limitTo,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { getDownloadURL, ref as objectRef, uploadBytes } from 'firebase/storage';
import { db, storage } from './firebase';

/**
 * Thin Firestore adapter. Everything above this file talks in plain JavaScript
 * objects keyed by `_id`, exactly like the old JSON API did, so the pages never
 * need to know they are talking to Firebase directly.
 */

function isTimestamp(value) {
  return Boolean(value) && typeof value.toDate === 'function' && typeof value.seconds === 'number';
}

/** Firestore Timestamps become real Dates, recursively. */
export function toPlain(value) {
  if (value === null || value === undefined) return value;
  if (isTimestamp(value)) return value.toDate();
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.map(toPlain);
  if (typeof value === 'object') {
    const out = {};
    for (const [key, entry] of Object.entries(value)) out[key] = toPlain(entry);
    return out;
  }
  return value;
}

/** Firestore rejects `undefined`; strip it before every write. */
export function toWritable(value) {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.map((entry) => (entry === undefined ? null : toWritable(entry)));
  if (typeof value === 'object') {
    const out = {};
    for (const [key, entry] of Object.entries(value)) {
      if (entry === undefined) continue;
      out[key] = toWritable(entry);
    }
    return out;
  }
  return value;
}

function fromSnapshot(snapshot) {
  return { _id: snapshot.id, ...toPlain(snapshot.data()) };
}

export function createFirestoreStore() {
  return {
    async list(collectionName) {
      const snapshot = await getDocs(collection(db, collectionName));
      return snapshot.docs.map(fromSnapshot);
    },

    async get(collectionName, id) {
      if (!id) return null;
      const snapshot = await getDoc(doc(db, collectionName, String(id)));
      return snapshot.exists() ? fromSnapshot(snapshot) : null;
    },

    async findBy(collectionName, field, value) {
      const snapshot = await getDocs(
        query(collection(db, collectionName), where(field, '==', value), limitTo(1))
      );
      return snapshot.empty ? null : fromSnapshot(snapshot.docs[0]);
    },

    async add(collectionName, payload) {
      const data = toWritable(payload) || {};
      const created = await addDoc(collection(db, collectionName), data);
      return { _id: created.id, ...data };
    },

    async set(collectionName, id, payload, { merge = true } = {}) {
      await setDoc(doc(db, collectionName, String(id)), toWritable(payload) || {}, { merge });
    },

    async update(collectionName, id, patch) {
      await updateDoc(doc(db, collectionName, String(id)), toWritable(patch) || {});
    },

    async remove(collectionName, id) {
      await deleteDoc(doc(db, collectionName, String(id)));
    },

    async nextSeq(key) {
      const counterRef = doc(db, 'counters', String(key));
      return runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(counterRef);
        const seq = (snapshot.exists() ? Number(snapshot.data().seq) || 0 : 0) + 1;
        transaction.set(counterRef, { key: String(key), seq, updatedAt: new Date() }, { merge: true });
        return seq;
      });
    },

    async uploadFile(path, file) {
      const target = objectRef(storage, path);
      await uploadBytes(target, file, { contentType: file.type || 'application/octet-stream' });
      return getDownloadURL(target);
    },
  };
}
