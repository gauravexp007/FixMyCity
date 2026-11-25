import dotenv from 'dotenv';
import { initData, closeData, users, complaints, clearSeedData } from '../data/index.js';
import { ROLES, COMPLAINT_STATUS } from './constants.js';
import { generateComplaintId } from './generateComplaintId.js';
import { pathToFileURL } from 'url';

dotenv.config();

const seedEmails = [
  'admin@civictrack.gov',
  'municipal.central@civictrack.gov',
  'ward5.officer@civictrack.gov',
  'citizen.demo@civictrack.gov',
];

export async function seedDatabase({ disconnect = true, connect = true } = {}) {
  if (connect) await initData();
  console.log('Seeding CivicTrack development data...');

  await clearSeedData(seedEmails);

  const password = 'Password123!';

  const superior = await users.create({
    name: 'System Administrator',
    email: 'admin@civictrack.gov',
    password,
    role: ROLES.SUPERIOR,
    phone: '9000000001',
    municipality: 'Central City',
    jurisdiction: { municipality: 'Central City', ward: '' },
    isApproved: true,
  });

  const municipal = await users.create({
    name: 'Central Municipal Officer',
    email: 'municipal.central@civictrack.gov',
    password,
    role: ROLES.MUNICIPAL,
    department: 'General Administration',
    phone: '9000000002',
    municipality: 'Central City',
    jurisdiction: { municipality: 'Central City', ward: '' },
    isApproved: true,
  });

  const ward = await users.create({
    name: 'Ward 5 Officer',
    email: 'ward5.officer@civictrack.gov',
    password,
    role: ROLES.WARD_OFFICER,
    department: 'Public Works',
    phone: '9000000003',
    municipality: 'Central City',
    ward: 'Ward 5',
    jurisdiction: { municipality: 'Central City', ward: 'Ward 5' },
    isApproved: true,
  });

  const citizen = await users.create({
    name: 'Demo Citizen',
    email: 'citizen.demo@civictrack.gov',
    password,
    role: ROLES.CITIZEN,
    phone: '9000000004',
    municipality: 'Central City',
    ward: 'Ward 5',
    jurisdiction: { municipality: 'Central City', ward: 'Ward 5' },
    isApproved: true,
  });

  // Keeps the seeding deterministic while proving escalation targets exist.
  void superior;

  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const samples = [
    {
      title: '[Sample] Large pothole near Main Street',
      description: 'Sample development record: A deep pothole is causing traffic slowdown and risk for two-wheelers near Main Street junction.',
      category: 'Pothole',
      severity: 'High',
      status: COMPLAINT_STATUS.IN_PROGRESS,
      location: { type: 'Point', coordinates: [77.5946, 12.9716], address: 'Main Street Junction', landmark: 'Near City Bank', municipality: 'Central City', ward: 'Ward 5' },
      assignedTo: municipal._id,
      assignedDepartment: 'Roads & Infrastructure',
      priority: 'High',
      deadline: new Date(now + 2 * day),
      escalationLevel: 0,
    },
    {
      title: '[Sample] Garbage accumulation at market road',
      description: 'Sample development record: Garbage has not been collected for three days near the market road, causing odor and hygiene concerns.',
      category: 'Garbage Accumulation',
      severity: 'Medium',
      status: COMPLAINT_STATUS.ASSIGNED,
      location: { type: 'Point', coordinates: [77.596, 12.975], address: 'Market Road', landmark: 'Opposite Central Market', municipality: 'Central City', ward: 'Ward 5' },
      assignedTo: municipal._id,
      assignedDepartment: 'Sanitation',
      priority: 'Normal',
      deadline: new Date(now + 3 * day),
    },
    {
      title: '[Sample] Broken streetlight on Lake View Road',
      description: 'Sample development record: Streetlight has been non-functional for a week, making the area unsafe at night.',
      category: 'Broken Streetlight',
      severity: 'Medium',
      status: COMPLAINT_STATUS.RESOLVED,
      location: { type: 'Point', coordinates: [77.59, 12.968], address: 'Lake View Road', landmark: 'Near Park Gate', municipality: 'Central City', ward: 'Ward 5' },
      assignedTo: municipal._id,
      assignedDepartment: 'Electrical',
      priority: 'Normal',
      resolvedAt: new Date(now - 1 * day),
      feedback: { rating: 4, comment: 'Resolved quickly after assignment.', submittedAt: new Date(now - 12 * 60 * 60 * 1000) },
    },
    {
      title: '[Sample] Water leakage near residential block',
      description: 'Sample development record: Continuous water leakage from main pipeline causing water wastage.',
      category: 'Water Leakage',
      severity: 'Critical',
      status: COMPLAINT_STATUS.ESCALATED,
      location: { type: 'Point', coordinates: [77.6, 12.973], address: 'Residential Block C', landmark: 'Behind Community Hall', municipality: 'Central City', ward: 'Ward 5' },
      assignedTo: ward._id,
      assignedDepartment: 'Water Supply',
      priority: 'Urgent',
      escalationLevel: 1,
      escalatedAt: new Date(now - 6 * 60 * 60 * 1000),
    },
    {
      title: '[Sample] Drainage overflow after rain',
      description: 'Sample development record: Drainage overflow during rain causing waterlogging on the service road.',
      category: 'Drainage Problem',
      severity: 'High',
      status: COMPLAINT_STATUS.SUBMITTED,
      location: { type: 'Point', coordinates: [77.592, 12.969], address: 'Service Road', landmark: 'Near School', municipality: 'Central City', ward: 'Ward 5' },
      priority: 'High',
    },
  ];

  for (const sample of samples) {
    const complaintId = await generateComplaintId();
    const timeline = [
      { status: COMPLAINT_STATUS.SUBMITTED, note: 'Sample complaint submitted for development/demo.', by: citizen._id, byName: citizen.name, byRole: citizen.role, at: new Date(now - 4 * day) },
    ];
    if ([COMPLAINT_STATUS.ASSIGNED, COMPLAINT_STATUS.IN_PROGRESS, COMPLAINT_STATUS.RESOLVED, COMPLAINT_STATUS.ESCALATED].includes(sample.status)) {
      timeline.push({ status: COMPLAINT_STATUS.UNDER_REVIEW, note: 'Sample: Reviewed by municipal authority.', by: municipal._id, byName: municipal.name, byRole: municipal.role, at: new Date(now - 3 * day) });
      timeline.push({ status: COMPLAINT_STATUS.VERIFIED, note: 'Sample: Verified on site.', by: municipal._id, byName: municipal.name, byRole: municipal.role, at: new Date(now - 3 * day + 2 * 60 * 60 * 1000) });
      timeline.push({ status: COMPLAINT_STATUS.ASSIGNED, note: `Sample: Assigned to ${sample.assignedDepartment}.`, by: municipal._id, byName: municipal.name, byRole: municipal.role, department: sample.assignedDepartment, at: new Date(now - 2 * day) });
    }
    if ([COMPLAINT_STATUS.IN_PROGRESS, COMPLAINT_STATUS.RESOLVED].includes(sample.status)) {
      timeline.push({ status: COMPLAINT_STATUS.IN_PROGRESS, note: 'Sample: Work in progress.', by: municipal._id, byName: municipal.name, byRole: municipal.role, department: sample.assignedDepartment, at: new Date(now - 1 * day) });
    }
    if (sample.status === COMPLAINT_STATUS.RESOLVED) {
      timeline.push({ status: COMPLAINT_STATUS.RESOLVED, note: 'Sample: Issue resolved.', by: municipal._id, byName: municipal.name, byRole: municipal.role, department: sample.assignedDepartment, at: new Date(now - 20 * 60 * 60 * 1000) });
    }
    if (sample.status === COMPLAINT_STATUS.ESCALATED) {
      timeline.push({ status: COMPLAINT_STATUS.ESCALATED, note: 'Sample: Escalated due to urgency.', by: municipal._id, byName: municipal.name, byRole: municipal.role, at: new Date(now - 6 * 60 * 60 * 1000) });
    }

    await complaints.create({
      ...sample,
      complaintId,
      reporter: citizen._id,
      isSeed: true,
      createdAt: timeline[0].at,
      timeline,
    });
  }

  console.log('Seed complete.');
  console.log('Demo accounts:');
  console.log('  Superior:   admin@civictrack.gov / Password123!');
  console.log('  Municipal:  municipal.central@civictrack.gov / Password123!');
  console.log('  Ward:       ward5.officer@civictrack.gov / Password123!');
  console.log('  Citizen:    citizen.demo@civictrack.gov / Password123!');
  if (disconnect) await closeData();
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  seedDatabase().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
