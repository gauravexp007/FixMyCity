/**
 * Browser data layer backed directly by Firebase Firestore.
 *
 * This replaces the old Express API: the single-page app is the only
 * deployment, and every read/write (accounts, complaints, notifications,
 * counters, evidence) goes straight to Firebase. The exported object keeps the
 * same `get/post/patch` surface the pages already use, so screens are unchanged.
 */
export const ROLES = {
  CITIZEN: 'citizen',
  MUNICIPAL: 'municipal',
  WARD_OFFICER: 'ward_officer',
  SUPERIOR: 'superior',
};

export const STATUS = {
  SUBMITTED: 'Submitted',
  UNDER_REVIEW: 'Under Review',
  VERIFIED: 'Verified',
  ASSIGNED: 'Assigned',
  IN_PROGRESS: 'In Progress',
  RESOLVED: 'Resolved',
  REJECTED: 'Rejected',
  ESCALATED: 'Escalated',
};

export const STATUS_FLOW = {
  [STATUS.SUBMITTED]: [STATUS.UNDER_REVIEW, STATUS.REJECTED],
  [STATUS.UNDER_REVIEW]: [STATUS.VERIFIED, STATUS.REJECTED],
  [STATUS.VERIFIED]: [STATUS.ASSIGNED, STATUS.REJECTED],
  [STATUS.ASSIGNED]: [STATUS.IN_PROGRESS, STATUS.ESCALATED],
  [STATUS.IN_PROGRESS]: [STATUS.RESOLVED, STATUS.ESCALATED],
  [STATUS.RESOLVED]: [],
  [STATUS.REJECTED]: [],
  [STATUS.ESCALATED]: [STATUS.ASSIGNED, STATUS.IN_PROGRESS, STATUS.RESOLVED, STATUS.REJECTED],
};

const SEVERITIES = ['Low', 'Medium', 'High', 'Critical'];
const DEPARTMENTS = [
  'Roads & Infrastructure',
  'Sanitation',
  'Water Supply',
  'Drainage & Sewage',
  'Electrical',
  'Public Works',
  'General Administration',
];
const LOCATION_SOURCES = ['gps', 'map', 'address'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MAX_MEDIA_FILES = 6;

/** The single administrator account provisioned into Firebase. */
export const ADMIN_ACCOUNT = {
  name: 'Gaurav',
  email: 'fab.gaurav007@gmail.com',
  password: '#Gauravxmarvel111',
};
const DEMO_PASSWORD = 'Password123!';
const DEMO_EMAILS = [
  'municipal.central@civictrack.gov',
  'ward5.officer@civictrack.gov',
  'citizen.demo@civictrack.gov',
];
const LEGACY_ADMIN_EMAIL = 'admin@civictrack.gov';
const SESSION_KEY = 'ct_token';
const LEGACY_USER_KEY = 'ct_user';

const env = import.meta.env || {};
const SEED_DEMO = env.VITE_SEED_DEMO_DATA !== 'false';

/* ------------------------------------------------------------------ errors */

function httpError(status, message) {
  const error = new Error(message);
  error.response = { status, data: { message } };
  return error;
}

/* -------------------------------------------------------------- filtering */

const getPath = (object, path) =>
  path.split('.').reduce((acc, key) => (acc === null || acc === undefined ? undefined : acc[key]), object);

export function toMillis(value) {
  if (value instanceof Date) return value.getTime();
  if (value && typeof value.toDate === 'function') return value.toDate().getTime();
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const time = new Date(value).getTime();
    return Number.isNaN(time) ? null : time;
  }
  return null;
}

function idOf(value) {
  if (value === null || value === undefined) return value;
  if (typeof value === 'object' && !Array.isArray(value)) {
    if (value._id !== undefined) return String(value._id);
    return String(value);
  }
  return value;
}

function equals(actual, expected) {
  const a = idOf(actual);
  const b = idOf(expected);
  if (a instanceof Date || b instanceof Date) return toMillis(a) === toMillis(b);
  if (a === null || a === undefined || b === null || b === undefined) return a === b;
  if (typeof a === 'object' || typeof b === 'object') return String(a) === String(b);
  return a === b;
}

function compareValues(actual, expected) {
  if (actual instanceof Date || expected instanceof Date || typeof actual === 'string' || typeof expected === 'string') {
    const a = toMillis(actual);
    const b = toMillis(expected);
    if (a !== null && b !== null && !Number.isNaN(a) && !Number.isNaN(b)) return a - b;
  }
  if (typeof actual === 'number' && typeof expected === 'number') return actual - expected;
  return String(actual ?? '').localeCompare(String(expected ?? ''));
}

function haversineMeters(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length < 2 || b.length < 2) return Infinity;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const [lng1, lat1] = a;
  const [lng2, lat2] = b;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.min(1, Math.sqrt(h)));
}

function operatorMatches(actual, condition) {
  if ('$eq' in condition && !equals(actual, condition.$eq)) return false;
  if ('$ne' in condition && equals(actual, condition.$ne)) return false;
  if ('$in' in condition && !(condition.$in || []).some((item) => equals(actual, item))) return false;
  if ('$nin' in condition && (condition.$nin || []).some((item) => equals(actual, item))) return false;
  if (actual === null || actual === undefined) {
    if ('$gt' in condition || '$gte' in condition || '$lt' in condition || '$lte' in condition) return false;
  } else {
    if ('$gt' in condition && !(compareValues(actual, condition.$gt) > 0)) return false;
    if ('$gte' in condition && !(compareValues(actual, condition.$gte) >= 0)) return false;
    if ('$lt' in condition && !(compareValues(actual, condition.$lt) < 0)) return false;
    if ('$lte' in condition && !(compareValues(actual, condition.$lte) <= 0)) return false;
  }
  if ('$exists' in condition && Boolean(actual !== undefined) !== Boolean(condition.$exists)) return false;
  if ('$regex' in condition) {
    const flags = String(condition.$options || '').replace(/[^gimsuy]/g, '');
    let regex;
    try {
      regex = new RegExp(condition.$regex, flags);
    } catch {
      return false;
    }
    if (actual === null || actual === undefined || !regex.test(String(actual))) return false;
  }
  if ('$near' in condition) {
    const near = condition.$near || {};
    const point = near.$geometry?.coordinates || near;
    const maxDistance = near.$maxDistance ?? Infinity;
    const coords = actual?.coordinates || actual;
    if (haversineMeters(coords, point) > maxDistance) return false;
  }
  return true;
}

export function matches(document, filter = {}) {
  for (const [key, condition] of Object.entries(filter || {})) {
    if (key === '$or') {
      if (!Array.isArray(condition) || !condition.some((entry) => matches(document, entry))) return false;
      continue;
    }
    if (key === '$and') {
      if (!Array.isArray(condition) || !condition.every((entry) => matches(document, entry))) return false;
      continue;
    }
    if (key === '$nor') {
      if (!Array.isArray(condition) || condition.some((entry) => matches(document, entry))) return false;
      continue;
    }
    const actual = getPath(document, key);
    const isOperator =
      condition !== null &&
      typeof condition === 'object' &&
      !(condition instanceof Date) &&
      !Array.isArray(condition) &&
      Object.keys(condition).some((entry) => entry.startsWith('$'));

    if (isOperator) {
      if (!operatorMatches(actual, condition)) return false;
    } else if (
      condition !== null &&
      typeof condition === 'object' &&
      !Array.isArray(condition) &&
      !(condition instanceof Date)
    ) {
      if (actual === null || actual === undefined || !matches(actual, condition)) return false;
    } else if (Array.isArray(actual) && !Array.isArray(condition)) {
      if (!actual.some((item) => equals(item, condition))) return false;
    } else if (!equals(actual, condition)) {
      return false;
    }
  }
  return true;
}

export function sortDocs(documents, sort = '-createdAt') {
  const parts = String(sort || '-createdAt')
    .split(/[\s,]+/)
    .filter(Boolean)
    .map((field) => ({ key: field.replace(/^[-+]/, ''), direction: field.startsWith('-') ? -1 : 1 }));

  return [...documents].sort((left, right) => {
    for (const { key, direction } of parts) {
      const a = getPath(left, key);
      const b = getPath(right, key);
      if (a === b) continue;
      if (a === undefined || a === null) return 1;
      if (b === undefined || b === null) return -1;
      const result = compareValues(a, b);
      if (result !== 0) return result * direction;
    }
    return 0;
  });
}

export function paginate(documents, page = 1, limit = 20) {
  const pageNumber = Math.max(1, Number(page) || 1);
  const pageSize = Math.max(1, Number(limit) || 20);
  const start = (pageNumber - 1) * pageSize;
  return documents.slice(start, start + pageSize);
}

/* ---------------------------------------------------------------- passwords */

const encoder = new TextEncoder();

function bytesToHex(bytes) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex) {
  const clean = String(hex || '');
  const out = new Uint8Array(clean.length / 2);
  for (let index = 0; index < out.length; index += 1) {
    out[index] = parseInt(clean.slice(index * 2, index * 2 + 2), 16);
  }
  return out;
}

function randomHex(bytes = 16) {
  const buffer = new Uint8Array(bytes);
  crypto.getRandomValues(buffer);
  return bytesToHex(buffer);
}

async function hashPassword(password, saltHex) {
  if (!globalThis.crypto?.subtle) {
    throw httpError(
      500,
      'This browser cannot hash passwords securely. Open CivicTrack over https (or localhost).'
    );
  }
  const key = await crypto.subtle.importKey('raw', encoder.encode(String(password)), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: hexToBytes(saltHex), iterations: 120000, hash: 'SHA-256' },
    key,
    256
  );
  return bytesToHex(new Uint8Array(bits));
}

async function hashNewPassword(password) {
  const salt = randomHex(16);
  return { passwordSalt: salt, passwordHash: await hashPassword(password, salt) };
}

/* -------------------------------------------------------------- user shape */

function safeUser(user) {
  if (!user) return user;
  const { password, passwordHash, passwordSalt, ...rest } = user;
  return rest;
}

function pickFields(document, select, fallback = 'name email') {
  const fields = String(select || fallback).split(/\s+/).filter(Boolean);
  const out = { _id: document._id };
  for (const field of fields) out[field] = document[field] ?? '';
  return out;
}

function makeSession(user) {
  return btoa(JSON.stringify({ id: user._id, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 }));
}

function makeBrowserSession() {
  if (typeof localStorage !== 'undefined') return localStorage;
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
  };
}

/* ------------------------------------------------------------ media upload */

function parseMediaMeta(raw) {
  if (!raw) return [];
  let parsed = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.slice(0, MAX_MEDIA_FILES).map((entry) => {
    if (!entry || typeof entry !== 'object') return {};
    const capturedAt = entry.capturedAt ? new Date(entry.capturedAt) : null;
    return {
      latitude: geoNumber(entry.latitude, -90, 90),
      longitude: geoNumber(entry.longitude, -180, 180),
      accuracy: geoNumber(entry.accuracy, 0, 100000),
      address: typeof entry.address === 'string' ? entry.address.trim().slice(0, 300) : '',
      capturedAt: capturedAt && !Number.isNaN(capturedAt.getTime()) ? capturedAt : undefined,
    };
  });
}

function geoNumber(value, min, max) {
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? number : null;
}

function fileToDataUrl(file) {
  if (typeof FileReader === 'undefined') {
    return file.arrayBuffer().then((buffer) => {
      let binary = '';
      new Uint8Array(buffer).forEach((byte) => {
        binary += String.fromCharCode(byte);
      });
      return `data:${file.type || 'application/octet-stream'};base64,${btoa(binary)}`;
    });
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function safeFileName(name) {
  return String(name || 'evidence')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .slice(-80);
}

/* ------------------------------------------------------------------ seeding */

function userPayload(data) {
  const now = new Date();
  const payload = {
    role: ROLES.CITIZEN,
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
    email: String(data.email || '').trim().toLowerCase(),
    createdAt: now,
    updatedAt: now,
  };
  delete payload.password;
  return payload;
}

async function createUserRecord(store, data) {
  const payload = userPayload({ ...data, ...(await hashNewPassword(data.password)) });
  return store.add('users', payload);
}

/**
 * Seed accounts are written to a fixed document id so two tabs booting at the
 * same time converge on one record instead of creating duplicate accounts.
 */
async function writeSeedUser(store, key, data) {
  const payload = userPayload({ ...data, ...(await hashNewPassword(data.password)) });
  const id = `seed-${key}`;
  await store.set('users', id, payload, { merge: false });
  return { _id: id, ...payload };
}

/** Removes extra copies of a seed account left by an earlier concurrent boot. */
async function removeDuplicateAccounts(store, emails) {
  const wanted = new Set(emails.map((email) => String(email).toLowerCase()));
  const seen = new Set();
  for (const user of await store.list('users')) {
    const email = String(user.email || '').toLowerCase();
    if (!wanted.has(email)) continue;
    if (seen.has(email)) await store.remove('users', user._id);
    else seen.add(email);
  }
}

async function assignPassword(store, user, password) {
  const secret = await hashNewPassword(password);
  await store.set('users', user._id, { ...secret, updatedAt: new Date() });
  return { ...user, ...secret };
}

async function nextComplaintId(store) {
  const year = new Date().getFullYear();
  const seq = await store.nextSeq(`complaint-${year}`);
  return `CT-${year}-${String(seq).padStart(6, '0')}`;
}

/**
 * Provisions the administrator account (and, on a brand-new database, the demo
 * role accounts and clearly-labelled sample complaints). Everything is stored
 * in Firebase; nothing is hardcoded in the page.
 */
export async function ensureSeedData(store, { adminAccount = ADMIN_ACCOUNT, seedDemo = SEED_DEMO } = {}) {
  const adminEmail = adminAccount.email.toLowerCase();

  // The previous demo administrator is no longer the administrator.
  const legacyAdmin = await store.findBy('users', 'email', LEGACY_ADMIN_EMAIL);
  if (legacyAdmin) await store.remove('users', legacyAdmin._id);

  let admin = await store.findBy('users', 'email', adminEmail);
  if (!admin) {
    admin = await writeSeedUser(store, 'admin', {
      name: adminAccount.name,
      email: adminAccount.email,
      password: adminAccount.password,
      role: ROLES.SUPERIOR,
      municipality: 'Central City',
      jurisdiction: { municipality: 'Central City', ward: '' },
    });
  }
  await removeDuplicateAccounts(store, [adminEmail]);
  admin = (await store.findBy('users', 'email', adminEmail)) || admin;
  if (!admin.passwordHash) {
    // Accounts seeded by the old server stored a bcrypt hash the browser cannot
    // verify, so the administrator password is written as a Firebase record.
    admin = await assignPassword(store, admin, adminAccount.password);
  }
  if (admin.role !== ROLES.SUPERIOR || admin.isActive === false || admin.isApproved === false) {
    await store.set('users', admin._id, {
      role: ROLES.SUPERIOR,
      isActive: true,
      isApproved: true,
    });
  }

  if (!seedDemo) return;

  const users = await store.list('users');
  const demoAccounts = {
    'municipal.central@civictrack.gov': {
      name: 'Central Municipal Officer',
      role: ROLES.MUNICIPAL,
      department: 'General Administration',
      phone: '9000000002',
      municipality: 'Central City',
      ward: '',
    },
    'ward5.officer@civictrack.gov': {
      name: 'Ward 5 Officer',
      role: ROLES.WARD_OFFICER,
      department: 'Public Works',
      phone: '9000000003',
      municipality: 'Central City',
      ward: 'Ward 5',
    },
    'citizen.demo@civictrack.gov': {
      name: 'Demo Citizen',
      role: ROLES.CITIZEN,
      phone: '9000000004',
      municipality: 'Central City',
      ward: 'Ward 5',
    },
  };

  // A database that already has accounts only gets its legacy demo passwords
  // upgraded; no new demo data is invented in a live deployment.
  if (users.length > 1) {
    for (const email of DEMO_EMAILS) {
      const existing = users.find((user) => String(user.email).toLowerCase() === email);
      if (existing && !existing.passwordHash) await assignPassword(store, existing, DEMO_PASSWORD);
    }
    return;
  }

  const created = {};
  for (const [email, details] of Object.entries(demoAccounts)) {
    created[email] = await writeSeedUser(store, email.split('@')[0].replace(/[^a-z0-9]+/g, '-'), {
      ...details,
      email,
      password: DEMO_PASSWORD,
      jurisdiction: { municipality: details.municipality, ward: details.ward },
    });
  }

  const complaints = await store.list('complaints');
  if (complaints.length > 0) return;

  const municipal = created['municipal.central@civictrack.gov'];
  const wardOfficer = created['ward5.officer@civictrack.gov'];
  const citizen = created['citizen.demo@civictrack.gov'];
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;

  const samples = [
    {
      title: '[Sample] Large pothole near Main Street',
      description:
        'Sample development record: A deep pothole is causing traffic slowdown and risk for two-wheelers near Main Street junction.',
      category: 'Pothole',
      severity: 'High',
      status: STATUS.IN_PROGRESS,
      location: {
        type: 'Point',
        coordinates: [77.5946, 12.9716],
        address: 'Main Street Junction',
        landmark: 'Near City Bank',
        municipality: 'Central City',
        ward: 'Ward 5',
      },
      assignedTo: municipal._id,
      assignedDepartment: 'Roads & Infrastructure',
      priority: 'High',
      deadline: new Date(now + 2 * day),
    },
    {
      title: '[Sample] Garbage accumulation at market road',
      description:
        'Sample development record: Garbage has not been collected for three days near the market road, causing odor and hygiene concerns.',
      category: 'Garbage Accumulation',
      severity: 'Medium',
      status: STATUS.ASSIGNED,
      location: {
        type: 'Point',
        coordinates: [77.596, 12.975],
        address: 'Market Road',
        landmark: 'Opposite Central Market',
        municipality: 'Central City',
        ward: 'Ward 5',
      },
      assignedTo: municipal._id,
      assignedDepartment: 'Sanitation',
      priority: 'Normal',
      deadline: new Date(now + 3 * day),
    },
    {
      title: '[Sample] Broken streetlight on Lake View Road',
      description:
        'Sample development record: Streetlight has been non-functional for a week, making the area unsafe at night.',
      category: 'Broken Streetlight',
      severity: 'Medium',
      status: STATUS.RESOLVED,
      location: {
        type: 'Point',
        coordinates: [77.59, 12.968],
        address: 'Lake View Road',
        landmark: 'Near Park Gate',
        municipality: 'Central City',
        ward: 'Ward 5',
      },
      assignedTo: municipal._id,
      assignedDepartment: 'Electrical',
      priority: 'Normal',
      resolvedAt: new Date(now - day),
      feedback: {
        rating: 4,
        comment: 'Resolved quickly after assignment.',
        submittedAt: new Date(now - 12 * 60 * 60 * 1000),
      },
    },
    {
      title: '[Sample] Water leakage near residential block',
      description:
        'Sample development record: Continuous water leakage from main pipeline causing water wastage.',
      category: 'Water Leakage',
      severity: 'Critical',
      status: STATUS.ESCALATED,
      location: {
        type: 'Point',
        coordinates: [77.6, 12.973],
        address: 'Residential Block C',
        landmark: 'Behind Community Hall',
        municipality: 'Central City',
        ward: 'Ward 5',
      },
      assignedTo: wardOfficer._id,
      assignedDepartment: 'Water Supply',
      priority: 'Urgent',
      escalationLevel: 1,
      escalatedAt: new Date(now - 6 * 60 * 60 * 1000),
    },
    {
      title: '[Sample] Drainage overflow after rain',
      description:
        'Sample development record: Drainage overflow during rain causing waterlogging on the service road.',
      category: 'Drainage Problem',
      severity: 'High',
      status: STATUS.SUBMITTED,
      location: {
        type: 'Point',
        coordinates: [77.592, 12.969],
        address: 'Service Road',
        landmark: 'Near School',
        municipality: 'Central City',
        ward: 'Ward 5',
      },
      priority: 'High',
    },
  ];

  for (const sample of samples) {
    const complaintId = await nextComplaintId(store);
    const timeline = [
      {
        status: STATUS.SUBMITTED,
        note: 'Sample complaint submitted for development/demo.',
        by: citizen._id,
        byName: citizen.name,
        byRole: citizen.role,
        at: new Date(now - 4 * day),
      },
    ];
    const worked = [STATUS.ASSIGNED, STATUS.IN_PROGRESS, STATUS.RESOLVED, STATUS.ESCALATED].includes(
      sample.status
    );
    if (worked) {
      timeline.push({
        status: STATUS.UNDER_REVIEW,
        note: 'Sample: Reviewed by municipal authority.',
        by: municipal._id,
        byName: municipal.name,
        byRole: municipal.role,
        at: new Date(now - 3 * day),
      });
      timeline.push({
        status: STATUS.VERIFIED,
        note: 'Sample: Verified on site.',
        by: municipal._id,
        byName: municipal.name,
        byRole: municipal.role,
        at: new Date(now - 3 * day + 2 * 60 * 60 * 1000),
      });
      timeline.push({
        status: STATUS.ASSIGNED,
        note: `Sample: Assigned to ${sample.assignedDepartment}.`,
        by: municipal._id,
        byName: municipal.name,
        byRole: municipal.role,
        department: sample.assignedDepartment,
        at: new Date(now - 2 * day),
      });
    }
    if ([STATUS.IN_PROGRESS, STATUS.RESOLVED].includes(sample.status)) {
      timeline.push({
        status: STATUS.IN_PROGRESS,
        note: 'Sample: Work in progress.',
        by: municipal._id,
        byName: municipal.name,
        byRole: municipal.role,
        department: sample.assignedDepartment,
        at: new Date(now - day),
      });
    }
    if (sample.status === STATUS.RESOLVED) {
      timeline.push({
        status: STATUS.RESOLVED,
        note: 'Sample: Issue resolved.',
        by: municipal._id,
        byName: municipal.name,
        byRole: municipal.role,
        department: sample.assignedDepartment,
        at: new Date(now - 20 * 60 * 60 * 1000),
      });
    }
    if (sample.status === STATUS.ESCALATED) {
      timeline.push({
        status: STATUS.ESCALATED,
        note: 'Sample: Escalated due to urgency.',
        by: municipal._id,
        byName: municipal.name,
        byRole: municipal.role,
        at: new Date(now - 6 * 60 * 60 * 1000),
      });
    }

    await store.add('complaints', {
      severity: 'Medium',
      priority: 'Normal',
      assignedDepartment: '',
      escalationLevel: 0,
      rejectedReason: '',
      media: [],
      duplicateCandidates: [],
      feedback: {},
      reopen: { isReopened: false, reason: '', verified: false },
      ...sample,
      complaintId,
      reporter: citizen._id,
      isSeed: true,
      createdAt: timeline[0].at,
      updatedAt: new Date(),
      timeline,
    });
  }
}

/* ------------------------------------------------------------------- the API */

export function createDataApi(store, options = {}) {
  const session = options.session || makeBrowserSession();
  let seedError = null;
  let seedPromise = null;

  const ready = () => {
    if (!seedPromise) {
      seedPromise = ensureSeedData(store, {
        adminAccount: options.adminAccount || ADMIN_ACCOUNT,
        seedDemo: options.seedDemo ?? SEED_DEMO,
      }).catch((error) => {
        seedError = error;
      });
    }
    return seedPromise;
  };

  async function currentUser() {
    const token = session.getItem(SESSION_KEY);
    if (!token) throw httpError(401, 'Authentication required');
    let payload;
    try {
      payload = JSON.parse(atob(token));
    } catch {
      throw httpError(401, 'Invalid or expired session');
    }
    if (!payload?.id || (payload.exp && payload.exp < Date.now())) {
      throw httpError(401, 'Invalid or expired session');
    }
    const user = await store.get('users', payload.id);
    if (!user || user.isActive === false) throw httpError(401, 'Invalid or inactive account');
    if (user.isApproved === false) throw httpError(403, 'Account pending administrator approval');
    return user;
  }

  async function findUserByEmail(email) {
    return store.findBy('users', 'email', String(email || '').trim().toLowerCase());
  }

  async function hydrate(list, populate = []) {
    const entries = populate.map((entry) => (typeof entry === 'string' ? { path: entry } : entry));
    if (!entries.length) return list;
    const paths = new Set(entries.map((entry) => entry.path));
    const selectFor = (path) => entries.find((entry) => entry.path === path)?.select;

    const users = await store.list('users');
    const userMap = new Map(users.map((user) => [String(user._id), user]));

    for (const complaint of list) {
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
      const all = await store.list('complaints');
      const complaintMap = new Map(all.map((complaint) => [String(complaint._id), complaint]));
      for (const complaint of list) {
        complaint.duplicateCandidates = (complaint.duplicateCandidates || []).map((id) => {
          const found = complaintMap.get(String(id?._id ?? id));
          return found
            ? pickFields(found, selectFor('duplicateCandidates'), 'complaintId title status category createdAt')
            : id;
        });
      }
    }

    return list;
  }

  async function createNotification({ user, type, title, message, complaint, metadata = {} }) {
    if (!user) return null;
    return store.add('notifications', {
      user: String(user?._id ?? user),
      type: type || 'system',
      title,
      message,
      complaint: complaint || '',
      metadata,
      read: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  async function notifyUsers(userIds, payload) {
    const ids = [...new Set((userIds || []).filter(Boolean).map(String))];
    for (const id of ids) await createNotification({ ...payload, user: id });
  }

  async function storeMedia(files, rawMeta, fallback) {
    const media = [];
    const metaList = parseMediaMeta(rawMeta);
    let index = 0;
    for (const file of files) {
      const meta = metaList[index++] || {};
      const type = String(file.type || '').startsWith('video/') ? 'video' : 'image';
      const latitude = meta.latitude ?? fallback.latitude;
      const longitude = meta.longitude ?? fallback.longitude;
      const path = `evidence/${fallback.userId}/${Date.now()}-${randomHex(4)}-${safeFileName(file.name)}`;

      let url = '';
      let publicId = '';
      try {
        url = await store.uploadFile(path, file);
        publicId = path;
      } catch {
        // Without Storage rules, small photos still reach Firestore as data URLs.
        if (type === 'image' && Number(file.size) <= 900 * 1024) {
          url = await fileToDataUrl(file);
        } else {
          throw httpError(
            502,
            'Evidence could not be saved to Firebase Storage. Check the Storage rules for this project.'
          );
        }
      }

      const geo = { latitude, longitude };
      if (meta.accuracy != null) geo.accuracy = meta.accuracy;
      if (meta.address || fallback.address) geo.address = meta.address || fallback.address;
      if (meta.capturedAt) geo.capturedAt = meta.capturedAt;

      media.push({
        url,
        publicId,
        type,
        filename: file.name || `evidence-${index}`,
        size: Number(file.size) || 0,
        ...geo,
      });
    }
    return media;
  }

  function scopedComplaintFilter(user) {
    if (user.role === ROLES.SUPERIOR) return {};
    if (user.role === ROLES.MUNICIPAL) {
      const municipality = user.jurisdiction?.municipality || user.municipality;
      return municipality ? placeMatches('location.municipality', municipality) : { _id: null };
    }
    if (user.role === ROLES.WARD_OFFICER) {
      const ward = user.jurisdiction?.ward || user.ward;
      const municipality = user.jurisdiction?.municipality || user.municipality;
      if (!municipality && !ward) return { _id: null };
      const parts = [];
      if (municipality) parts.push(placeMatches('location.municipality', municipality));
      if (ward) {
        parts.push({
          $or: [placeMatches('location.ward', ward), { 'location.ward': { $in: ['', null] } }],
        });
      }
      return parts.length === 1 ? parts[0] : { $and: parts };
    }
    return { reporter: user._id };
  }

  function ensureComplaintAccess(user, complaint) {
    if (user.role === ROLES.CITIZEN) {
      const reporter = complaint.reporter?._id ?? complaint.reporter;
      if (String(reporter) !== String(user._id)) return 'You do not have access to this complaint';
    }
    if (user.role === ROLES.MUNICIPAL) {
      const municipality = user.jurisdiction?.municipality || user.municipality;
      if (municipality && !samePlace(complaint.location?.municipality, municipality)) {
        return 'Complaint outside your jurisdiction';
      }
    }
    if (user.role === ROLES.WARD_OFFICER) {
      const municipality = user.jurisdiction?.municipality || user.municipality;
      const ward = user.jurisdiction?.ward || user.ward;
      if (municipality && !samePlace(complaint.location?.municipality, municipality)) {
        return 'Complaint outside your jurisdiction';
      }
      if (ward && complaint.location?.ward && !samePlace(complaint.location.ward, ward)) {
        return 'Complaint outside your ward';
      }
    }
    return null;
  }

  function roleCanSetStatus(role, status) {
    const allowed = {
      [ROLES.MUNICIPAL]: [
        STATUS.UNDER_REVIEW,
        STATUS.VERIFIED,
        STATUS.ASSIGNED,
        STATUS.IN_PROGRESS,
        STATUS.RESOLVED,
        STATUS.REJECTED,
        STATUS.ESCALATED,
      ],
      [ROLES.WARD_OFFICER]: [
        STATUS.ASSIGNED,
        STATUS.IN_PROGRESS,
        STATUS.RESOLVED,
        STATUS.REJECTED,
        STATUS.ESCALATED,
      ],
      [ROLES.SUPERIOR]: Object.values(STATUS),
    };
    return (allowed[role] || []).includes(status);
  }

  async function readComplaint(id) {
    return store.get('complaints', id);
  }

  async function saveComplaint(complaint) {
    const { _id, ...data } = complaint;
    await store.set('complaints', _id, { ...data, updatedAt: new Date() });
    return complaint;
  }

  async function complaintsListAll() {
    return store.list('complaints');
  }

  async function findDuplicateCandidates({ lng, lat, category, reporterId }) {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const all = await complaintsListAll();
    return all
      .filter((complaint) =>
        matches(complaint, {
          reporter: { $ne: reporterId },
          category,
          status: { $nin: [STATUS.RESOLVED, STATUS.REJECTED] },
          createdAt: { $gte: since },
          location: {
            $near: {
              $geometry: { type: 'Point', coordinates: [lng, lat] },
              $maxDistance: 100,
            },
          },
        })
      )
      .slice(0, 5)
      .map((complaint) => ({
        _id: complaint._id,
        complaintId: complaint.complaintId,
        title: complaint.title,
        status: complaint.status,
        createdAt: complaint.createdAt,
      }));
  }

  async function findOfficer(id) {
    const user = await store.get('users', id);
    if (!user) throw httpError(400, 'Assigned user not found');
    return user;
  }

  /* --------------------------------------------------------------- payloads */

  function parseBody(body) {
    if (body instanceof FormData) {
      const fields = {};
      for (const [key, value] of body.entries()) {
        if (typeof value === 'string') fields[key] = value;
      }
      const files = body.getAll('media').filter((value) => typeof value === 'object' && value !== null);
      return { fields, files };
    }
    if (body && typeof body === 'object') return { fields: body, files: [] };
    return { fields: {}, files: [] };
  }

  /* ------------------------------------------------------------------ routes */

  async function handleAuth(method, path, body) {
    const { fields } = parseBody(body);

    if (method === 'POST' && path === '/auth/login') {
      await ready();
      const email = String(fields.email || '').trim().toLowerCase();
      const password = String(fields.password || '');
      if (!email || !password) throw httpError(400, 'Email and password are required');

      const user = await findUserByEmail(email);
      if (!user || !user.passwordHash) {
        if (seedError) {
          throw httpError(
            503,
            'The CivicTrack database could not be initialised. Check that Firestore is enabled for the project.'
          );
        }
        throw httpError(401, 'Invalid email or password');
      }
      const candidate = await hashPassword(password, user.passwordSalt);
      if (candidate !== user.passwordHash) throw httpError(401, 'Invalid email or password');
      if (user.isActive === false) throw httpError(403, 'Account is disabled');
      if (user.isApproved === false) throw httpError(403, 'Account pending administrator approval');

      await store.set('users', user._id, { lastLoginAt: new Date(), updatedAt: new Date() });
      const token = makeSession(user);
      session.setItem(SESSION_KEY, token);
      return { token, user: safeUser(user) };
    }

    if (method === 'POST' && path === '/auth/register') {
      await ready();
      const name = String(fields.name || '').trim();
      const email = String(fields.email || '').trim().toLowerCase();
      const password = String(fields.password || '');
      if (!name) throw httpError(400, 'Name is required');
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw httpError(400, 'A valid email is required');
      if (password.length < 8) throw httpError(400, 'Password must be at least 8 characters');
      if (await findUserByEmail(email)) {
        throw httpError(409, 'An account with this email already exists');
      }

      const user = await createUserRecord(store, {
        name,
        email,
        password,
        phone: String(fields.phone || ''),
        municipality: String(fields.municipality || ''),
        ward: String(fields.ward || ''),
        jurisdiction: {
          municipality: String(fields.municipality || ''),
          ward: String(fields.ward || ''),
        },
        role: ROLES.CITIZEN,
        isApproved: true,
      });
      const token = makeSession(user);
      session.setItem(SESSION_KEY, token);
      return { token, user: safeUser(user) };
    }

    if (method === 'GET' && path === '/auth/me') {
      const user = await currentUser();
      return { user: safeUser(user) };
    }

    if (method === 'PATCH' && path === '/auth/profile') {
      const user = await currentUser();
      const allowed = ['name', 'phone', 'avatar', 'notificationPreferences'];
      const patch = {};
      for (const key of allowed) {
        if (fields[key] !== undefined) patch[key] = fields[key];
      }
      await store.set('users', user._id, { ...patch, updatedAt: new Date() });
      const updated = { ...user, ...patch };
      session.setItem(LEGACY_USER_KEY, JSON.stringify(safeUser(updated)));
      return { user: safeUser(updated) };
    }

    if (method === 'POST' && path === '/auth/change-password') {
      const user = await currentUser();
      const currentPassword = String(fields.currentPassword || '');
      const newPassword = String(fields.newPassword || '');
      if (newPassword.length < 8) throw httpError(400, 'New password must be at least 8 characters');
      if (!user.passwordHash) throw httpError(400, 'Password change is not available for this account');
      const candidate = await hashPassword(currentPassword, user.passwordSalt);
      if (candidate !== user.passwordHash) throw httpError(400, 'Current password is incorrect');
      const secret = await hashNewPassword(newPassword);
      await store.set('users', user._id, { ...secret, updatedAt: new Date() });
      return { message: 'Password updated successfully' };
    }

    return null;
  }

  async function handleComplaints(method, path, body, config) {
    const { fields, files } = parseBody(body);

    if (method === 'POST' && path === '/complaints') {
      const user = await currentUser();
      const title = String(fields.title || '').trim();
      const description = String(fields.description || '').trim();
      if (!title) throw httpError(400, 'Title is required');
      if (!description) throw httpError(400, 'Description is required');
      if (files.length > MAX_MEDIA_FILES) throw httpError(400, `Up to ${MAX_MEDIA_FILES} files are allowed`);

      const lat = Number(fields.latitude);
      const lng = Number(fields.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        throw httpError(400, 'Valid latitude and longitude are required');
      }
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        throw httpError(400, 'Coordinates are out of range');
      }

      const reporterMunicipality = user.jurisdiction?.municipality || user.municipality || '';
      const reporterWard = user.jurisdiction?.ward || user.ward || '';
      const municipality = String(fields.municipality || '').trim() || reporterMunicipality;
      const ward = String(fields.ward || '').trim() || reporterWard;
      const address = String(fields.address || '').trim();
      const category = String(fields.category || 'Other');

      const media = await storeMedia(files, fields.mediaMeta, {
        latitude: lat,
        longitude: lng,
        address,
        userId: user._id,
      });

      const duplicates = await findDuplicateCandidates({
        lng,
        lat,
        category: fields.category,
        reporterId: user._id,
      });
      const complaintId = await nextComplaintId(store);

      const complaint = await store.add('complaints', {
        complaintId,
        reporter: user._id,
        title,
        description,
        category,
        severity: SEVERITIES.includes(fields.severity) ? fields.severity : 'Medium',
        location: {
          type: 'Point',
          coordinates: [lng, lat],
          address,
          landmark: String(fields.landmark || ''),
          municipality,
          ward,
          source: LOCATION_SOURCES.includes(fields.locationSource) ? fields.locationSource : '',
        },
        media,
        duplicateCandidates: duplicates.map((entry) => entry._id),
        timeline: [
          {
            status: STATUS.SUBMITTED,
            note: 'Complaint submitted by citizen',
            by: user._id,
            byName: user.name,
            byRole: user.role,
            at: new Date(),
          },
        ],
        status: STATUS.SUBMITTED,
        priority: 'Normal',
        assignedDepartment: '',
        escalationLevel: 0,
        rejectedReason: '',
        feedback: {},
        reopen: { isReopened: false, reason: '', verified: false },
        isSeed: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await createNotification({
        user: user._id,
        type: 'complaint_submitted',
        title: 'Complaint submitted',
        message: `Your complaint ${complaint.complaintId} has been submitted successfully.`,
        complaint: complaint._id,
      });

      const allUsers = await store.list('users');
      const authorities = allUsers.filter(
        (candidate) =>
          candidate.role === ROLES.MUNICIPAL &&
          candidate.isActive !== false &&
          candidate.isApproved !== false &&
          (!municipality ||
            samePlace(candidate.jurisdiction?.municipality || candidate.municipality, municipality))
      );
      await notifyUsers(
        authorities.map((authority) => authority._id),
        {
          type: 'assignment',
          title: `New ${category} complaint reported`,
          message: `New ${category} complaint ${complaint.complaintId} reported in ${
            municipality || 'your area'
          }${ward ? ` (${ward})` : ''}.`,
          complaint: complaint._id,
        }
      );

      return {
        complaint,
        duplicates,
        message: duplicates.length
          ? 'Complaint submitted. Similar nearby complaints were found and flagged for review.'
          : 'Complaint submitted successfully.',
      };
    }

    if (method === 'GET' && path === '/complaints/stats') {
      const user = await currentUser();
      return complaintStats(scopedComplaintFilter(user));
    }

    if (method === 'GET' && path === '/complaints/map') {
      const user = await currentUser();
      const filter = scopedComplaintFilter(user);
      const params = config?.params || {};
      if (params.status) filter.status = params.status;
      if (params.category) filter.category = params.category;
      if (params.severity) filter.severity = params.severity;
      const all = sortDocs(
        (await complaintsListAll()).filter((complaint) => matches(complaint, filter)),
        '-createdAt'
      ).slice(0, 1000);
      return {
        complaints: all.map((complaint) => ({
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
        })),
      };
    }

    if (method === 'GET' && path === '/complaints/evidence') {
      const user = await currentUser();
      const params = config?.params || {};
      const type = params.type || 'all';
      const search = String(params.search || '').trim();
      const filter = scopedComplaintFilter(user);
      if (search) {
        filter.$or = [
          { complaintId: { $regex: search, $options: 'i' } },
          { title: { $regex: search, $options: 'i' } },
          { 'location.address': { $regex: search, $options: 'i' } },
          { 'location.municipality': { $regex: search, $options: 'i' } },
          { 'location.ward': { $regex: search, $options: 'i' } },
        ];
      }
      const docs = sortDocs(
        (await complaintsListAll()).filter((complaint) => matches(complaint, filter)),
        '-createdAt'
      ).slice(0, 1000);
      await hydrate(docs, [{ path: 'reporter', select: 'name email' }]);

      const items = [];
      for (const complaint of docs) {
        const coords = complaint.location?.coordinates || [];
        const reporter = complaint.reporter;
        const groups = [
          { kind: 'Complaint evidence', media: complaint.media || [] },
          ...(complaint.timeline || [])
            .filter((entry) => entry.media?.length)
            .map((entry) => ({ kind: 'Resolution proof', media: entry.media })),
        ];
        for (const group of groups) {
          group.media.forEach((media, index) => {
            const latitude = media.latitude ?? coords[1] ?? null;
            const longitude = media.longitude ?? coords[0] ?? null;
            items.push({
              id: `${complaint._id}-${group.kind}-${index}-${media.url}`,
              url: media.url,
              mediaType: media.type === 'video' ? 'video' : 'image',
              filename: media.filename || '',
              size: media.size || 0,
              kind: group.kind,
              latitude,
              longitude,
              accuracy: media.accuracy ?? null,
              address: media.address || complaint.location?.address || '',
              capturedAt: media.capturedAt || complaint.createdAt,
              mapsUrl:
                latitude != null && longitude != null
                  ? `https://www.google.com/maps?q=${latitude},${longitude}`
                  : '',
              reporter: reporter?.name || '',
              reporterEmail: reporter?.email || '',
              complaint: {
                _id: complaint._id,
                complaintId: complaint.complaintId,
                title: complaint.title,
                category: complaint.category,
                status: complaint.status,
                municipality: complaint.location?.municipality || '',
                ward: complaint.location?.ward || '',
                createdAt: complaint.createdAt,
              },
            });
          });
        }
      }

      const filtered = items
        .filter((item) =>
          type === 'photo'
            ? item.mediaType === 'image'
            : type === 'video'
              ? item.mediaType === 'video'
              : true
        )
        .sort((a, b) => new Date(b.capturedAt || 0) - new Date(a.capturedAt || 0));

      const pageNumber = Math.max(1, Number(params.page) || 1);
      const pageSize = Math.min(60, Math.max(1, Number(params.limit) || 24));
      const start = (pageNumber - 1) * pageSize;

      return {
        items: filtered.slice(start, start + pageSize),
        summary: {
          total: filtered.length,
          photos: filtered.filter((item) => item.mediaType === 'image').length,
          videos: filtered.filter((item) => item.mediaType === 'video').length,
          geoTagged: filtered.filter((item) => item.latitude != null && item.longitude != null).length,
          complaints: docs.length,
        },
        pagination: {
          total: filtered.length,
          page: pageNumber,
          limit: pageSize,
          pages: Math.ceil(filtered.length / pageSize) || 1,
        },
      };
    }

    if (method === 'GET' && path === '/complaints') {
      const user = await currentUser();
      const params = config?.params || {};
      const {
        status,
        category,
        severity,
        ward,
        municipality,
        department,
        search,
        page = 1,
        limit = 20,
        sort = '-createdAt',
        mine,
      } = params;

      const filter = scopedComplaintFilter(user);
      if (mine === 'true') filter.reporter = user._id;
      if (status) filter.status = status;
      if (category) filter.category = category;
      if (severity) filter.severity = severity;
      if (department) filter.assignedDepartment = department;
      if (ward) Object.assign(filter, placeMatches('location.ward', ward));
      if (municipality) Object.assign(filter, placeMatches('location.municipality', municipality));
      if (search) {
        filter.$or = [
          { complaintId: { $regex: search, $options: 'i' } },
          { title: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
          { 'location.address': { $regex: search, $options: 'i' } },
        ];
      }

      const pageNumber = Math.max(1, Number(page));
      const pageSize = Math.min(100, Math.max(1, Number(limit)));
      const found = sortDocs(
        (await complaintsListAll()).filter((complaint) => matches(complaint, filter)),
        sort
      );
      const items = await hydrate(paginate(found, pageNumber, pageSize), [
        { path: 'reporter', select: 'name email' },
        { path: 'assignedTo', select: 'name email role department' },
      ]);

      return {
        complaints: items,
        pagination: {
          total: found.length,
          page: pageNumber,
          limit: pageSize,
          pages: Math.ceil(found.length / pageSize) || 1,
        },
      };
    }

    const detailMatch = path.match(/^\/complaints\/([^/]+)$/);
    if (method === 'GET' && detailMatch) {
      const user = await currentUser();
      const complaint = await readComplaint(detailMatch[1]);
      if (!complaint) throw httpError(404, 'Complaint not found');
      const accessError = ensureComplaintAccess(user, complaint);
      if (accessError) throw httpError(403, accessError);
      await hydrate([complaint], [
        { path: 'reporter', select: 'name email phone' },
        { path: 'assignedTo', select: 'name email role department municipality ward' },
        { path: 'timeline.by', select: 'name role' },
        { path: 'duplicateCandidates', select: 'complaintId title status category createdAt' },
      ]);
      return { complaint };
    }

    const statusMatch = path.match(/^\/complaints\/([^/]+)\/status$/);
    if (method === 'PATCH' && statusMatch) {
      const user = await currentUser();
      const { fields: change, files: proofFiles } = parseBody(body);
      const status = change.status;
      if (!status) throw httpError(400, 'Status is required');
      if (!Object.values(STATUS).includes(status)) throw httpError(400, 'Invalid status');

      const complaint = await readComplaint(statusMatch[1]);
      if (!complaint) throw httpError(404, 'Complaint not found');
      const accessError = ensureComplaintAccess(user, complaint);
      if (accessError) throw httpError(403, accessError);

      if (user.role !== ROLES.SUPERIOR && !roleCanSetStatus(user.role, status)) {
        throw httpError(403, 'Your role cannot set this status');
      }
      if (!(STATUS_FLOW[complaint.status] || []).includes(status)) {
        throw httpError(400, `Cannot transition from ${complaint.status} to ${status}`);
      }
      if (status === STATUS.REJECTED && !(change.rejectedReason || change.note)) {
        throw httpError(400, 'Rejection reason is required');
      }

      const [complaintLng, complaintLat] = complaint.location?.coordinates || [];
      const proofMedia = await storeMedia(proofFiles, change.mediaMeta, {
        latitude: complaintLat,
        longitude: complaintLng,
        address: complaint.location?.address || '',
        userId: user._id,
      });

      const previousStatus = complaint.status;
      complaint.status = status;
      if (change.assignedDepartment !== undefined) complaint.assignedDepartment = change.assignedDepartment;
      if (change.priority) complaint.priority = change.priority;
      if (change.deadline) complaint.deadline = new Date(change.deadline);
      if (status === STATUS.REJECTED) complaint.rejectedReason = change.rejectedReason || change.note || '';
      if (status === STATUS.RESOLVED) complaint.resolvedAt = new Date();
      if (status === STATUS.ESCALATED) {
        complaint.escalatedAt = new Date();
        complaint.escalationLevel = Math.min(2, (complaint.escalationLevel || 0) + 1);
      }
      if (change.assignedTo) {
        const assignee = await findOfficer(change.assignedTo);
        complaint.assignedTo = assignee._id;
        if (!complaint.assignedDepartment && assignee.department) {
          complaint.assignedDepartment = assignee.department;
        }
      }

      complaint.timeline = [
        ...(complaint.timeline || []),
        {
          status,
          note: change.note || `Status changed from ${previousStatus} to ${status}`,
          by: user._id,
          byName: user.name,
          byRole: user.role,
          department: complaint.assignedDepartment || '',
          media: proofMedia,
          at: new Date(),
        },
      ];
      await saveComplaint(complaint);

      const reporterId = complaint.reporter?._id ?? complaint.reporter;
      await createNotification({
        user: reporterId,
        type:
          status === STATUS.RESOLVED ? 'resolved' : status === STATUS.ESCALATED ? 'escalation' : 'status_update',
        title: 'Complaint status updated',
        message: `Your complaint ${complaint.complaintId} status changed to ${status}.`,
        complaint: complaint._id,
      });
      if (complaint.assignedTo && String(complaint.assignedTo) !== String(reporterId)) {
        await createNotification({
          user: complaint.assignedTo,
          type: 'status_update',
          title: 'Assigned complaint updated',
          message: `Complaint ${complaint.complaintId} is now ${status}.`,
          complaint: complaint._id,
        });
      }

      return { complaint, message: 'Complaint status updated' };
    }

    const assignMatch = path.match(/^\/complaints\/([^/]+)\/assign$/);
    if (method === 'PATCH' && assignMatch) {
      const user = await currentUser();
      const change = fields;
      const complaint = await readComplaint(assignMatch[1]);
      if (!complaint) throw httpError(404, 'Complaint not found');
      const accessError = ensureComplaintAccess(user, complaint);
      if (accessError) throw httpError(403, accessError);
      if (![ROLES.MUNICIPAL, ROLES.WARD_OFFICER, ROLES.SUPERIOR].includes(user.role)) {
        throw httpError(403, 'Not authorized to assign complaints');
      }

      let assignee = null;
      if (change.assignedTo) {
        assignee = await findOfficer(change.assignedTo);
        complaint.assignedTo = assignee._id;
        if (!change.assignedDepartment && assignee.department) {
          complaint.assignedDepartment = assignee.department;
        }
      }
      if (change.assignedDepartment) complaint.assignedDepartment = change.assignedDepartment;
      if (change.deadline) complaint.deadline = new Date(change.deadline);
      if (change.priority) complaint.priority = change.priority;

      const previous = complaint.status;
      if (
        previous === STATUS.ESCALATED ||
        (STATUS_FLOW[previous] || []).includes(STATUS.ASSIGNED)
      ) {
        complaint.status = STATUS.ASSIGNED;
      }

      complaint.timeline = [
        ...(complaint.timeline || []),
        {
          status: complaint.status,
          note:
            change.note ||
            `Complaint assigned${
              complaint.assignedDepartment ? ` to ${complaint.assignedDepartment}` : ''
            }${assignee ? ` (${assignee.name})` : ''}.`,
          by: user._id,
          byName: user.name,
          byRole: user.role,
          department: complaint.assignedDepartment || '',
          at: new Date(),
        },
      ];
      await saveComplaint(complaint);

      const reporterId = complaint.reporter?._id ?? complaint.reporter;
      await createNotification({
        user: reporterId,
        type: 'status_update',
        title: 'Complaint assigned',
        message: `Your complaint ${complaint.complaintId} has been assigned for resolution.`,
        complaint: complaint._id,
      });
      if (complaint.assignedTo) {
        await createNotification({
          user: complaint.assignedTo,
          type: 'assignment',
          title: 'New complaint assigned',
          message: `Complaint ${complaint.complaintId} has been assigned to you.`,
          complaint: complaint._id,
        });
      }
      return { complaint, message: 'Complaint assigned successfully' };
    }

    const escalateMatch = path.match(/^\/complaints\/([^/]+)\/escalate$/);
    if (method === 'PATCH' && escalateMatch) {
      const user = await currentUser();
      const change = fields;
      const complaint = await readComplaint(escalateMatch[1]);
      if (!complaint) throw httpError(404, 'Complaint not found');
      const accessError = ensureComplaintAccess(user, complaint);
      if (accessError) throw httpError(403, accessError);
      if (![ROLES.MUNICIPAL, ROLES.WARD_OFFICER, ROLES.SUPERIOR].includes(user.role)) {
        throw httpError(403, 'Not authorized to escalate complaints');
      }
      const escalatable = [
        STATUS.ASSIGNED,
        STATUS.IN_PROGRESS,
        STATUS.UNDER_REVIEW,
        STATUS.VERIFIED,
        STATUS.ESCALATED,
      ];
      if (!escalatable.includes(complaint.status)) {
        throw httpError(400, `Complaint cannot be escalated from ${complaint.status}`);
      }

      const previous = complaint.status;
      complaint.status = STATUS.ESCALATED;
      complaint.escalatedAt = new Date();
      complaint.escalationLevel = Math.min(2, (complaint.escalationLevel || 0) + 1);
      if (change.priority) complaint.priority = change.priority;
      complaint.timeline = [
        ...(complaint.timeline || []),
        {
          status: STATUS.ESCALATED,
          note: change.note || `Complaint escalated from ${previous}.`,
          by: user._id,
          byName: user.name,
          byRole: user.role,
          department: complaint.assignedDepartment || '',
          at: new Date(),
        },
      ];
      await saveComplaint(complaint);

      const reporterId = complaint.reporter?._id ?? complaint.reporter;
      await createNotification({
        user: reporterId,
        type: 'escalation',
        title: 'Complaint escalated',
        message: `Your complaint ${complaint.complaintId} has been escalated for higher-level review.`,
        complaint: complaint._id,
      });

      const municipality = complaint.location?.municipality;
      const ward = complaint.location?.ward;
      const allUsers = await store.list('users');
      const targets = allUsers.filter((candidate) => {
        if (candidate.isActive === false || candidate.isApproved === false) return false;
        if (candidate.role === ROLES.SUPERIOR) return true;
        if (candidate.role !== ROLES.WARD_OFFICER) return false;
        const candidateMunicipality = candidate.jurisdiction?.municipality || candidate.municipality;
        if (municipality && !samePlace(candidateMunicipality, municipality)) return false;
        const candidateWard = candidate.jurisdiction?.ward || candidate.ward;
        if (ward && candidateWard && candidateWard !== ward) return false;
        return true;
      });
      await notifyUsers(
        targets.map((target) => target._id),
        {
          type: 'escalation',
          title: 'Complaint escalated',
          message: `Complaint ${complaint.complaintId} requires higher-level attention.`,
          complaint: complaint._id,
        }
      );
      return { complaint, message: 'Complaint escalated' };
    }

    const feedbackMatch = path.match(/^\/complaints\/([^/]+)\/feedback$/);
    if (method === 'POST' && feedbackMatch) {
      const user = await currentUser();
      const complaint = await readComplaint(feedbackMatch[1]);
      if (!complaint) throw httpError(404, 'Complaint not found');
      if (String(complaint.reporter?._id ?? complaint.reporter) !== String(user._id)) {
        throw httpError(403, 'Only the reporting citizen can submit feedback');
      }
      if (complaint.status !== STATUS.RESOLVED) {
        throw httpError(400, 'Feedback can only be submitted for resolved complaints');
      }
      const rating = Number(fields.rating);
      if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
        throw httpError(400, 'Rating must be between 1 and 5');
      }
      complaint.feedback = {
        rating,
        comment: fields.comment || '',
        submittedAt: new Date(),
      };
      complaint.timeline = [
        ...(complaint.timeline || []),
        {
          status: complaint.status,
          note: `Citizen submitted feedback: ${rating}/5${fields.comment ? ` - ${fields.comment}` : ''}`,
          by: user._id,
          byName: user.name,
          byRole: user.role,
          at: new Date(),
        },
      ];
      await saveComplaint(complaint);
      if (complaint.assignedTo) {
        await createNotification({
          user: complaint.assignedTo,
          type: 'feedback',
          title: 'Complaint feedback received',
          message: `Feedback received for ${complaint.complaintId}: ${rating}/5.`,
          complaint: complaint._id,
        });
      }
      return { complaint, message: 'Feedback submitted' };
    }

    const reopenMatch = path.match(/^\/complaints\/([^/]+)\/reopen$/);
    if (method === 'POST' && reopenMatch) {
      const user = await currentUser();
      const reason = String(fields.reason || '').trim();
      if (!reason) throw httpError(400, 'Reason for reopening is required');
      const complaint = await readComplaint(reopenMatch[1]);
      if (!complaint) throw httpError(404, 'Complaint not found');
      if (String(complaint.reporter?._id ?? complaint.reporter) !== String(user._id)) {
        throw httpError(403, 'Only the reporting citizen can reopen this complaint');
      }
      if (complaint.status !== STATUS.RESOLVED) {
        throw httpError(400, 'Only resolved complaints can be reopened');
      }

      complaint.reopen = { isReopened: true, reason, reopenedAt: new Date(), verified: false };
      complaint.status = STATUS.UNDER_REVIEW;
      delete complaint.resolvedAt;
      complaint.timeline = [
        ...(complaint.timeline || []),
        {
          status: STATUS.UNDER_REVIEW,
          note: `Complaint reopened by citizen: ${reason}`,
          by: user._id,
          byName: user.name,
          byRole: user.role,
          at: new Date(),
        },
      ];
      await saveComplaint(complaint);

      const municipality = complaint.location?.municipality;
      const allUsers = await store.list('users');
      const authorities = allUsers.filter((candidate) => {
        if (![ROLES.MUNICIPAL, ROLES.WARD_OFFICER].includes(candidate.role)) return false;
        if (candidate.isActive === false || candidate.isApproved === false) return false;
        if (!municipality) return true;
        return samePlace(candidate.jurisdiction?.municipality || candidate.municipality, municipality);
      });
      await notifyUsers(
        authorities.map((authority) => authority._id),
        {
          type: 'status_update',
          title: 'Complaint reopened',
          message: `Complaint ${complaint.complaintId} was reopened by the citizen and requires verification.`,
          complaint: complaint._id,
        }
      );
      return { complaint, message: 'Complaint reopened and sent for verification' };
    }

    return null;
  }

  async function complaintStats(filter = {}) {
    const all = await complaintsListAll();
    const docs = all.filter((complaint) => matches(complaint, filter));
    const withStatus = (status) => docs.filter((complaint) => complaint.status === status);
    const activeStatuses = [STATUS.SUBMITTED, STATUS.UNDER_REVIEW, STATUS.VERIFIED];
    const workingStatuses = [STATUS.ASSIGNED, STATUS.IN_PROGRESS];
    const closedStatuses = [STATUS.RESOLVED, STATUS.REJECTED];

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
      if (complaint.status === STATUS.RESOLVED) entry.resolved += 1;
      byDepartmentMap.set(department, entry);
    }

    const byWardMap = new Map();
    for (const complaint of docs) {
      const ward = complaint.location?.ward;
      if (!ward) continue;
      const entry = byWardMap.get(ward) || { ward, total: 0, resolved: 0, pending: 0 };
      entry.total += 1;
      if (complaint.status === STATUS.RESOLVED) entry.resolved += 1;
      if (!closedStatuses.includes(complaint.status)) entry.pending += 1;
      byWardMap.set(ward, entry);
    }

    const resolutionTimes = docs
      .filter((complaint) => complaint.status === STATUS.RESOLVED && complaint.resolvedAt)
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
      if (complaint.status === STATUS.RESOLVED) entry.resolved += 1;
      buckets.set(key, entry);
    }

    const recent = sortDocs(docs, '-createdAt').slice(0, 8);
    await hydrate(recent, [{ path: 'reporter', select: 'name' }]);

    const groupCount = (key) => {
      const map = new Map();
      for (const complaint of docs) {
        const value = getPath(complaint, key);
        map.set(value, (map.get(value) || 0) + 1);
      }
      return [...map];
    };

    return {
      trend: [...buckets.values()]
        .sort((left, right) => left.order - right.order)
        .map((entry) => ({ month: entry.month, total: entry.total, resolved: entry.resolved })),
      stats: {
        total: docs.length,
        pending: docs.filter((complaint) => activeStatuses.includes(complaint.status)).length,
        inProgress: docs.filter((complaint) => workingStatuses.includes(complaint.status)).length,
        resolved: withStatus(STATUS.RESOLVED).length,
        escalated: withStatus(STATUS.ESCALATED).length,
        rejected: withStatus(STATUS.REJECTED).length,
        overdue,
        avgResolutionHours: Math.round(avgResolutionMs / 36e5),
      },
      byStatus: groupCount('status').map(([status, count]) => ({ status, count })),
      byCategory: groupCount('category')
        .map(([category, count]) => ({ category, count }))
        .sort((left, right) => right.count - left.count),
      bySeverity: groupCount('severity').map(([severity, count]) => ({ severity, count })),
      byDepartment: [...byDepartmentMap.values()].sort((left, right) => right.total - left.total),
      byWard: [...byWardMap.values()].sort((left, right) => right.total - left.total),
      recent,
    };
  }

  async function handleNotifications(method, path, body, config) {
    if (method === 'GET' && path === '/notifications') {
      const user = await currentUser();
      const params = config?.params || {};
      const pageNumber = Math.max(1, Number(params.page));
      const pageSize = Math.min(100, Math.max(1, Number(params.limit) || 30));
      const unreadOnly = params.unread === 'true';

      const all = (await store.list('notifications')).filter(
        (notification) =>
          String(notification.user?._id ?? notification.user) === String(user._id) &&
          (!unreadOnly || !notification.read)
      );
      const items = paginate(sortDocs(all, '-createdAt'), pageNumber, pageSize);
      const complaintIds = items.map((notification) => notification.complaint).filter(Boolean);
      if (complaintIds.length) {
        const complaints = await complaintsListAll();
        const map = new Map(complaints.map((complaint) => [String(complaint._id), complaint]));
        for (const notification of items) {
          const complaint = map.get(String(notification.complaint));
          if (complaint) {
            notification.complaint = pickFields(complaint, 'complaintId title status');
          }
        }
      }
      return {
        notifications: items,
        unreadCount: all.filter((notification) => !notification.read).length,
        pagination: {
          total: all.length,
          page: pageNumber,
          limit: pageSize,
          pages: Math.ceil(all.length / pageSize) || 1,
        },
      };
    }

    if (method === 'PATCH' && path === '/notifications/read-all') {
      const user = await currentUser();
      const mine = (await store.list('notifications')).filter(
        (notification) => String(notification.user?._id ?? notification.user) === String(user._id) && !notification.read
      );
      for (const notification of mine) {
        await store.set('notifications', notification._id, { read: true, updatedAt: new Date() });
      }
      return { message: 'All notifications marked as read' };
    }

    const readMatch = path.match(/^\/notifications\/([^/]+)\/read$/);
    if (method === 'PATCH' && readMatch) {
      const user = await currentUser();
      const notification = await store.get('notifications', readMatch[1]);
      if (!notification || String(notification.user?._id ?? notification.user) !== String(user._id)) {
        throw httpError(404, 'Notification not found');
      }
      await store.set('notifications', notification._id, { read: true, updatedAt: new Date() });
      return { notification: { ...notification, read: true } };
    }

    return null;
  }

  async function handleAdmin(method, path, body, config) {
    const { fields } = parseBody(body);

    if (method === 'GET' && path === '/admin/officers') {
      const user = await currentUser();
      const params = config?.params || {};
      const filter = {
        isActive: true,
        isApproved: true,
        role: { $in: [ROLES.MUNICIPAL, ROLES.WARD_OFFICER] },
      };
      if (params.role) filter.role = params.role;
      if (params.municipality) filter['jurisdiction.municipality'] = params.municipality;
      if (params.ward) filter['jurisdiction.ward'] = params.ward;
      if (user.role === ROLES.MUNICIPAL) {
        const municipality = user.jurisdiction?.municipality || user.municipality;
        if (municipality) filter['jurisdiction.municipality'] = municipality;
      }
      if (user.role === ROLES.WARD_OFFICER) {
        const municipality = user.jurisdiction?.municipality || user.municipality;
        const ward = user.jurisdiction?.ward || user.ward;
        if (municipality) filter['jurisdiction.municipality'] = municipality;
        if (ward) filter['jurisdiction.ward'] = ward;
      }
      const found = sortDocs(
        (await store.list('users')).filter((candidate) => matches(candidate, filter)),
        '-createdAt'
      ).slice(0, 200);
      return { users: found.map(safeUser) };
    }

    if (method === 'GET' && path === '/admin/users') {
      const user = await currentUser();
      if (user.role !== ROLES.SUPERIOR) throw httpError(403, 'Not authorized to manage users');
      const params = config?.params || {};
      const filter = {};
      if (params.role) filter.role = params.role;
      if (params.municipality) filter['jurisdiction.municipality'] = params.municipality;
      if (params.ward) filter['jurisdiction.ward'] = params.ward;
      if (params.approved === 'true') filter.isApproved = true;
      if (params.approved === 'false') filter.isApproved = false;
      if (params.search) {
        filter.$or = [
          { name: { $regex: params.search, $options: 'i' } },
          { email: { $regex: params.search, $options: 'i' } },
        ];
      }
      const found = sortDocs(
        (await store.list('users')).filter((candidate) => matches(candidate, filter)),
        '-createdAt'
      ).slice(0, 200);
      return { users: found.map(safeUser) };
    }

    if (method === 'POST' && path === '/admin/users') {
      const user = await currentUser();
      if (user.role !== ROLES.SUPERIOR) throw httpError(403, 'Not authorized to manage users');
      const { name, email, password, role, department, municipality, ward, phone } = fields;
      if (![ROLES.MUNICIPAL, ROLES.WARD_OFFICER, ROLES.SUPERIOR].includes(role)) {
        throw httpError(400, 'Invalid authority role');
      }
      if (!name) throw httpError(400, 'Name is required');
      if (!email) throw httpError(400, 'Email is required');
      if (!password || String(password).length < 8) {
        throw httpError(400, 'Password must be at least 8 characters');
      }
      if (await findUserByEmail(email)) throw httpError(409, 'Email already registered');

      const created = await createUserRecord(store, {
        name,
        email,
        password,
        role,
        phone: phone || '',
        department: department || '',
        municipality: municipality || '',
        ward: ward || '',
        jurisdiction: { municipality: municipality || '', ward: ward || '' },
        isApproved: true,
        isActive: true,
        createdBy: user._id,
      });
      return { user: safeUser(created), message: 'Authority account provisioned' };
    }

    const updateMatch = path.match(/^\/admin\/users\/([^/]+)$/);
    if (method === 'PATCH' && updateMatch) {
      const actor = await currentUser();
      if (actor.role !== ROLES.SUPERIOR) throw httpError(403, 'Not authorized to manage users');
      const target = await store.get('users', updateMatch[1]);
      if (!target) throw httpError(404, 'User not found');

      const patch = {};
      if (fields.name !== undefined) patch.name = fields.name;
      if (fields.phone !== undefined) patch.phone = fields.phone;
      if (fields.department !== undefined && (fields.department === '' || DEPARTMENTS.includes(fields.department))) {
        patch.department = fields.department;
      }
      if (fields.municipality !== undefined) {
        patch.municipality = fields.municipality;
        patch.jurisdiction = { ...(target.jurisdiction || {}), municipality: fields.municipality };
      }
      if (fields.ward !== undefined) {
        patch.ward = fields.ward;
        patch.jurisdiction = { ...(target.jurisdiction || {}), ...(patch.jurisdiction || {}), ward: fields.ward };
      }
      if (typeof fields.isActive === 'boolean') patch.isActive = fields.isActive;
      if (typeof fields.isApproved === 'boolean') patch.isApproved = fields.isApproved;
      if (fields.role && [ROLES.MUNICIPAL, ROLES.WARD_OFFICER, ROLES.SUPERIOR, ROLES.CITIZEN].includes(fields.role)) {
        patch.role = fields.role;
      }

      await store.set('users', target._id, { ...patch, updatedAt: new Date() });
      return { user: safeUser({ ...target, ...patch }), message: 'User updated' };
    }

    return null;
  }

  async function handle(method, url, body, config) {
    const [rawPath, queryString] = String(url).split('?');
    const path = rawPath.replace(/\/+$/, '') || '/';
    const params = { ...Object.fromEntries(new URLSearchParams(queryString || '')), ...(config?.params || {}) };
    const request = [method, path, body, { ...(config || {}), params }];

    await ready();

    const authResult = await handleAuth(method, path, body);
    if (authResult) return authResult;

    const complaintResult = await handleComplaints(...request);
    if (complaintResult) return complaintResult;

    const notificationResult = await handleNotifications(...request);
    if (notificationResult) return notificationResult;

    const adminResult = await handleAdmin(...request);
    if (adminResult) return adminResult;

    throw httpError(404, 'Not found');
  }

  return {
    async get(url, config) {
      return { data: await handle('GET', url, undefined, config) };
    },
    async post(url, body, config) {
      return { data: await handle('POST', url, body, config) };
    },
    async patch(url, body, config) {
      return { data: await handle('PATCH', url, body, config) };
    },
    async put(url, body, config) {
      return { data: await handle('PUT', url, body, config) };
    },
    async delete(url, config) {
      return { data: await handle('DELETE', url, undefined, config) };
    },
    ready,
    signOut() {
      session.removeItem(SESSION_KEY);
      session.removeItem(LEGACY_USER_KEY);
    },
  };
}

/* ------------------------------------------------------------------ helpers */

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function placeMatches(field, value) {
  return { [field]: { $regex: `^${escapeRegex(String(value).trim())}$`, $options: 'i' } };
}

function samePlace(left, right) {
  return String(left || '').trim().toLowerCase() === String(right || '').trim().toLowerCase();
}
