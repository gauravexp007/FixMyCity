import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, SlidersHorizontal, ListChecks, Plus, ChevronLeft, ChevronRight, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import ComplaintCard from '../components/complaints/ComplaintCard';
import { PageSkeleton } from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';
import { CATEGORIES, SEVERITIES, STATUS, ROLES } from '../utils/constants';
import { useAuth } from '../context/AuthContext';

export default function ComplaintsList() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const categoryParam = searchParams.get('category') || '';
  const [data, setData] = useState({ complaints: [], pagination: null });
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: searchParams.get('status') || '',
    category: categoryParam,
    severity: searchParams.get('severity') || '',
    search: '',
  });
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 9 };
      Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
      const { data } = await api.get('/complaints', { params });
      setData(data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load complaints');
    } finally { setLoading(false); }
  }, [filters, page]);

  useEffect(() => { load(); }, [load]);

  // Dashboard category cards link here with ?category=… — keep the filter in sync
  // even when the page is already open.
  useEffect(() => {
    setFilters(f => (f.category === categoryParam ? f : { ...f, category: categoryParam }));
    setPage(1);
  }, [categoryParam]);

  const applySearch = (e) => { e.preventDefault(); setPage(1); setFilters(f => ({ ...f, search: searchInput })); };
  const clear = () => { setFilters({ status: '', category: '', severity: '', search: '' }); setSearchInput(''); setPage(1); };
  const activeCount = Object.values(filters).filter(Boolean).length;
  const isCitizen = user?.role === ROLES.CITIZEN;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy-900 dark:text-white">{isCitizen ? 'My Complaints' : 'Complaints'}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {data.pagination ? `${data.pagination.total} complaint(s) found` : 'Loading complaints...'}
            {filters.category && <span className="ml-2 badge bg-tealbrand-50 text-tealbrand-700 dark:bg-tealbrand-900/20 dark:text-tealbrand-300">{filters.category}</span>}
          </p>
        </div>
        {isCitizen && <Link to="/report" className="btn-accent whitespace-nowrap"><Plus size={18}/> Report Issue</Link>}
      </div>

      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        <button onClick={() => { setFilters(f => ({ ...f, category: '' })); setPage(1); }}
          className={`whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${!filters.category ? 'border-navy-700 bg-navy-700 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-tealbrand-400 dark:border-carbon-700 dark:bg-carbon-900 dark:text-slate-300'}`}>
          All categories
        </button>
        {CATEGORIES.map(cat => (
          <button key={cat} onClick={() => { setFilters(f => ({ ...f, category: cat })); setPage(1); }}
            className={`whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${filters.category === cat ? 'border-navy-700 bg-navy-700 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-tealbrand-400 dark:border-carbon-700 dark:bg-carbon-900 dark:text-slate-300'}`}>
            {cat}
          </button>
        ))}
      </div>

      <div className="card p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <form onSubmit={applySearch} className="relative flex-1">
            <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
            <input className="input pl-10" placeholder="Search by ID, title, description or address" value={searchInput} onChange={e=>setSearchInput(e.target.value)} />
          </form>
          <button onClick={()=>setShowFilters(s=>!s)} className="btn-secondary">
            <SlidersHorizontal size={17}/> Filters {activeCount > 0 && <span className="ml-1 rounded-full bg-navy-700 text-white text-[10px] px-1.5 py-0.5">{activeCount}</span>}
          </button>
        </div>
        {showFilters && (
          <div className="grid sm:grid-cols-3 gap-3 pt-1">
            <select className="input" value={filters.status} onChange={e=>{setPage(1);setFilters(f=>({...f,status:e.target.value}))}}>
              <option value="">All statuses</option>
              {Object.values(STATUS).map(s=><option key={s}>{s}</option>)}
            </select>
            <select className="input" value={filters.category} onChange={e=>{setPage(1);setFilters(f=>({...f,category:e.target.value}))}}>
              <option value="">All categories</option>
              {CATEGORIES.map(c=><option key={c}>{c}</option>)}
            </select>
            <select className="input" value={filters.severity} onChange={e=>{setPage(1);setFilters(f=>({...f,severity:e.target.value}))}}>
              <option value="">All severities</option>
              {SEVERITIES.map(s=><option key={s}>{s}</option>)}
            </select>
          </div>
        )}
        {activeCount > 0 && <button onClick={clear} className="text-xs font-medium text-tealbrand-700 dark:text-tealbrand-400 flex items-center gap-1 hover:underline"><X size={13}/> Clear all filters</button>}
      </div>

      {loading ? <PageSkeleton /> : data.complaints.length === 0 ? (
        <EmptyState icon={ListChecks} title="No complaints found" description={activeCount ? 'Try adjusting or clearing your filters.' : isCitizen ? 'You have not reported any issues yet. Report your first civic issue to get started.' : 'No complaints are available in your jurisdiction yet.'}
          action={isCitizen ? <Link to="/report" className="btn-primary">Report an issue</Link> : null} />
      ) : (
        <>
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5">
            {data.complaints.map(c => <ComplaintCard key={c._id} c={c} />)}
          </div>
          {data.pagination?.pages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button disabled={page<=1} onClick={()=>setPage(p=>p-1)} className="btn-secondary py-2 px-3"><ChevronLeft size={16}/></button>
              <span className="text-sm text-slate-500 px-2">Page {data.pagination.page} of {data.pagination.pages}</span>
              <button disabled={page>=data.pagination.pages} onClick={()=>setPage(p=>p+1)} className="btn-secondary py-2 px-3"><ChevronRight size={16}/></button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
