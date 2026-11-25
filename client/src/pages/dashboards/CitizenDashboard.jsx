import { Link } from 'react-router-dom';
import { FilePlus2, ListChecks, Clock, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useDashboard } from '../../hooks/useDashboard';
import StatCard from '../../components/ui/StatCard';
import { PageSkeleton } from '../../components/ui/Skeleton';
import RecentComplaints from '../../components/dashboard/RecentComplaints';
import { StatusPie, CategoryChart } from '../../components/dashboard/Charts';

export default function CitizenDashboard() {
  const { user } = useAuth();
  const { data, loading } = useDashboard();

  return (
    <div className="space-y-6">
      <div className="card p-6 lg:p-8 bg-gradient-to-r from-navy-800 to-navy-700 text-white border-0 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(5,200,165,0.25),_transparent_45%)]" />
        <div className="relative flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div>
            <p className="text-tealbrand-300 text-sm font-medium">Citizen Portal</p>
            <h1 className="text-2xl lg:text-3xl font-bold mt-1">Hello, {user?.name?.split(' ')[0]}</h1>
            <p className="mt-2 text-slate-300 max-w-xl">Report a civic issue with photo/video evidence and live location, then track every step of its resolution.</p>
          </div>
          <Link to="/report" className="btn-accent px-5 py-3 whitespace-nowrap"><FilePlus2 size={18}/> Report an Issue</Link>
        </div>
      </div>

      {loading ? <PageSkeleton /> : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard icon={ListChecks} label="My Complaints" value={data?.stats.total} sub="All time" />
            <StatCard icon={Clock} label="Pending" value={data?.stats.pending} sub="Awaiting action" color="bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-300" />
            <StatCard icon={AlertTriangle} label="In Progress" value={data?.stats.inProgress} sub="Being worked on" color="bg-cyan-50 text-cyan-600 dark:bg-cyan-900/20 dark:text-cyan-300" />
            <StatCard icon={CheckCircle2} label="Resolved" value={data?.stats.resolved} sub={`Avg ${data?.stats.avgResolutionHours || 0}h resolution`} color="bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-300" />
          </div>

          <div className="grid lg:grid-cols-3 gap-4">
            <RecentComplaints items={data?.recent || []} title="My Recent Complaints" subtitle="Latest updates on your reports" />
            <StatusPie data={data?.byStatus || []} />
            <CategoryChart data={data?.byCategory || []} />
          </div>

          <div className="card p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-semibold text-navy-800 dark:text-white">See issues around your city</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Explore the interactive complaint map to view reported problems by location and status.</p>
            </div>
            <Link to="/map" className="btn-secondary whitespace-nowrap">Open map <ArrowRight size={16}/></Link>
          </div>
        </>
      )}
    </div>
  );
}
