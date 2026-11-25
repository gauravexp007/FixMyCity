/**
 * Backend-neutral filter helpers.
 *
 * Controllers express filters in the same shape the Mongo backend uses
 * (e.g. { status: { $in: [...] }, 'location.ward': 'Ward 5' }). Firestore
 * cannot push those predicates down without a pile of composite indexes, so
 * the Firestore backend loads the scoped collection and evaluates the filter
 * here instead. Semantics therefore stay identical across both backends.
 */

function getPath(obj, path) {
  return path
    .split('.')
    .reduce((acc, key) => (acc === null || acc === undefined ? undefined : acc[key]), obj);
}

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
  if (typeof value === 'object' && typeof value.toString === 'function' && !Array.isArray(value)) {
    const text = value.toString();
    if (text !== '[object Object]') return text;
    if (value._id !== undefined) return String(value._id);
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

function compare(actual, expected) {
  if (actual instanceof Date || expected instanceof Date || typeof actual === 'string' || typeof expected === 'string') {
    const a = toMillis(actual);
    const b = toMillis(expected);
    if (a !== null && b !== null) return a - b;
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

function operatorMatches(actual, cond) {
  if ('$eq' in cond && !equals(actual, cond.$eq)) return false;
  if ('$ne' in cond && equals(actual, cond.$ne)) return false;
  if ('$in' in cond) {
    const list = cond.$in || [];
    if (!list.some((item) => equals(actual, item))) return false;
  }
  if ('$nin' in cond) {
    const list = cond.$nin || [];
    if (list.some((item) => equals(actual, item))) return false;
  }
  if (actual === null || actual === undefined) {
    if ('$gt' in cond || '$gte' in cond || '$lt' in cond || '$lte' in cond) return false;
  } else {
    if ('$gt' in cond && !(compare(actual, cond.$gt) > 0)) return false;
    if ('$gte' in cond && !(compare(actual, cond.$gte) >= 0)) return false;
    if ('$lt' in cond && !(compare(actual, cond.$lt) < 0)) return false;
    if ('$lte' in cond && !(compare(actual, cond.$lte) <= 0)) return false;
  }
  if ('$exists' in cond && Boolean(actual !== undefined) !== Boolean(cond.$exists)) return false;
  if ('$regex' in cond) {
    const flags = String(cond.$options || '').replace(/[^gimsuy]/g, '');
    let re;
    try {
      re = new RegExp(cond.$regex, flags);
    } catch {
      return false;
    }
    if (actual === null || actual === undefined || !re.test(String(actual))) return false;
  }
  if ('$near' in cond) {
    const near = cond.$near || {};
    const point = near.$geometry?.coordinates || near;
    const maxDistance = near.$maxDistance ?? Infinity;
    const coords = actual?.coordinates || actual;
    if (haversineMeters(coords, point) > maxDistance) return false;
  }
  return true;
}

export function matches(doc, filter = {}) {
  for (const [key, cond] of Object.entries(filter || {})) {
    if (key === '$or') {
      if (!Array.isArray(cond) || !cond.some((entry) => matches(doc, entry))) return false;
      continue;
    }
    if (key === '$and') {
      if (!Array.isArray(cond) || !cond.every((entry) => matches(doc, entry))) return false;
      continue;
    }
    if (key === '$nor') {
      if (!Array.isArray(cond) || cond.some((entry) => matches(doc, entry))) return false;
      continue;
    }
    const actual = getPath(doc, key);
    const isOperator =
      cond !== null &&
      typeof cond === 'object' &&
      !(cond instanceof Date) &&
      !Array.isArray(cond) &&
      Object.keys(cond).some((k) => k.startsWith('$'));

    if (isOperator) {
      if (!operatorMatches(actual, cond)) return false;
    } else if (cond !== null && typeof cond === 'object' && !Array.isArray(cond) && !(cond instanceof Date)) {
      if (actual === null || actual === undefined || !matches(actual, cond)) return false;
    } else if (Array.isArray(actual) && !Array.isArray(cond)) {
      if (!actual.some((item) => equals(item, cond))) return false;
    } else if (!equals(actual, cond)) {
      return false;
    }
  }
  return true;
}

export function sortDocs(docs, sort = '-createdAt') {
  const parts = String(sort || '-createdAt')
    .split(/[\s,]+/)
    .filter(Boolean)
    .map((field) => ({ key: field.replace(/^[-+]/, ''), direction: field.startsWith('-') ? -1 : 1 }));

  return [...docs].sort((a, b) => {
    for (const { key, direction } of parts) {
      const left = getPath(a, key);
      const right = getPath(b, key);
      if (left === right) continue;
      if (left === undefined || left === null) return 1;
      if (right === undefined || right === null) return -1;
      const result = compare(left, right);
      if (result !== 0) return result * direction;
    }
    return 0;
  });
}

export function paginate(docs, page = 1, limit = 20) {
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.max(1, Number(limit) || 20);
  const start = (pageNum - 1) * limitNum;
  return docs.slice(start, start + limitNum);
}
