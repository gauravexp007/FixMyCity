export const ROLES = {
  CITIZEN: 'citizen',
  MUNICIPAL: 'municipal',
  WARD_OFFICER: 'ward_officer',
  SUPERIOR: 'superior',
};

export const COMPLAINT_STATUS = {
  SUBMITTED: 'Submitted',
  UNDER_REVIEW: 'Under Review',
  VERIFIED: 'Verified',
  ASSIGNED: 'Assigned',
  IN_PROGRESS: 'In Progress',
  RESOLVED: 'Resolved',
  REJECTED: 'Rejected',
  ESCALATED: 'Escalated',
};

export const COMPLAINT_CATEGORIES = [
  'Pothole',
  'Damaged Road',
  'Garbage Accumulation',
  'Water Leakage',
  'Drainage Problem',
  'Broken Streetlight',
  'Sewage Overflow',
  'Public Property Damage',
  'Illegal Dumping',
  'Other',
];

export const SEVERITY_LEVELS = ['Low', 'Medium', 'High', 'Critical'];

export const DEPARTMENTS = [
  'Roads & Infrastructure',
  'Sanitation',
  'Water Supply',
  'Drainage & Sewage',
  'Electrical',
  'Public Works',
  'General Administration',
];

export const STATUS_FLOW = {
  [COMPLAINT_STATUS.SUBMITTED]: [COMPLAINT_STATUS.UNDER_REVIEW, COMPLAINT_STATUS.REJECTED],
  [COMPLAINT_STATUS.UNDER_REVIEW]: [COMPLAINT_STATUS.VERIFIED, COMPLAINT_STATUS.REJECTED],
  [COMPLAINT_STATUS.VERIFIED]: [COMPLAINT_STATUS.ASSIGNED, COMPLAINT_STATUS.REJECTED],
  [COMPLAINT_STATUS.ASSIGNED]: [COMPLAINT_STATUS.IN_PROGRESS, COMPLAINT_STATUS.ESCALATED],
  [COMPLAINT_STATUS.IN_PROGRESS]: [COMPLAINT_STATUS.RESOLVED, COMPLAINT_STATUS.ESCALATED],
  [COMPLAINT_STATUS.RESOLVED]: [],
  [COMPLAINT_STATUS.REJECTED]: [],
  [COMPLAINT_STATUS.ESCALATED]: [COMPLAINT_STATUS.ASSIGNED, COMPLAINT_STATUS.IN_PROGRESS, COMPLAINT_STATUS.RESOLVED, COMPLAINT_STATUS.REJECTED],
};
