import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Camera, Film, MapPin, ExternalLink, Download, Search, Loader2,
  ShieldCheck, Building2, RefreshCw, ChevronLeft, ChevronRight, Crosshair,
} from 'lucide-react';
import api from '../services/api';
import StatusBadge from '../components/ui/StatusBadge';
import { PageSkeleton } from '../components/ui/Skeleton';
import { useAuth } from '../context/AuthContext';
import { ROLES } from '../utils/constants';
import { fmtDateTime } from '../utils/helpers';

const mapsUrl = (lat, lng) => `https://www.google.com/maps?q=${lat},${lng}`;
const streetViewUrl = (lat, lng) => `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`;

const FILTERS = [
  { key: 'all', label: 'All evidence' },
  { key: 'photo', label: 'Photos' },
  { key: 'video', label: 'Videos' },
];

function SummaryCard({ icon: Icon, label, value, tone = 'text-navy-700 dark:text-tealbrand-300' }) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
        <Icon size={14} className={tone} /> {label}
      </div>
      <p className="mt-2 text-2xl font-bold text-navy-900 dark:text-white">{value}</p>
    </div>
  );
}

export default function EvidencePage() {
  const { user } = useAuth();
  const isCitizen = user?.role === ROLES.CITIZEN;
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [type, setType] = useState('all');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const id = setTimeout(() => { setSearch(searchInput.trim()); setPage(1); }, 400);
    return () => clearTimeout(id);
  }, [searchInput]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/complaints/evidence', { params: { type, search, page, limit: 24 } });
      setItems(data.items);
      setSummary(data.summary);
      setPagination(data.pagination);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load the evidence feed.');
    } finally {
      setLoading(false);
    }
  }, [type, search, page]);

  useEffect(() => { load(); }, [load]);

  const heading = isCitizen ? 'My evidence vault' : 'Evidence delivered to your desk';
  const subheading = isCitizen
    ? 'Every photo and video you captured with its GPS location and timestamp. These stay saved under your login, even after the complaint is closed.'
    : 'Geo-tagged photos and videos submitted by citizens in your jurisdiction, with the exact capture location and time.';

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy-900 dark:text-white flex items-center gap-2">
            <Camera size={22} className="text-tealbrand-600" /> {heading}
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-500 dark:text-slate-400">{subheading}</p>
        </div>
        <button onClick={load} disabled={loading} className="btn-secondary whitespace-nowrap">
          {loading ? <><Loader2 size={16} className="animate-spin" /> Refreshing</> : <><RefreshCw size={16} /> Refresh</>}
        </button>
      </div>

      {isCitizen ? (
        <div className="rounded-2xl border border-tealbrand-200 bg-tealbrand-50/60 p-4 text-sm text-tealbrand-900 dark:border-tealbrand-900/50 dark:bg-tealbrand-900/10 dark:text-tealbrand-200 flex items-start gap-2">
          <ShieldCheck size={17} className="mt-0.5 shrink-0" />
          <p>Your captures are stored against your account and marked with the coordinates printed on the image. Use <span className="font-semibold">Download</span> to keep a copy, or open the pin in Google Maps to verify where it was taken.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-navy-200 bg-navy-50/60 p-4 text-sm text-navy-900 dark:border-navy-700 dark:bg-navy-800/50 dark:text-slate-200 flex items-start gap-2">
          <Building2 size={17} className="mt-0.5 shrink-0" />
          <p>These are the same geo-tagged captures attached to citizen complaints. The stamped coordinates and timestamp are immutable evidence you can compare with the field team's resolution proof.</p>
        </div>
      )}

      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <SummaryCard icon={Camera} label="Total captures" value={summary.total} />
          <SummaryCard icon={Camera} label="Photos" value={summary.photos} />
          <SummaryCard icon={Film} label="Videos" value={summary.videos} />
          <SummaryCard icon={Crosshair} label="Geo-tagged" value={summary.geoTagged} />
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex gap-1 p-1 rounded-xl bg-slate-100 dark:bg-navy-800 w-fit">
          {FILTERS.map((f) => (
            <button key={f.key} type="button"
              onClick={() => { setType(f.key); setPage(1); }}
              className={`rounded-lg px-3.5 py-2 text-sm font-medium transition ${type === f.key ? 'bg-white text-navy-800 shadow-sm dark:bg-navy-700 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 sm:max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input pl-9" value={searchInput} onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search complaint, ward or address" />
        </div>
      </div>

      {loading && !items.length ? (
        <PageSkeleton />
      ) : error ? (
        <div className="card p-8 text-center text-sm text-rose-600">{error}</div>
      ) : items.length === 0 ? (
        <div className="card p-10 text-center">
          <Camera size={30} className="mx-auto text-slate-300 dark:text-navy-600" />
          <h3 className="mt-3 font-semibold text-navy-800 dark:text-white">No evidence yet</h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {isCitizen
              ? 'Capture a geo-tagged photo or video while reporting an issue and it will appear here.'
              : 'Geo-tagged evidence appears here as soon as citizens submit complaints in your jurisdiction.'}
          </p>
          {isCitizen && <Link to="/report" className="btn-primary mt-4 inline-flex">Report an issue</Link>}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {items.map((item) => (
            <article key={item.id} className="card overflow-hidden flex flex-col">
              <div className="relative aspect-video bg-slate-900">
                {item.mediaType === 'video' ? (
                  <video src={item.url} controls preload="metadata" className="h-full w-full object-cover" />
                ) : (
                  <img src={item.url} alt={item.complaint.title} className="h-full w-full object-cover" loading="lazy" />
                )}
                <div className="absolute top-2 left-2 flex flex-wrap gap-1.5">
                  <span className="rounded-md bg-black/70 px-2 py-0.5 text-[10px] font-medium text-white flex items-center gap-1">
                    {item.mediaType === 'video' ? <Film size={10} /> : <Camera size={10} />} {item.kind}
                  </span>
                  {item.latitude != null && (
                    <a href={item.mapsUrl} target="_blank" rel="noreferrer"
                      className="rounded-md bg-tealbrand-600/95 px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-tealbrand-700 flex items-center gap-1">
                      <MapPin size={10} /> {Number(item.latitude).toFixed(4)}, {Number(item.longitude).toFixed(4)}
                    </a>
                  )}
                </div>
              </div>

              <div className="p-4 flex-1 flex flex-col">
                <div className="flex items-start justify-between gap-2">
                  <Link to={`/complaints/${item.complaint._id}`} className="min-w-0">
                    <p className="font-mono text-[11px] text-slate-500">{item.complaint.complaintId}</p>
                    <h3 className="font-semibold text-navy-800 dark:text-white line-clamp-2 hover:underline">{item.complaint.title}</h3>
                  </Link>
                  <StatusBadge status={item.complaint.status} />
                </div>

                <p className="mt-2 flex items-start gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <MapPin size={13} className="mt-0.5 shrink-0" />
                  <span className="line-clamp-2">{item.address || [item.complaint.ward, item.complaint.municipality].filter(Boolean).join(', ') || 'Address not provided'}</span>
                </p>
                {!isCitizen && (item.reporter || item.reporterEmail) && (
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Reported by {item.reporter || item.reporterEmail}</p>
                )}
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Captured {fmtDateTime(item.capturedAt)}</p>

                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 dark:border-navy-800 pt-3">
                  {item.latitude != null && (
                    <>
                      <a href={item.mapsUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-tealbrand-700 hover:underline dark:text-tealbrand-400">
                        <ExternalLink size={12} /> Google Maps
                      </a>
                      <a href={streetViewUrl(item.latitude, item.longitude)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:underline dark:text-slate-400">
                        <MapPin size={12} /> Street View
                      </a>
                    </>
                  )}
                  <a href={item.url} download={item.filename || `civictrack-${item.complaint.complaintId}`}
                    className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-navy-700 hover:underline dark:text-tealbrand-300">
                    <Download size={12} /> Save
                  </a>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {pagination.pages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={pagination.page <= 1} className="btn-secondary disabled:opacity-40">
            <ChevronLeft size={16} /> Previous
          </button>
          <span className="text-sm text-slate-500 dark:text-slate-400">Page {pagination.page} of {pagination.pages} · {pagination.total} captures</span>
          <button onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))} disabled={pagination.page >= pagination.pages} className="btn-secondary disabled:opacity-40">
            Next <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
