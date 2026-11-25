import { Link } from 'react-router-dom';
import { ListChecks, Clock, CheckCircle2, ArrowUpCircle, Users, Timer, ArrowRight } from 'lucide-react';
import { useDashboard } from '../../hooks/useDashboard';
import StatCard from '../../components/ui/StatCard';
import { PageSkeleton } from '../../components/ui/Skeleton';
import RecentComplaints from '../../components/dashboard/RecentComplaints';
import PriorityAlerts from '../../components/dashboard/PriorityAlerts';
import { TrendChart, StatusPie, CategoryChart, DepartmentPerformance, WardTable } from '../../components/dashboard/Charts';

export default function GovernmentDashboard() {
  const { data, loading } = useDashboard();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-tealbrand-600">Government Administration</p>
          <h1 className="text-2xl font-bold text-navy-900 dark:text-white mt-1">City-wide Overview</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Monitor all municipalities, wards, departments and escalated complaints.</p>
        </div>
        <div className="flex gap-2">
          <Link to="/dashboard/government/authorities" className="btn-secondary whitespace-nowrap"><Users size={16}/> Manage authorities</Link>
          <Link to="/complaints" className="btn-primary whitespace-nowrap">All complaints <ArrowRight size={16}/></Link>
        </div>
      </div>

      {loading ? <PageSkeleton /> : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard icon={ListChecks} label="Total Complaints" value={data?.stats.total} sub="City-wide" />
            <StatCard icon={Clock} label="Pending" value={data?.stats.pending} sub="Awaiting resolution" color="bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-300" />
            <StatCard icon={CheckCircle2} label="Resolved" value={data?.stats.resolved} sub="Closed successfully" color="bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-300" />
            <StatCard icon={ArrowUpCircle} label="Escalated" value={data?.stats.escalated} sub="Higher-level review" color="bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-300" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="card p-5 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-navy-50 dark:bg-navy-800 text-navy-700 dark:text-tealbrand-400 flex items-center justify-center"><Timer size={22}/></div>
              <div><p className="text-sm text-slate-500">Avg. Resolution Time</p><p className="text-2xl font-bold text-navy-800 dark:text-white">{data?.stats.avgResolutionHours || 0} hrs</p></div>
            </div>
            <div className="card p-5 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-300 flex items-center justify-center"><Clock size={22}/></div>
              <div><p className="text-sm text-slate-500">Overdue Complaints</p><p className="text-2xl font-bold text-navy-800 dark:text-white">{data?.stats.overdue}</p></div>
            </div>
            <div className="card p-5 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-tealbrand-50 dark:bg-tealbrand-900/20 text-tealbrand-700 dark:text-tealbrand-300 flex items-center justify-center"><CheckCircle2 size={22}/></div>
              <div><p className="text-sm text-slate-500">Resolution Rate</p><p className="text-2xl font-bold text-navy-800 dark:text-white">{data?.stats.total ? Math.round((data.stats.resolved/data.stats.total)*100) : 0}%</p></div>
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-4">
            <TrendChart data={data?.trend || []} />
            <StatusPie data={data?.byStatus || []} />
          </div>

          <div className="grid lg:grid-cols-3 gap-4">
            <CategoryChart data={data?.byCategory || []} />
            <DepartmentPerformance data={data?.byDepartment || []} />
            <WardTable data={data?.byWard || []} />
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <RecentComplaints items={data?.recent || []} title="Recent City-wide Complaints" subtitle="Latest reports across all jurisdictions" />
            <PriorityAlerts items={data?.recent || []} />
          </div>
        </>
      )}
    </div>
  );
}
