export const ROLES = { CITIZEN: 'citizen', MUNICIPAL: 'municipal', WARD_OFFICER: 'ward_officer', SUPERIOR: 'superior' };
export const ROLE_LABELS = { citizen: 'Citizen', municipal: 'Municipal Authority', ward_officer: 'Ward Officer', superior: 'Government Superior' };
export const STATUS = {
  SUBMITTED: 'Submitted', UNDER_REVIEW: 'Under Review', VERIFIED: 'Verified', ASSIGNED: 'Assigned',
  IN_PROGRESS: 'In Progress', RESOLVED: 'Resolved', REJECTED: 'Rejected', ESCALATED: 'Escalated',
};
export const STATUS_COLORS = {
  Submitted: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
  'Under Review': 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  Verified: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  Assigned: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  'In Progress': 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300',
  Resolved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  Rejected: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  Escalated: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
};
export const SEVERITY_COLORS = {
  Low: 'bg-emerald-100 text-emerald-700', Medium: 'bg-amber-100 text-amber-700', High: 'bg-orange-100 text-orange-700', Critical: 'bg-rose-100 text-rose-700',
};
export const CATEGORIES = ['Pothole','Damaged Road','Garbage Accumulation','Water Leakage','Drainage Problem','Broken Streetlight','Sewage Overflow','Public Property Damage','Illegal Dumping','Other'];
export const SEVERITIES = ['Low','Medium','High','Critical'];
export const DEPARTMENTS = ['Roads & Infrastructure','Sanitation','Water Supply','Drainage & Sewage','Electrical','Public Works','General Administration'];
export const PRIORITIES = ['Normal','High','Urgent'];
