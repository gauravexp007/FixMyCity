import { validationResult } from 'express-validator';
import { complaints, users } from '../data/index.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { generateComplaintId } from '../utils/generateComplaintId.js';
import { storeMediaFile } from '../utils/media.js';
import { parseMediaMeta } from '../utils/mediaMeta.js';
import { createNotification, notifyUsers } from '../utils/notificationService.js';
import {
  ROLES,
  COMPLAINT_STATUS,
  STATUS_FLOW,
  COMPLAINT_CATEGORIES,
  SEVERITY_LEVELS,
} from '../utils/constants.js';

function validate(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ message: errors.array()[0].msg, errors: errors.array() });
    return false;
  }
  return true;
}

function canTransition(from, to) {
  return (STATUS_FLOW[from] || []).includes(to);
}

function roleCanSetStatus(role, status) {
  const map = {
    [ROLES.MUNICIPAL]: [
      COMPLAINT_STATUS.UNDER_REVIEW,
      COMPLAINT_STATUS.VERIFIED,
      COMPLAINT_STATUS.ASSIGNED,
      COMPLAINT_STATUS.IN_PROGRESS,
      COMPLAINT_STATUS.RESOLVED,
      COMPLAINT_STATUS.REJECTED,
      COMPLAINT_STATUS.ESCALATED,
    ],
    [ROLES.WARD_OFFICER]: [
      COMPLAINT_STATUS.ASSIGNED,
      COMPLAINT_STATUS.IN_PROGRESS,
      COMPLAINT_STATUS.RESOLVED,
      COMPLAINT_STATUS.REJECTED,
      COMPLAINT_STATUS.ESCALATED,
    ],
    [ROLES.SUPERIOR]: Object.values(COMPLAINT_STATUS),
  };
  return (map[role] || []).includes(status);
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Case/whitespace-insensitive place match, so "central city" and "Central City" agree. */
function placeMatches(field, value) {
  return { [field]: { $regex: `^${escapeRegex(String(value).trim())}$`, $options: 'i' } };
}

function samePlace(a, b) {
  return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
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
      // Complaints filed without a ward still belong to the municipal desk and to
      // the ward officers, rather than disappearing from both logins.
      parts.push({ $or: [placeMatches('location.ward', ward), { 'location.ward': { $in: ['', null] } }] });
    }
    return parts.length === 1 ? parts[0] : { $and: parts };
  }
  return { reporter: user._id };
}

async function findDuplicateCandidates({ lng, lat, category, reporterId }) {
  return complaints.findDuplicateCandidates({ lng, lat, category, reporterId });
}

export const createComplaint = asyncHandler(async (req, res) => {
  if (!validate(req, res)) return;
  const {
    title, description, category, severity, address, landmark,
    latitude, longitude, municipality, ward, locationSource,
  } = req.body;
  const LOCATION_SOURCES = ['gps', 'map', 'address'];

  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ message: 'Valid latitude and longitude are required' });
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return res.status(400).json({ message: 'Coordinates are out of range' });
  }

  // Jurisdiction routing: a complaint with no municipality/ward would never
  // reach the ward or municipal desk, so fall back to the reporter's own area.
  const reporterMunicipality = req.user.jurisdiction?.municipality || req.user.municipality || '';
  const reporterWard = req.user.jurisdiction?.ward || req.user.ward || '';
  const complaintMunicipality = String(municipality || '').trim() || reporterMunicipality;
  const complaintWard = String(ward || '').trim() || reporterWard;

  // Each upload carries the GPS fix captured with it. If the browser could not
  // provide one, the complaint location is used so no evidence is left un-tagged.
  const mediaMeta = parseMediaMeta(req.body.mediaMeta);
  const media = [];
  let mediaIndex = 0;
  for (const file of req.files || []) {
    const meta = mediaMeta[mediaIndex++] || {};
    media.push(await storeMediaFile(file, req, {
      ...meta,
      latitude: meta.latitude ?? lat,
      longitude: meta.longitude ?? lng,
      address: meta.address || address || '',
    }));
  }

  const duplicates = await findDuplicateCandidates({ lng, lat, category, reporterId: req.user._id });
  const complaintId = await generateComplaintId();

  const complaint = await complaints.create({
    complaintId,
    reporter: req.user._id,
    title,
    description,
    category,
    severity: SEVERITY_LEVELS.includes(severity) ? severity : 'Medium',
    location: {
      type: 'Point',
      coordinates: [lng, lat],
      address: address || '',
      landmark: landmark || '',
      municipality: complaintMunicipality,
      ward: complaintWard,
      source: LOCATION_SOURCES.includes(locationSource) ? locationSource : '',
    },
    media,
    duplicateCandidates: duplicates.map((d) => d._id),
    timeline: [
      {
        status: COMPLAINT_STATUS.SUBMITTED,
        note: 'Complaint submitted by citizen',
        by: req.user._id,
        byName: req.user.name,
        byRole: req.user.role,
        at: new Date(),
      },
    ],
  });

  await createNotification({
    user: req.user._id,
    type: 'complaint_submitted',
    title: 'Complaint submitted',
    message: `Your complaint ${complaint.complaintId} has been submitted successfully.`,
    complaint: complaint._id,
  });

  // Notify municipal authorities in jurisdiction
  const authorities = await users.list({
    filter: {
      role: ROLES.MUNICIPAL,
      isActive: true,
      isApproved: true,
      ...(complaintMunicipality ? { 'jurisdiction.municipality': complaintMunicipality } : {}),
    },
    limit: 500,
  });
  await notifyUsers(authorities.map((a) => a._id), {
    type: 'assignment',
    title: `New ${category} complaint reported`,
    message: `New ${category} complaint ${complaint.complaintId} reported in ${complaintMunicipality || 'your area'}${complaintWard ? ` (${complaintWard})` : ''}.`,
    complaint: complaint._id,
  });

  res.status(201).json({
    complaint,
    duplicates,
    message: duplicates.length
      ? 'Complaint submitted. Similar nearby complaints were found and flagged for review.'
      : 'Complaint submitted successfully.',
  });
});

export const getComplaints = asyncHandler(async (req, res) => {
  const user = req.user;
  const {
    status, category, severity, ward, municipality, department,
    search, page = 1, limit = 20, sort = '-createdAt', mine,
  } = req.query;

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

  const pageNum = Math.max(1, Number(page));
  const limitNum = Math.min(100, Math.max(1, Number(limit)));
  const [items, total] = await Promise.all([
    complaints.list({
      filter,
      sort,
      page: pageNum,
      limit: limitNum,
      populate: [
        { path: 'reporter', select: 'name email' },
        { path: 'assignedTo', select: 'name email role department' },
      ],
    }),
    complaints.count(filter),
  ]);

  res.json({
    complaints: items,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      pages: Math.ceil(total / limitNum) || 1,
    },
  });
});

export const getComplaintById = asyncHandler(async (req, res) => {
  const complaint = await complaints.findById(req.params.id, {
    populate: [
      { path: 'reporter', select: 'name email phone' },
      { path: 'assignedTo', select: 'name email role department municipality ward' },
      { path: 'timeline.by', select: 'name role' },
      { path: 'duplicateCandidates', select: 'complaintId title status category createdAt' },
    ],
  });

  if (!complaint) return res.status(404).json({ message: 'Complaint not found' });

  const user = req.user;
  if (user.role === ROLES.CITIZEN && complaint.reporter._id.toString() !== user._id.toString()) {
    return res.status(403).json({ message: 'You do not have access to this complaint' });
  }
  if (user.role === ROLES.MUNICIPAL) {
    const municipality = user.jurisdiction?.municipality || user.municipality;
    if (municipality && !samePlace(complaint.location.municipality, municipality)) {
      return res.status(403).json({ message: 'Complaint outside your jurisdiction' });
    }
  }
  if (user.role === ROLES.WARD_OFFICER) {
    const municipality = user.jurisdiction?.municipality || user.municipality;
    const ward = user.jurisdiction?.ward || user.ward;
    if (municipality && !samePlace(complaint.location.municipality, municipality)) {
      return res.status(403).json({ message: 'Complaint outside your jurisdiction' });
    }
    if (ward && complaint.location.ward && !samePlace(complaint.location.ward, ward)) {
      return res.status(403).json({ message: 'Complaint outside your ward' });
    }
  }

  res.json({ complaint });
});

function ensureComplaintAccess(user, complaint) {
  if (user.role === ROLES.CITIZEN && complaint.reporter.toString() !== user._id.toString()) {
    return 'You do not have access to this complaint';
  }
  if (user.role === ROLES.MUNICIPAL) {
    const municipality = user.jurisdiction?.municipality || user.municipality;
    if (municipality && !samePlace(complaint.location.municipality, municipality)) return 'Complaint outside your jurisdiction';
  }
  if (user.role === ROLES.WARD_OFFICER) {
    const municipality = user.jurisdiction?.municipality || user.municipality;
    const ward = user.jurisdiction?.ward || user.ward;
    if (municipality && !samePlace(complaint.location.municipality, municipality)) return 'Complaint outside your jurisdiction';
    if (ward && complaint.location.ward && !samePlace(complaint.location.ward, ward)) return 'Complaint outside your ward';
  }
  return null;
}

export const updateComplaintStatus = asyncHandler(async (req, res) => {
  const { status, note, assignedDepartment, assignedTo, deadline, priority, rejectedReason } = req.body;
  if (!status) return res.status(400).json({ message: 'Status is required' });
  if (!Object.values(COMPLAINT_STATUS).includes(status)) return res.status(400).json({ message: 'Invalid status' });

  const complaint = await complaints.findById(req.params.id, { populate: [{ path: 'reporter', select: 'name email' }] });
  if (!complaint) return res.status(404).json({ message: 'Complaint not found' });
  const accessError = ensureComplaintAccess(req.user, complaint);
  if (accessError) return res.status(403).json({ message: accessError });

  if (req.user.role !== ROLES.SUPERIOR && !roleCanSetStatus(req.user.role, status)) {
    return res.status(403).json({ message: 'Your role cannot set this status' });
  }
  if (!canTransition(complaint.status, status)) {
    return res.status(400).json({ message: `Cannot transition from ${complaint.status} to ${status}` });
  }
  if (status === COMPLAINT_STATUS.REJECTED && !(rejectedReason || note)) {
    return res.status(400).json({ message: 'Rejection reason is required' });
  }

  const [complaintLng, complaintLat] = complaint.location?.coordinates || [];
  const proofMeta = parseMediaMeta(req.body.mediaMeta);
  const proofMedia = [];
  let proofIndex = 0;
  for (const file of req.files || []) {
    const meta = proofMeta[proofIndex++] || {};
    proofMedia.push(await storeMediaFile(file, req, {
      ...meta,
      latitude: meta.latitude ?? complaintLat,
      longitude: meta.longitude ?? complaintLng,
      address: meta.address || complaint.location?.address || '',
    }));
  }

  const previousStatus = complaint.status;
  complaint.status = status;
  if (assignedDepartment !== undefined) complaint.assignedDepartment = assignedDepartment;
  if (priority) complaint.priority = priority;
  if (deadline) complaint.deadline = new Date(deadline);
  if (status === COMPLAINT_STATUS.REJECTED) complaint.rejectedReason = rejectedReason || note || '';
  if (status === COMPLAINT_STATUS.RESOLVED) complaint.resolvedAt = new Date();
  if (status === COMPLAINT_STATUS.ESCALATED) {
    complaint.escalatedAt = new Date();
    complaint.escalationLevel = Math.min(2, (complaint.escalationLevel || 0) + 1);
  }
  if (assignedTo) {
    const assignee = await users.findById(assignedTo);
    if (!assignee) return res.status(400).json({ message: 'Assigned user not found' });
    complaint.assignedTo = assignee._id;
    if (!complaint.assignedDepartment && assignee.department) complaint.assignedDepartment = assignee.department;
  }

  complaint.timeline.push({
    status,
    note: note || `Status changed from ${previousStatus} to ${status}`,
    by: req.user._id,
    byName: req.user.name,
    byRole: req.user.role,
    department: complaint.assignedDepartment || '',
    media: proofMedia,
    at: new Date(),
  });
  await complaints.save(complaint);

  const reporterId = complaint.reporter?._id || complaint.reporter;
  await createNotification({
    user: reporterId,
    type: status === COMPLAINT_STATUS.RESOLVED ? 'resolved' : status === COMPLAINT_STATUS.ESCALATED ? 'escalation' : 'status_update',
    title: 'Complaint status updated',
    message: `Your complaint ${complaint.complaintId} status changed to ${status}.`,
    complaint: complaint._id,
  });
  if (complaint.assignedTo && complaint.assignedTo.toString() !== reporterId.toString()) {
    await createNotification({
      user: complaint.assignedTo,
      type: 'status_update',
      title: 'Assigned complaint updated',
      message: `Complaint ${complaint.complaintId} is now ${status}.`,
      complaint: complaint._id,
    });
  }

  const populated = await complaints.findById(complaint._id, {
    populate: [
      { path: 'reporter', select: 'name email phone' },
      { path: 'assignedTo', select: 'name email role department municipality ward' },
      { path: 'timeline.by', select: 'name role' },
    ],
  });
  res.json({ complaint: populated, message: 'Complaint status updated' });
});



export const assignComplaint = asyncHandler(async (req, res) => {
  const { assignedTo, assignedDepartment, deadline, priority, note } = req.body;
  const complaint = await complaints.findById(req.params.id, { populate: [{ path: 'reporter', select: 'name email' }] });
  if (!complaint) return res.status(404).json({ message: 'Complaint not found' });
  const accessError = ensureComplaintAccess(req.user, complaint);
  if (accessError) return res.status(403).json({ message: accessError });
  if (![ROLES.MUNICIPAL, ROLES.WARD_OFFICER, ROLES.SUPERIOR].includes(req.user.role)) {
    return res.status(403).json({ message: 'Not authorized to assign complaints' });
  }

  let assignee = null;
  if (assignedTo) {
    assignee = await users.findById(assignedTo);
    if (!assignee) return res.status(400).json({ message: 'Assigned user not found' });
    complaint.assignedTo = assignee._id;
    if (!assignedDepartment && assignee.department) complaint.assignedDepartment = assignee.department;
  }
  if (assignedDepartment) complaint.assignedDepartment = assignedDepartment;
  if (deadline) complaint.deadline = new Date(deadline);
  if (priority) complaint.priority = priority;

  const prev = complaint.status;
  if ([COMPLAINT_STATUS.SUBMITTED, COMPLAINT_STATUS.UNDER_REVIEW, COMPLAINT_STATUS.VERIFIED, COMPLAINT_STATUS.ESCALATED].includes(complaint.status)) {
    if (canTransition(complaint.status, COMPLAINT_STATUS.ASSIGNED) || complaint.status === COMPLAINT_STATUS.ESCALATED) {
      // Escalated can move to Assigned per STATUS_FLOW
      if (complaint.status !== COMPLAINT_STATUS.ESCALATED) complaint.status = COMPLAINT_STATUS.ASSIGNED;
      else complaint.status = COMPLAINT_STATUS.ASSIGNED;
    }
  }
  // If escalated, STATUS_FLOW allows Escalated -> Assigned
  if (prev === COMPLAINT_STATUS.ESCALATED) complaint.status = COMPLAINT_STATUS.ASSIGNED;
  else if (canTransition(prev, COMPLAINT_STATUS.ASSIGNED)) complaint.status = COMPLAINT_STATUS.ASSIGNED;

  complaint.timeline.push({
    status: complaint.status,
    note: note || `Complaint assigned${complaint.assignedDepartment ? ` to ${complaint.assignedDepartment}` : ''}${assignee ? ` (${assignee.name})` : ''}.`,
    by: req.user._id,
    byName: req.user.name,
    byRole: req.user.role,
    department: complaint.assignedDepartment || '',
    at: new Date(),
  });
  await complaints.save(complaint);

  const reporterId = complaint.reporter?._id || complaint.reporter;
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

  const populated = await complaints.findById(complaint._id, {
    populate: [
      { path: 'reporter', select: 'name email phone' },
      { path: 'assignedTo', select: 'name email role department municipality ward' },
      { path: 'timeline.by', select: 'name role' },
    ],
  });
  res.json({ complaint: populated, message: 'Complaint assigned successfully' });
});

export const escalateComplaint = asyncHandler(async (req, res) => {
  const { note, priority } = req.body;
  const complaint = await complaints.findById(req.params.id, { populate: [{ path: 'reporter', select: 'name email' }] });
  if (!complaint) return res.status(404).json({ message: 'Complaint not found' });
  const accessError = ensureComplaintAccess(req.user, complaint);
  if (accessError) return res.status(403).json({ message: accessError });
  if (![ROLES.MUNICIPAL, ROLES.WARD_OFFICER, ROLES.SUPERIOR].includes(req.user.role)) {
    return res.status(403).json({ message: 'Not authorized to escalate complaints' });
  }
  if (![COMPLAINT_STATUS.ASSIGNED, COMPLAINT_STATUS.IN_PROGRESS, COMPLAINT_STATUS.UNDER_REVIEW, COMPLAINT_STATUS.VERIFIED].includes(complaint.status)) {
    // Allow escalation from active statuses; if already escalated, just bump level
    if (complaint.status !== COMPLAINT_STATUS.ESCALATED) {
      return res.status(400).json({ message: `Complaint cannot be escalated from ${complaint.status}` });
    }
  }

  const prev = complaint.status;
  complaint.status = COMPLAINT_STATUS.ESCALATED;
  complaint.escalatedAt = new Date();
  complaint.escalationLevel = Math.min(2, (complaint.escalationLevel || 0) + 1);
  if (priority) complaint.priority = priority;
  complaint.timeline.push({
    status: COMPLAINT_STATUS.ESCALATED,
    note: note || `Complaint escalated from ${prev}.`,
    by: req.user._id,
    byName: req.user.name,
    byRole: req.user.role,
    department: complaint.assignedDepartment || '',
    at: new Date(),
  });
  await complaints.save(complaint);

  const reporterId = complaint.reporter?._id || complaint.reporter;
  await createNotification({
    user: reporterId,
    type: 'escalation',
    title: 'Complaint escalated',
    message: `Your complaint ${complaint.complaintId} has been escalated for higher-level review.`,
    complaint: complaint._id,
  });

  // notify ward officers/superiors in jurisdiction
  const municipality = complaint.location.municipality;
  const ward = complaint.location.ward;
  const targets = await users.list({
    filter: {
      isActive: true,
      isApproved: true,
      $or: [
        { role: ROLES.WARD_OFFICER, ...(municipality ? { 'jurisdiction.municipality': municipality } : {}) },
        { role: ROLES.SUPERIOR },
      ],
    },
    limit: 500,
  });
  const ids = targets.filter((u) => {
    if (u.role === ROLES.SUPERIOR) return true;
    if (ward && u.jurisdiction?.ward && u.jurisdiction.ward !== ward) return false;
    return true;
  }).map((u) => u._id);
  await notifyUsers(ids, {
    type: 'escalation',
    title: 'Complaint escalated',
    message: `Complaint ${complaint.complaintId} requires higher-level attention.`,
    complaint: complaint._id,
  });

  const populated = await complaints.findById(complaint._id, {
    populate: [
      { path: 'reporter', select: 'name email phone' },
      { path: 'assignedTo', select: 'name email role department municipality ward' },
      { path: 'timeline.by', select: 'name role' },
    ],
  });
  res.json({ complaint: populated, message: 'Complaint escalated' });
});


export const submitFeedback = asyncHandler(async (req, res) => {
  const { rating, comment } = req.body;
  const complaint = await complaints.findById(req.params.id);
  if (!complaint) return res.status(404).json({ message: 'Complaint not found' });
  if (complaint.reporter.toString() !== req.user._id.toString()) {
    return res.status(403).json({ message: 'Only the reporting citizen can submit feedback' });
  }
  if (complaint.status !== COMPLAINT_STATUS.RESOLVED) {
    return res.status(400).json({ message: 'Feedback can only be submitted for resolved complaints' });
  }
  const r = Number(rating);
  if (!Number.isFinite(r) || r < 1 || r > 5) {
    return res.status(400).json({ message: 'Rating must be between 1 and 5' });
  }
  complaint.feedback = { rating: r, comment: comment || '', submittedAt: new Date() };
  complaint.timeline.push({
    status: complaint.status,
    note: `Citizen submitted feedback: ${r}/5${comment ? ` - ${comment}` : ''}`,
    by: req.user._id,
    byName: req.user.name,
    byRole: req.user.role,
    at: new Date(),
  });
  await complaints.save(complaint);

  if (complaint.assignedTo) {
    await createNotification({
      user: complaint.assignedTo,
      type: 'feedback',
      title: 'Complaint feedback received',
      message: `Feedback received for ${complaint.complaintId}: ${r}/5.`,
      complaint: complaint._id,
    });
  }
  res.json({ complaint, message: 'Feedback submitted' });
});

export const reopenComplaint = asyncHandler(async (req, res) => {
  const { reason } = req.body;
  if (!reason || !reason.trim()) return res.status(400).json({ message: 'Reason for reopening is required' });
  const complaint = await complaints.findById(req.params.id, { populate: [{ path: 'reporter', select: 'name email' }] });
  if (!complaint) return res.status(404).json({ message: 'Complaint not found' });
  if (complaint.reporter._id.toString() !== req.user._id.toString()) {
    return res.status(403).json({ message: 'Only the reporting citizen can reopen this complaint' });
  }
  if (complaint.status !== COMPLAINT_STATUS.RESOLVED) {
    return res.status(400).json({ message: 'Only resolved complaints can be reopened' });
  }

  complaint.reopen = { isReopened: true, reason: reason.trim(), reopenedAt: new Date(), verified: false };
  complaint.status = COMPLAINT_STATUS.UNDER_REVIEW;
  complaint.resolvedAt = undefined;
  complaint.timeline.push({
    status: COMPLAINT_STATUS.UNDER_REVIEW,
    note: `Complaint reopened by citizen: ${reason.trim()}`,
    by: req.user._id,
    byName: req.user.name,
    byRole: req.user.role,
    at: new Date(),
  });
  await complaints.save(complaint);

  const municipality = complaint.location.municipality;
  const authorities = await users.list({
    filter: {
      role: { $in: [ROLES.MUNICIPAL, ROLES.WARD_OFFICER] },
      isActive: true,
      isApproved: true,
      ...(municipality ? { 'jurisdiction.municipality': municipality } : {}),
    },
    limit: 500,
  });
  await notifyUsers(authorities.map((a) => a._id), {
    type: 'status_update',
    title: 'Complaint reopened',
    message: `Complaint ${complaint.complaintId} was reopened by the citizen and requires verification.`,
    complaint: complaint._id,
  });

  const populated = await complaints.findById(complaint._id, {
    populate: [
      { path: 'reporter', select: 'name email phone' },
      { path: 'assignedTo', select: 'name email role department municipality ward' },
      { path: 'timeline.by', select: 'name role' },
    ],
  });
  res.json({ complaint: populated, message: 'Complaint reopened and sent for verification' });
});

export const getDashboardStats = asyncHandler(async (req, res) => {
  const dashboard = await complaints.stats(scopedComplaintFilter(req.user));
  res.json(dashboard);
});

export const getComplaintMap = asyncHandler(async (req, res) => {
  const user = req.user;
  const filter = scopedComplaintFilter(user);
  const { status, category, severity } = req.query;
  if (status) filter.status = status;
  if (category) filter.category = category;
  if (severity) filter.severity = severity;
  const items = await complaints.mapList({ filter, limit: 1000 });
  res.json({ complaints: items });
});

const EVIDENCE_PAGE_SIZE = 100;

async function collectScopedComplaints(user, search) {
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
  const docs = [];
  for (let page = 1; page <= 10; page += 1) {
    const batch = await complaints.list({
      filter,
      sort: '-createdAt',
      page,
      limit: EVIDENCE_PAGE_SIZE,
      populate: [{ path: 'reporter', select: 'name email' }],
    });
    docs.push(...batch);
    if (batch.length < EVIDENCE_PAGE_SIZE) break;
  }
  return docs;
}

function mapsUrl(lat, lng) {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

/**
 * Geo-tagged evidence feed. Citizens see every photo/video they captured (saved
 * under their own login); municipal, ward and superior accounts see the evidence
 * delivered to their jurisdiction.
 */
export const getEvidence = asyncHandler(async (req, res) => {
  const { type = 'all', search = '', page = 1, limit = 24 } = req.query;
  const docs = await collectScopedComplaints(req.user, String(search).trim());

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
      group.media.forEach((m, index) => {
        const latitude = m.latitude ?? coords[1] ?? null;
        const longitude = m.longitude ?? coords[0] ?? null;
        items.push({
          id: `${complaint._id}-${group.kind}-${index}-${m.url}`,
          url: m.url,
          mediaType: m.type === 'video' ? 'video' : 'image',
          filename: m.filename || '',
          size: m.size || 0,
          kind: group.kind,
          latitude,
          longitude,
          accuracy: m.accuracy ?? null,
          address: m.address || complaint.location?.address || '',
          capturedAt: m.capturedAt || complaint.createdAt,
          mapsUrl: latitude != null && longitude != null ? mapsUrl(latitude, longitude) : '',
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
    .filter((item) => (type === 'photo' ? item.mediaType === 'image' : type === 'video' ? item.mediaType === 'video' : true))
    .sort((a, b) => new Date(b.capturedAt || 0) - new Date(a.capturedAt || 0));

  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(60, Math.max(1, Number(limit) || 24));
  const start = (pageNum - 1) * limitNum;

  res.json({
    items: filtered.slice(start, start + limitNum),
    summary: {
      total: filtered.length,
      photos: filtered.filter((i) => i.mediaType === 'image').length,
      videos: filtered.filter((i) => i.mediaType === 'video').length,
      geoTagged: filtered.filter((i) => i.latitude != null && i.longitude != null).length,
      complaints: docs.length,
    },
    pagination: {
      total: filtered.length,
      page: pageNum,
      limit: limitNum,
      pages: Math.ceil(filtered.length / limitNum) || 1,
    },
  });
});
