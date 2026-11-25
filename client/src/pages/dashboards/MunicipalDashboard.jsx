import { Link } from 'react-router-dom';
import { ListChecks, Clock, Wrench, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useDashboard } from '../../hooks/useDashboard';
import StatCard from '../../components/ui/StatCard';
import { PageSkeleton } from '../../components/ui/Skeleton';
import RecentComplaints from '../../components/dashboard/RecentComplaints';
import PriorityAlerts from '../../components/dashboard/PriorityAlerts';
import { TrendChart, StatusPie, DepartmentPerformance, CategoryGrid } from '../../components/dashboard/Charts';

export default function MunicipalDashboard() {
  const { user } = useAuth();
  const { data, loading } = useDashboard();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-tealbrand-600">Municipal Authority</p>
          <h1 className="text-2xl font-bold text-navy-900 dark:text-white mt-1">{user?.jurisdiction?.municipality || user?.municipality || 'Municipality'} Operations</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Review, verify, assign and resolve complaints within your jurisdiction.</p>
        </div>
        <Link to="/complaints" className="btn-primary whitespace-nowrap">Manage complaints <ArrowRight size={16}/></Link>
      </div>

      {loading ? <PageSkeleton /> : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard icon={ListChecks} label="Total Complaints" value={data?.stats.total} sub="In jurisdiction" />
            <StatCard icon={Clock} label="Pending Review" value={data?.stats.pending} sub="Needs verification" color="bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-300" />
            <StatCard icon={Wrench} label="In Progress" value={data?.stats.inProgress} sub="Assigned & active" color="bg-cyan-50 text-cyan-600 dark:bg-cyan-900/20 dark:text-cyan-300" />
            <StatCard icon={CheckCircle2} label="Resolved" value={data?.stats.resolved} sub={`Avg ${data?.stats.avgResolutionHours || 0}h`} color="bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-300" />
          </div>

          {data?.stats.overdue > 0 && (
            <div className="card p-4 border-orange-200 dark:border-orange-900/50 bg-orange-50/60 dark:bg-orange-950/20 flex items-center gap-3">
              <AlertTriangle className="text-orange-600" size={20}/>
              <p className="text-sm text-orange-800 dark:text-orange-300"><strong>{data.stats.overdue}</strong> complaint(s) have passed their resolution deadline and need escalation review.</p>
              <Link to="/complaints" className="ml-auto text-sm font-semibold text-orange-700 dark:text-orange-300 hover:underline whitespace-nowrap">Review</Link>
            </div>
          )}

          <div className="grid lg:grid-cols-3 gap-4">
            <TrendChart data={data?.trend || []} />
            <StatusPie data={data?.byStatus || []} />
          </div>

          <CategoryGrid
            data={data?.byCategory || []}
            title="Citizen complaints by category"
            subtitle="Every complaint routed to this municipality, grouped by issue type — pick a category to open the filtered list"
          />

          <div className="grid lg:grid-cols-3 gap-4">
            <RecentComplaints items={data?.recent || []} title="Recently Reported" subtitle="Newest complaints in your area" />
            <PriorityAlerts items={data?.recent || []} />
            <DepartmentPerformance data={data?.byDepartment || []} />
          </div>
        </>
      )}
    </div>
  );
}
