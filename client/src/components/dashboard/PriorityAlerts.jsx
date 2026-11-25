import { Link } from 'react-router-dom';
import { AlertTriangle, Clock, Flame } from 'lucide-react';

export default function PriorityAlerts({ items = [] }) {
  const urgent = items.filter(c => c.priority === 'Urgent' || c.priority === 'High' || c.status === 'Escalated' || c.severity === 'Critical').slice(0, 5);
  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-4"><Flame size={18} className="text-orange-500"/><h3 className="font-semibold text-navy-800 dark:text-white">Priority Alerts</h3></div>
      {urgent.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">No priority alerts</p> : (
        <div className="space-y-3">
          {urgent.map(c => (
            <Link key={c._id} to={`/complaints/${c._id}`} className="flex items-start gap-3 rounded-xl border border-orange-200/70 dark:border-orange-900/40 bg-orange-50/60 dark:bg-orange-950/20 p-3 hover:bg-orange-50 dark:hover:bg-orange-950/30 transition">
              <AlertTriangle size={16} className="text-orange-600 shrink-0 mt-0.5"/>
              <div className="min-w-0">
                <p className="text-sm font-medium text-navy-800 dark:text-white truncate">{c.title}</p>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{c.priority} priority · {c.severity} severity · {c.status}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
