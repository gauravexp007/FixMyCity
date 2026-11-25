import { counters } from '../data/index.js';

export async function generateComplaintId() {
  const year = new Date().getFullYear();
  const seq = await counters.next(`complaint-${year}`);
  return `CT-${year}-${String(seq).padStart(6, '0')}`;
}
