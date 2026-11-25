import bcrypt from 'bcryptjs';
import { FieldValue } from 'firebase-admin/firestore';
import { initFirestore } from '../config/firebaseAdmin.js';
import { matches, sortDocs, paginate, toMillis } from './filter.js';
import { COMPLAINT_STATUS } from '../utils/constants.js';

/**
 * Firestore implementation of the data layer (Firebase Admin SDK).
 *
 * Documents keep the same shape the rest of the app expects, with `_id`
 * mapped to the Firestore document id. Filtering/sorting/pagination happen
 * in JS after reading the collection, because Firestore would otherwise need
 * a composite index for nearly every combination of ward/status/category
 * filters the UI produces. That keeps both backends semantically identical.
 */

let db = null;

const USERS = 'users';
const COMPLAINTS = 'complaints';
const NOTIFICATIONS = 'notifications';
const COUNTERS = 'counters';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function isReady() {
  return Boolean(db);
}

export async function init() {
  db = await initFirestore();
  return db;
}

export async function close() {
  db = null;
}

function toPlain(value) {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return value;
  if (typeof value.toDate === 'function') return value.toDate();
  if (Array.isArray(value)) return value.map(toPlain);
  if (typeof value === 'object') {
    const out = {};
    for (const [key, entry] of Object.entries(value)) out[key] = toPlain(entry);
    return out;
  }
  return value;
}

function fromDoc(doc) {
  return { _id: doc.id, ...toPlain(doc.data()) };
}

function cleanForWrite(object = {}, { keepUndefined = false } = {}) {
  const out = {};
  for (const [key, value] of Object.entries(object)) {
    if (key === '_id' || key === 'id' || typeof value === 'function') continue;
    if (value === undefined && !keepUndefined) continue;
    out[key] = value;
  }
  return out;
}

async function readAll(collectionName) {
  const snapshot = await db.collection(collectionName).get();
  return snapshot.docs.map(fromDoc);
}

async function fetchByIds(collectionName, ids) {
  const unique = [...new Set((ids || []).filter(Boolean).map(String))];
  const found = new Map();
  const chunkSize = 100;
  for (let index = 0; index < unique.length; index += chunkSize) {
    const chunk = unique.slice(index, index + chunkSize);
    const refs = chunk.map((id) => db.collection(collectionName).doc(id));
    const snapshots = await db.getAll(...refs);
    for (const snapshot of snapshots) {
      if (snapshot.exists) found.set(snapshot.id, fromDoc(snapshot));
    }
  }
  return found;
}

async function deleteDocs(snapshot) {
  const docs = snapshot.docs || [];
  for (let index = 0; index < docs.length; index += 400) {
    const batch = db.batch();
    docs.slice(index, index + 400).forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  }
}

function pickFields(doc, select, fallback = 'name email') {
  const fields = String(select || fallback)
    .split(/\s+/)
    .filter(Boolean);
  const out = { _id: doc._id };
  for (const field of fields) out[field] = doc[field] ?? '';
  return out;
}

function stripPassword(user) {
  if (!user) return user;
  const { password, ...rest } = user;
  return rest;
}

function sameId(left, right) {
  return String(left?._id ?? left) === String(right?._id ?? right);
}

function referenceId(value) {
  return value && typeof value === 'object' ? value._id ?? value : value;
}

/**
 * Hydrated populates (reporter/assignedTo/timeline.by) must never be written
 * back as nested maps — only their document ids belong in the stored field.
 */
function normalizeReferences(complaint = {}) {
  const out = { ...complaint };
  if (out.reporter && typeof out.reporter === 'object') out.reporter = referenceId(out.reporter);
  if (out.assignedTo && typeof out.assignedTo === 'object') out.assignedTo = referenceId(out.assignedTo);
  if (Array.isArray(out.timeline)) {
    out.timeline = out.timeline.map((entry) =>
      entry && typeof entry === 'object' && entry.by && typeof entry.by === 'object'
        ? { ...entry, by: referenceId(entry.by) }
        : entry
    );
  }
  if (Array.isArray(out.duplicateCandidates)) {
    out.duplicateCandidates = out.duplicateCandidates.map(referenceId);
  }
  return out;
}

async function hydrate(complaintsList, populate = []) {
  const entries = populate.map((entry) => (typeof entry === 'string' ? { path: entry } : entry));
  if (!entries.length) return complaintsList;
  const paths = new Set(entries.map((entry) => entry.path));
  const selectFor = (path) => entries.find((entry) => entry.path === path)?.select;

  const userIds = [];
  for (const complaint of complaintsList) {
    if (paths.has('reporter') && complaint.reporter) userIds.push(complaint.reporter);
    if (paths.has('assignedTo') && complaint.assignedTo) userIds.push(complaint.assignedTo);
    if (paths.has('timeline.by')) {
      for (const entry of complaint.timeline || []) if (entry.by) userIds.push(entry.by);
    }
  }
  const userMap = await fetchByIds(USERS, userIds);

  for (const complaint of complaintsList) {
    if (paths.has('reporter') && complaint.reporter) {
      const reporter = userMap.get(String(complaint.reporter?._id ?? complaint.reporter));
      if (reporter) complaint.reporter = pickFields(reporter, selectFor('reporter'));
    }
    if (paths.has('assignedTo') && complaint.assignedTo) {
      const assignee = userMap.get(String(complaint.assignedTo?._id ?? complaint.assignedTo));
      if (assignee) complaint.assignedTo = pickFields(assignee, selectFor('assignedTo'));
    }
    if (paths.has('timeline.by')) {
      complaint.timeline = (complaint.timeline || []).map((entry) => {
        if (!entry.by) return entry;
        const actor = userMap.get(String(entry.by?._id ?? entry.by));
        return actor ? { ...entry, by: pickFields(actor, selectFor('timeline.by')) } : entry;
      });
    }
  }

  if (paths.has('duplicateCandidates')) {
    const ids = complaintsList.flatMap((complaint) => complaint.duplicateCandidates || []);
    const complaintMap = await fetchByIds(COMPLAINTS, ids);
    for (const complaint of complaintsList) {
      complaint.duplicateCandidates = (complaint.duplicateCandidates || []).map((id) => {
        const found = complaintMap.get(String(id?._id ?? id));
        return found
          ? pickFields(found, selectFor('duplicateCandidates'), 'complaintId title status category createdAt')
          : id;
      });
    }
  }

  return complaintsList;
}

function groupCount(docs, key, { skipEmpty = false } = {}) {
  const map = new Map();
  for (const doc of docs) {
    const value = key.split('.').reduce((acc, part) => (acc == null ? undefined : acc[part]), doc);
    if (skipEmpty && !value) continue;
    map.set(value, (map.get(value) || 0) + 1);
  }
  return map;
}

export const users = {
  async findByEmail(email, { withPassword = false } = {}) {
    const normalized = String(email || '').toLowerCase();
    const snapshot = await db.collection(USERS).where('email', '==', normalized).limit(1).get();
    if (snapshot.empty) return null;
    const user = fromDoc(snapshot.docs[0]);
    return withPassword ? user : stripPassword(user);
  },

  async findById(id, { withPassword = false } = {}) {
    if (!id) return null;
    const snapshot = await db.collection(USERS).doc(String(id)).get();
    if (!snapshot.exists) return null;
    const user = fromDoc(snapshot);
    return withPassword ? user : stripPassword(user);
  },

  async create(data) {
    const now = new Date();
    const password = await bcrypt.hash(String(data.password || ''), 12);
    // Mongoose supplied these defaults; Firestore documents need them explicitly.
    const payload = cleanForWrite({
      role: 'citizen',
      phone: '',
      avatar: '',
      municipality: '',
      ward: '',
      department: '',
      jurisdiction: { municipality: '', ward: '' },
      isActive: true,
      isApproved: true,
      notificationPreferences: { email: true, inApp: true },
      ...data,
      email: String(data.email || '').toLowerCase(),
      password,
      createdAt: now,
      updatedAt: now,
    });
    const ref = await db.collection(USERS).add(payload);
    return { _id: ref.id, ...payload };
  },

  async save(user) {
    if (!user?._id) throw new Error('users.save requires a persisted user');
    const data = cleanForWrite(user);
    delete data.createdAt;
    if (typeof data.password === 'string' && !data.password.startsWith('$2')) delete data.password;
    data.updatedAt = new Date();
    await db.collection(USERS).doc(String(user._id)).set(data, { merge: true });
    return user;
  },

  async setPassword(user, plainPassword) {
    const password = await bcrypt.hash(String(plainPassword || ''), 12);
    await db.collection(USERS).doc(String(user._id)).update({ password, updatedAt: new Date() });
    user.password = password;
    return user;
  },

  async comparePassword(user, candidate) {
    if (!user) return false;
    let hash = user.password;
    if (!hash && user._id) {
      const stored = await users.findById(user._id, { withPassword: true });
      hash = stored?.password;
    }
    if (!hash) return false;
    return bcrypt.compare(String(candidate || ''), String(hash));
  },

  async list({ filter = {}, sort = '-createdAt', limit = 200 } = {}) {
    const all = await readAll(USERS);
    return sortDocs(all.filter((user) => matches(user, filter)), sort)
      .slice(0, limit)
      .map(stripPassword);
  },

  async count() {
    const all = await readAll(USERS);
    return all.length;
  },

  async countByFilter(filter = {}) {
    const all = await readAll(USERS);
    return all.filter((user) => matches(user, filter)).length;
  },

  toSafeObject(user) {
    return stripPassword(user);
  },
};

export const complaints = {
  async create(data) {
    const now = new Date();
    const payload = cleanForWrite({
      severity: 'Medium',
      status: COMPLAINT_STATUS.SUBMITTED,
      priority: 'Normal',
      assignedDepartment: '',
      escalationLevel: 0,
      rejectedReason: '',
      media: [],
      timeline: [],
      duplicateCandidates: [],
      isSeed: false,
      feedback: {},
      reopen: { isReopened: false, reason: '', verified: false },
      ...data,
      createdAt: data.createdAt || now,
      updatedAt: now,
    });
    const ref = await db.collection(COMPLAINTS).add(payload);
    return { _id: ref.id, ...payload };
  },

  async findById(id, { populate = [] } = {}) {
    if (!id) return null;
    const snapshot = await db.collection(COMPLAINTS).doc(String(id)).get();
    if (!snapshot.exists) return null;
    const [complaint] = await hydrate([fromDoc(snapshot)], populate);
    return complaint;
  },

  async save(complaint) {
    if (!complaint?._id) throw new Error('complaints.save requires a persisted complaint');
    const { _id, ...rest } = complaint;
    const normalized = normalizeReferences(rest);
    const data = cleanForWrite(normalized);
    const deletions = {};
    for (const [key, value] of Object.entries(normalized)) {
      if (value === undefined) deletions[key] = FieldValue.delete();
    }
    data.updatedAt = new Date();
    await db
      .collection(COMPLAINTS)
      .doc(String(_id))
      .set({ ...data, ...deletions }, { merge: true });
    return complaint;
  },

  async list({ filter = {}, sort = '-createdAt', page = 1, limit = 20, populate = [] } = {}) {
    const all = await readAll(COMPLAINTS);
    const filtered = sortDocs(all.filter((complaint) => matches(complaint, filter)), sort);
    return hydrate(paginate(filtered, page, limit), populate);
  },

  async count(filter = {}) {
    const all = await readAll(COMPLAINTS);
    return all.filter((complaint) => matches(complaint, filter)).length;
  },

  async mapList({ filter = {}, limit = 1000 } = {}) {
    const all = await readAll(COMPLAINTS);
    const filtered = sortDocs(all.filter((complaint) => matches(complaint, filter)), '-createdAt');
    return filtered.slice(0, limit).map((complaint) => ({
      _id: complaint._id,
      complaintId: complaint.complaintId,
      title: complaint.title,
      category: complaint.category,
      severity: complaint.severity,
      status: complaint.status,
      location: complaint.location,
      priority: complaint.priority,
      assignedDepartment: complaint.assignedDepartment,
      createdAt: complaint.createdAt,
    }));
  },

  async findDuplicateCandidates({ lng, lat, category, reporterId }) {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const all = await readAll(COMPLAINTS);
    const candidates = all.filter((complaint) =>
      matches(complaint, {
        reporter: { $ne: reporterId },
        category,
        status: { $nin: [COMPLAINT_STATUS.RESOLVED, COMPLAINT_STATUS.REJECTED] },
        createdAt: { $gte: since },
        location: {
          $near: {
            $geometry: { type: 'Point', coordinates: [lng, lat] },
            $maxDistance: 100,
          },
        },
      })
    );
    return candidates.slice(0, 5).map((complaint) => ({
      _id: complaint._id,
      complaintId: complaint.complaintId,
      title: complaint.title,
      status: complaint.status,
      createdAt: complaint.createdAt,
    }));
  },

  async stats(filter = {}) {
    const all = await readAll(COMPLAINTS);
    const docs = all.filter((complaint) => matches(complaint, filter));
    const withStatus = (status) => docs.filter((complaint) => complaint.status === status);

    const activeStatuses = [COMPLAINT_STATUS.SUBMITTED, COMPLAINT_STATUS.UNDER_REVIEW, COMPLAINT_STATUS.VERIFIED];
    const workingStatuses = [COMPLAINT_STATUS.ASSIGNED, COMPLAINT_STATUS.IN_PROGRESS];
    const closedStatuses = [COMPLAINT_STATUS.RESOLVED, COMPLAINT_STATUS.REJECTED];

    const now = Date.now();
    const overdue = docs.filter(
      (complaint) =>
        complaint.deadline &&
        toMillis(complaint.deadline) !== null &&
        toMillis(complaint.deadline) < now &&
        !closedStatuses.includes(complaint.status)
    ).length;

    const byDepartmentMap = new Map();
    for (const complaint of docs) {
      const department = complaint.assignedDepartment;
      if (!department) continue;
      const entry = byDepartmentMap.get(department) || { department, total: 0, resolved: 0 };
      entry.total += 1;
      if (complaint.status === COMPLAINT_STATUS.RESOLVED) entry.resolved += 1;
      byDepartmentMap.set(department, entry);
    }

    const byWardMap = new Map();
    for (const complaint of docs) {
      const ward = complaint.location?.ward;
      if (!ward) continue;
      const entry = byWardMap.get(ward) || { ward, total: 0, resolved: 0, pending: 0 };
      entry.total += 1;
      if (complaint.status === COMPLAINT_STATUS.RESOLVED) entry.resolved += 1;
      if (!closedStatuses.includes(complaint.status)) entry.pending += 1;
      byWardMap.set(ward, entry);
    }

    const resolutionTimes = docs
      .filter((complaint) => complaint.status === COMPLAINT_STATUS.RESOLVED && complaint.resolvedAt)
      .map((complaint) => {
        const resolvedAt = toMillis(complaint.resolvedAt);
        const createdAt = toMillis(complaint.createdAt);
        return resolvedAt !== null && createdAt !== null ? resolvedAt - createdAt : null;
      })
      .filter((value) => value !== null);
    const avgResolutionMs = resolutionTimes.length
      ? resolutionTimes.reduce((sum, value) => sum + value, 0) / resolutionTimes.length
      : 0;

    const trendStart = new Date();
    trendStart.setMonth(trendStart.getMonth() - 5);
    trendStart.setDate(1);
    trendStart.setHours(0, 0, 0, 0);
    const trendStartMs = trendStart.getTime();

    const buckets = new Map();
    for (const complaint of docs) {
      const createdAt = toMillis(complaint.createdAt);
      if (createdAt === null || createdAt < trendStartMs) continue;
      const date = new Date(createdAt);
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      const entry = buckets.get(key) || {
        order: date.getFullYear() * 12 + date.getMonth(),
        month: MONTHS[date.getMonth()],
        total: 0,
        resolved: 0,
      };
      entry.total += 1;
      if (complaint.status === COMPLAINT_STATUS.RESOLVED) entry.resolved += 1;
      buckets.set(key, entry);
    }

    const recent = sortDocs(docs, '-createdAt').slice(0, 8);
    await hydrate(recent, [{ path: 'reporter', select: 'name' }]);

    return {
      trend: [...buckets.values()]
        .sort((left, right) => left.order - right.order)
        .map((entry) => ({ month: entry.month, total: entry.total, resolved: entry.resolved })),
      stats: {
        total: docs.length,
        pending: docs.filter((complaint) => activeStatuses.includes(complaint.status)).length,
        inProgress: docs.filter((complaint) => workingStatuses.includes(complaint.status)).length,
        resolved: withStatus(COMPLAINT_STATUS.RESOLVED).length,
        escalated: withStatus(COMPLAINT_STATUS.ESCALATED).length,
        rejected: withStatus(COMPLAINT_STATUS.REJECTED).length,
        overdue,
        avgResolutionHours: Math.round(avgResolutionMs / 36e5),
      },
      byStatus: [...groupCount(docs, 'status')].map(([status, count]) => ({ status, count })),
      byCategory: [...groupCount(docs, 'category')]
        .map(([category, count]) => ({ category, count }))
        .sort((left, right) => right.count - left.count),
      bySeverity: [...groupCount(docs, 'severity')].map(([severity, count]) => ({ severity, count })),
      byDepartment: [...byDepartmentMap.values()].sort((left, right) => right.total - left.total),
      byWard: [...byWardMap.values()].sort((left, right) => right.total - left.total),
      recent,
    };
  },

  async clearSeed() {
    const snapshot = await db.collection(COMPLAINTS).where('isSeed', '==', true).get();
    await deleteDocs(snapshot);
  },
};

export const notifications = {
  async create(data) {
    const now = new Date();
    const payload = cleanForWrite({
      type: 'system',
      metadata: {},
      ...data,
      read: data.read ?? false,
      createdAt: now,
      updatedAt: now,
    });
    const ref = await db.collection(NOTIFICATIONS).add(payload);
    return { _id: ref.id, ...payload };
  },

  async listForUser(userId, { page = 1, limit = 30, unread = false } = {}) {
    const all = await readAll(NOTIFICATIONS);
    const filtered = all.filter(
      (notification) => sameId(notification.user, userId) && (!unread || !notification.read)
    );
    const pageDocs = paginate(sortDocs(filtered, '-createdAt'), page, limit);
    const complaintMap = await fetchByIds(
      COMPLAINTS,
      pageDocs.map((notification) => notification.complaint).filter(Boolean)
    );
    for (const notification of pageDocs) {
      if (!notification.complaint) continue;
      const complaint = complaintMap.get(String(notification.complaint?._id ?? notification.complaint));
      if (complaint) notification.complaint = pickFields(complaint, 'complaintId title status');
    }
    return pageDocs;
  },

  async countForUser(userId, { unreadOnly = false } = {}) {
    const all = await readAll(NOTIFICATIONS);
    return all.filter(
      (notification) => sameId(notification.user, userId) && (!unreadOnly || !notification.read)
    ).length;
  },

  async markRead(id, userId) {
    const ref = db.collection(NOTIFICATIONS).doc(String(id));
    const snapshot = await ref.get();
    if (!snapshot.exists) return null;
    const notification = fromDoc(snapshot);
    if (!sameId(notification.user, userId)) return null;
    await ref.update({ read: true, updatedAt: new Date() });
    return { ...notification, read: true };
  },

  async markAllRead(userId) {
    const snapshot = await db.collection(NOTIFICATIONS).where('user', '==', String(userId)).get();
    const batch = db.batch();
    let changed = false;
    snapshot.docs.forEach((doc) => {
      if (!doc.data().read) {
        batch.update(doc.ref, { read: true, updatedAt: new Date() });
        changed = true;
      }
    });
    if (changed) await batch.commit();
  },

  async clearSeed() {
    const snapshot = await db.collection(NOTIFICATIONS).where('metadata.seed', '==', true).get();
    await deleteDocs(snapshot);
  },
};

export const counters = {
  async next(key) {
    const ref = db.collection(COUNTERS).doc(String(key));
    return db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      const seq = (snapshot.exists ? Number(snapshot.data().seq) || 0 : 0) + 1;
      transaction.set(ref, { key: String(key), seq, updatedAt: new Date() }, { merge: true });
      return seq;
    });
  },
};

export async function clearSeedData(seedEmails = []) {
  await notifications.clearSeed();
  await complaints.clearSeed();
  const all = await readAll(USERS);
  const emails = new Set(seedEmails.map((email) => String(email).toLowerCase()));
  const batch = db.batch();
  let changed = false;
  for (const user of all) {
    if (emails.has(String(user.email || '').toLowerCase())) {
      batch.delete(db.collection(USERS).doc(String(user._id)));
      changed = true;
    }
  }
  if (changed) await batch.commit();
}
