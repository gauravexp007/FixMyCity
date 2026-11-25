/**
 * Per-file capture metadata sent by the client as a JSON array aligned with the
 * order of the uploaded `media` files. Each entry describes where and when the
 * photo/video was captured, so evidence stays geo-verifiable after upload.
 */

const MAX_FILES = 6;

function range(value, min, max) {
  const n = Number(value);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
}

function text(value, max = 300) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export function parseMediaMeta(raw) {
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
  return parsed.slice(0, MAX_FILES).map((entry) => {
    if (!entry || typeof entry !== 'object') return {};
    const capturedAt = entry.capturedAt ? new Date(entry.capturedAt) : null;
    return {
      latitude: range(entry.latitude, -90, 90),
      longitude: range(entry.longitude, -180, 180),
      accuracy: range(entry.accuracy, 0, 100000),
      address: text(entry.address),
      capturedAt: capturedAt && !Number.isNaN(capturedAt.getTime()) ? capturedAt : undefined,
    };
  });
}
