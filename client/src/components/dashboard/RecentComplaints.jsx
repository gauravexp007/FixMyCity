import { Link } from 'react-router-dom';
import { ArrowUpRight, Inbox } from 'lucide-react';
import StatusBadge from '../ui/StatusBadge';
import { timeAgo } from '../../utils/helpers';

export default function RecentComplaints({ items = [], title = 'Recent Complaints', subtitle }) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <div><h3 className="font-semibold text-navy-800 dark:text-white">{title}</h3>{subtitle && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>}</div>
        <Link to="/complaints" className="text-xs font-medium text-tealbrand-700 dark:text-tealbrand-400 hover:underline flex items-center gap-1">View all <ArrowUpRight size={14}/></Link>
      </div>
      {items.length === 0 ? (
        <div className="py-10 text-center text-sm text-slate-500"><Inbox size={24} className="mx-auto mb-2 opacity-50"/>No complaints yet</div>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-navy-800">
          {items.map(c => (
            <Link key={c._id} to={`/complaints/${c._id}`} className="flex items-start justify-between gap-3 py-3 hover:bg-slate-50 dark:hover:bg-navy-800/50 -mx-2 px-2 rounded-lg transition">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-mono text-slate-400">{c.complaintId}</span>
                  {c.isSeed && <span className="badge bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">Sample</span>}
                </div>
                <p className="text-sm font-medium text-navy-800 dark:text-white truncate">{c.title}</p>
                <p className="text-xs text-slate-500 mt-0.5">{c.category} · {c.location?.ward || c.location?.municipality || '—'} · {timeAgo(c.createdAt)}</p>
              </div>
              <StatusBadge status={c.status} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
