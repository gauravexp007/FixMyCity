import { STATUS_COLORS } from '../../utils/constants';
export default function StatusBadge({ status }) {
  return <span className={`badge ${STATUS_COLORS[status] || 'bg-slate-100 text-slate-700'}`}>{status}</span>;
}
