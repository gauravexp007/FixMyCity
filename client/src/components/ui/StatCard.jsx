export default function StatCard({ icon: Icon, label, value, sub, color = 'bg-tealbrand-50 text-tealbrand-700 dark:bg-tealbrand-900/20 dark:text-tealbrand-300' }) {
  return (
    <div className="card p-5 hover:shadow-card-hover transition-shadow">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
          <p className="mt-2 text-3xl font-bold text-navy-800 dark:text-white">{value ?? '—'}</p>
          {sub && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{sub}</p>}
        </div>
        {Icon && <div className={`rounded-xl p-3 ${color}`}><Icon size={22} /></div>}
      </div>
    </div>
  );
}
