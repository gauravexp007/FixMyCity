import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Layers, Loader2, ListFilter } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import LocationMap from '../components/map/LocationMap';
import StatusBadge from '../components/ui/StatusBadge';
import EmptyState from '../components/ui/EmptyState';
import { CATEGORIES, STATUS } from '../utils/constants';
import { fmtDate } from '../utils/helpers';

const STATUS_HEX = { Submitted: '#94a3b8', 'Under Review': '#f59e0b', Verified: '#3b82f6', Assigned: '#6366f1', 'In Progress': '#06b6d4', Resolved: '#10b981', Rejected: '#f43f5e', Escalated: '#f97316' };

export default function ComplaintMapPage() {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    api.get('/complaints/map')
      .then(({ data }) => setComplaints(data.complaints))
      .catch(err => toast.error(err.response?.data?.message || 'Could not load complaint map'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => complaints.filter(c =>
    (!status || c.status === status) && (!category || c.category === category)
  ), [complaints, status, category]);

  const center = useMemo(() => {
    const first = filtered.find(c => c.location?.coordinates?.length === 2);
    return first ? [first.location.coordinates[1], first.location.coordinates[0]] : [12.9716, 77.5946];
  }, [filtered]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy-900 dark:text-white">Complaint map</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Geographic view of civic issues in your jurisdiction. Select a marker for details.</p>
        </div>
        <div className="text-sm text-slate-500">{filtered.length} of {complaints.length} complaints shown</div>
      </div>

      <div className="card p-4 flex flex-col sm:flex-row gap-3">
        <div className="flex items-center gap-2 text-sm text-slate-500"><ListFilter size={16} /> Filters</div>
        <select className="input sm:max-w-[200px]" value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {Object.values(STATUS).map(s => <option key={s}>{s}</option>)}
        </select>
        <select className="input sm:max-w-[220px]" value={category} onChange={e => setCategory(e.target.value)}>
          <option value="">All categories</option>
          {CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </select>
        <div className="flex flex-wrap items-center gap-3 sm:ml-auto">
          {Object.entries(STATUS_HEX).map(([s, hex]) => (
            <span key={s} className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: hex }} /> {s}
            </span>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {loading ? (
            <div className="card h-[520px] flex items-center justify-center text-slate-400"><Loader2 className="animate-spin" size={24} /></div>
          ) : (
            <LocationMap complaints={filtered} center={center} zoom={12} height={520} onSelect={setSelected} />
          )}
        </div>
        <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
          {selected && (
            <div className="card p-4 border-tealbrand-300 dark:border-tealbrand-700">
              <p className="font-mono text-[11px] text-slate-500">{selected.complaintId}</p>
              <h3 className="font-semibold text-navy-800 dark:text-white text-sm mt-0.5">{selected.title}</h3>
              <div className="mt-2"><StatusBadge status={selected.status} /></div>
              <Link to={`/complaints/${selected._id}`} className="btn-primary w-full mt-3 py-2 text-sm">Open complaint</Link>
            </div>
          )}
          {!loading && filtered.length === 0 && <EmptyState icon={MapPin} title="No mapped complaints" description="No complaints match the selected filters." />}
          {filtered.map(c => (
            <button key={c._id} onClick={() => setSelected(c)}
              className={`card w-full text-left p-4 hover:border-tealbrand-300 dark:hover:border-tealbrand-700 transition ${selected?._id === c._id ? 'ring-2 ring-tealbrand-400' : ''}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[11px] text-slate-500">{c.complaintId}</span>
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: STATUS_HEX[c.status] || '#94a3b8' }} />
              </div>
              <p className="mt-1 text-sm font-semibold text-navy-800 dark:text-white truncate">{c.title}</p>
              <p className="mt-1 text-xs text-slate-500 flex items-center gap-1 truncate"><MapPin size={12} /> {c.location?.address || c.location?.ward || 'Location recorded'}</p>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-[11px] text-slate-500">{c.category}</span>
                <span className="text-[11px] text-slate-400">{fmtDate(c.createdAt)}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
