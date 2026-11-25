import { Link } from 'react-router-dom';
import { ListChecks, Clock, CheckCircle2, AlertTriangle, ArrowUpCircle, ArrowRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useDashboard } from '../../hooks/useDashboard';
import StatCard from '../../components/ui/StatCard';
import { PageSkeleton } from '../../components/ui/Skeleton';
import RecentComplaints from '../../components/dashboard/RecentComplaints';
import { TrendChart, WardTable, DepartmentPerformance, CategoryGrid } from '../../components/dashboard/Charts';

export default function WardDashboard() {
  const { user } = useAuth();
  const { data, loading } = useDashboard();
  const ward = user?.jurisdiction?.ward || user?.ward || 'Ward';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-tealbrand-600">Ward Management</p>
          <h1 className="text-2xl font-bold text-navy-900 dark:text-white mt-1">{ward} Monitoring Dashboard</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Track department performance, overdue complaints and escalation within your ward.</p>
        </div>
        <Link to="/complaints" className="btn-primary whitespace-nowrap">Review complaints <ArrowRight size={16}/></Link>
      </div>

      {loading ? <PageSkeleton /> : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard icon={ListChecks} label="Ward Complaints" value={data?.stats.total} sub={ward} />
            <StatCard icon={Clock} label="Pending" value={data?.stats.pending} sub="Open items" color="bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-300" />
            <StatCard icon={AlertTriangle} label="Overdue" value={data?.stats.overdue} sub="Past deadline" color="bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-300" />
            <StatCard icon={ArrowUpCircle} label="Escalated" value={data?.stats.escalated} sub="Need higher review" color="bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-300" />
          </div>

          <div className="grid lg:grid-cols-3 gap-4">
            <TrendChart data={data?.trend || []} />
            <div className="card p-5 flex flex-col justify-center">
              <p className="text-sm text-slate-500 dark:text-slate-400">Resolution rate</p>
              <p className="text-4xl font-extrabold text-tealbrand-600 mt-1">{data?.stats.total ? Math.round((data.stats.resolved / data.stats.total) * 100) : 0}%</p>
              <p className="text-sm text-slate-500 mt-2">{data?.stats.resolved} of {data?.stats.total} resolved</p>
              <div className="mt-4 h-2 rounded-full bg-slate-100 dark:bg-navy-800 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-tealbrand-400 to-tealbrand-600" style={{ width: `${data?.stats.total ? (data.stats.resolved / data.stats.total) * 100 : 0}%` }} />
              </div>
              <p className="mt-4 text-xs text-slate-500">Average resolution: {data?.stats.avgResolutionHours || 0} hours</p>
            </div>
          </div>

          <CategoryGrid
            data={data?.byCategory || []}
            title={`${ward} complaints by category`}
            subtitle="Citizen complaints routed to this ward, grouped by issue type — pick a category to open the filtered list"
          />

          <div className="grid lg:grid-cols-3 gap-4">
            <RecentComplaints items={data?.recent || []} title="Ward Complaints" subtitle="Most recent reports" />
            <DepartmentPerformance data={data?.byDepartment || []} />
            <WardTable data={data?.byWard || []} />
          </div>
        </>
      )}
    </div>
  );
}
