import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

const STATUS_FILLS = {
  Submitted: '#94a3b8', 'Under Review': '#f59e0b', Verified: '#3b82f6', Assigned: '#6366f1',
  'In Progress': '#06b6d4', Resolved: '#10b981', Rejected: '#f43f5e', Escalated: '#f97316',
};

function ChartCard({ title, subtitle, children, className = '' }) {
  return (
    <div className={`card p-5 ${className}`}>
      <div className="mb-4"><h3 className="font-semibold text-navy-800 dark:text-white">{title}</h3>{subtitle && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>}</div>
      {children}
    </div>
  );
}

export function TrendChart({ data = [] }) {
  const { dark } = useTheme();
  const grid = dark ? '#1e3a5f' : '#e2e8f0';
  const axis = dark ? '#94a3b8' : '#64748b';
  return (
    <ChartCard title="Complaint Trend" subtitle="Reported vs resolved over the last 6 months" className="lg:col-span-2">
      {data.length === 0 ? <p className="py-16 text-center text-sm text-slate-500">No trend data yet</p> : (
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <defs>
              <linearGradient id="gTotal" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#1e3a5f" stopOpacity={0.25}/><stop offset="95%" stopColor="#1e3a5f" stopOpacity={0}/></linearGradient>
              <linearGradient id="gRes" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#05c8a5" stopOpacity={0.3}/><stop offset="95%" stopColor="#05c8a5" stopOpacity={0}/></linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 12, fill: axis }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 12, fill: axis }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip contentStyle={{ borderRadius: 12, border: 'none', fontSize: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }} />
            <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
            <Area type="monotone" dataKey="total" name="Reported" stroke="#1e3a5f" strokeWidth={2} fill="url(#gTotal)" />
            <Area type="monotone" dataKey="resolved" name="Resolved" stroke="#05c8a5" strokeWidth={2} fill="url(#gRes)" />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

export function StatusPie({ data = [] }) {
  return (
    <ChartCard title="Status Distribution" subtitle="Current complaint pipeline">
      {data.length === 0 ? <p className="py-16 text-center text-sm text-slate-500">No data</p> : (
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie data={data} dataKey="count" nameKey="status" innerRadius={58} outerRadius={92} paddingAngle={3}>
              {data.map((d) => <Cell key={d.status} fill={STATUS_FILLS[d.status] || '#94a3b8'} />)}
            </Pie>
            <Tooltip contentStyle={{ borderRadius: 12, border: 'none', fontSize: 12 }} />
            <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

export function CategoryChart({ data = [] }) {
  const { dark } = useTheme();
  const axis = dark ? '#94a3b8' : '#64748b';
  const grid = dark ? '#1e3a5f' : '#e2e8f0';
  const short = data.slice(0, 6).map(d => ({ ...d, name: d.category.length > 16 ? d.category.slice(0, 15) + '…' : d.category }));
  return (
    <ChartCard title="Complaints by Category" subtitle="Top issue types">
      {short.length === 0 ? <p className="py-16 text-center text-sm text-slate-500">No data</p> : (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={short} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: axis }} axisLine={false} tickLine={false} interval={0} angle={-15} textAnchor="end" height={50}/>
            <YAxis tick={{ fontSize: 11, fill: axis }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip contentStyle={{ borderRadius: 12, border: 'none', fontSize: 12 }} />
            <Bar dataKey="count" name="Complaints" fill="#05c8a5" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

export function DepartmentPerformance({ data = [] }) {
  return (
    <ChartCard title="Department Performance" subtitle="Assigned vs resolved">
      {data.length === 0 ? <p className="py-10 text-center text-sm text-slate-500">No department data</p> : (
        <div className="space-y-4">
          {data.map(d => {
            const pct = d.total ? Math.round((d.resolved / d.total) * 100) : 0;
            return (
              <div key={d.department}>
                <div className="flex items-center justify-between text-sm mb-1.5">
                  <span className="text-slate-700 dark:text-slate-300 font-medium">{d.department}</span>
                  <span className="text-slate-500 dark:text-slate-400 text-xs">{d.resolved}/{d.total} · {pct}%</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 dark:bg-navy-800 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-tealbrand-500 to-tealbrand-600 transition-all" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </ChartCard>
  );
}

export function WardTable({ data = [] }) {
  return (
    <ChartCard title="Ward-wise Overview" subtitle="Volume and resolution by ward">
      {data.length === 0 ? <p className="py-10 text-center text-sm text-slate-500">No ward data</p> : (
        <div className="overflow-x-auto -mx-2">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase text-slate-500 border-b border-slate-200 dark:border-navy-700">
              <th className="py-2 px-2 font-medium">Ward</th><th className="py-2 px-2 font-medium">Total</th><th className="py-2 px-2 font-medium">Pending</th><th className="py-2 px-2 font-medium">Resolved</th><th className="py-2 px-2 font-medium">Rate</th>
            </tr></thead>
            <tbody>
              {data.map(w => (
                <tr key={w.ward} className="border-b border-slate-100 dark:border-navy-800 last:border-0">
                  <td className="py-2.5 px-2 font-medium text-navy-800 dark:text-white">{w.ward}</td>
                  <td className="py-2.5 px-2 text-slate-600 dark:text-slate-300">{w.total}</td>
                  <td className="py-2.5 px-2 text-amber-600">{w.pending}</td>
                  <td className="py-2.5 px-2 text-emerald-600">{w.resolved}</td>
                  <td className="py-2.5 px-2"><span className="badge bg-slate-100 text-slate-700 dark:bg-navy-800 dark:text-slate-300">{w.total ? Math.round((w.resolved/w.total)*100) : 0}%</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ChartCard>
  );
}

export function CategoryGrid({ data = [], title = 'Complaints by category', subtitle }) {
  const total = data.reduce((sum, item) => sum + (item.count || 0), 0);
  return (
    <div className="card p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-navy-800 dark:text-white">{title}</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {subtitle || 'Citizen complaints routed to your desk — pick a category to review it'}
          </p>
        </div>
        <Link to="/complaints" className="whitespace-nowrap text-xs font-medium text-tealbrand-700 hover:underline dark:text-tealbrand-400">
          All {total > 0 ? `${total} ` : ''}complaints
        </Link>
      </div>
      {data.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">No complaints in your jurisdiction yet</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-2.5">
          {data.map((item) => (
            <Link
              key={item.category}
              to={`/complaints?category=${encodeURIComponent(item.category)}`}
              className="group rounded-xl border border-slate-200 dark:border-navy-700 p-3 transition hover:border-tealbrand-400 hover:bg-tealbrand-50/40 dark:hover:bg-tealbrand-900/10"
            >
              <div className="flex items-start justify-between gap-1">
                <span className="text-xl font-bold text-navy-800 dark:text-white">{item.count}</span>
                <ArrowUpRight size={14} className="mt-1 text-slate-400 transition group-hover:text-tealbrand-600" />
              </div>
              <p className="mt-1 text-xs font-medium text-slate-600 dark:text-slate-300 line-clamp-2">{item.category}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export { ChartCard };
