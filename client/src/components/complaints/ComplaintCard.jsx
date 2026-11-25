import { Link } from 'react-router-dom';
import { MapPin, Calendar, ArrowUpRight, AlertTriangle, Film, Camera, Crosshair } from 'lucide-react';
import StatusBadge from '../ui/StatusBadge';
import { SEVERITY_COLORS } from '../../utils/constants';
import { fmtDate } from '../../utils/helpers';

const STATUS_ACCENT = {
  Submitted: 'bg-slate-300',
  'Under Review': 'bg-amber-400',
  Verified: 'bg-blue-400',
  Assigned: 'bg-indigo-400',
  'In Progress': 'bg-cyan-400',
  Resolved: 'bg-emerald-400',
  Rejected: 'bg-rose-400',
  Escalated: 'bg-orange-400',
};

export default function ComplaintCard({ c }) {
  const photos = c.media?.filter(m => m.type === 'image') || [];
  const videos = c.media?.filter(m => m.type === 'video') || [];
  const cover = photos[0];
  const geoTagged = (c.media || []).some(m => m.latitude != null && m.longitude != null);
  const coords = c.location?.coordinates;

  return (
    <div className="card overflow-hidden hover:shadow-card-hover transition-all group relative flex flex-col">
      <span className={`absolute inset-x-0 top-0 h-1 ${STATUS_ACCENT[c.status] || 'bg-slate-300'}`} />

      {cover ? (
        <div className="relative h-44 bg-slate-100 dark:bg-carbon-800 overflow-hidden">
          <img src={cover.url} alt="" className="h-full w-full object-cover group-hover:scale-[1.03] transition-transform duration-300" />
          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/55 to-transparent" />
          <div className="absolute bottom-2 left-2 flex flex-wrap gap-1.5">
            {geoTagged && (
              <span className="flex items-center gap-1 rounded-md bg-tealbrand-600/95 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                <Crosshair size={10}/> GPS
              </span>
            )}
            {photos.length > 0 && (
              <span className="flex items-center gap-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
                <Camera size={10}/> {photos.length}
              </span>
            )}
            {videos.length > 0 && (
              <span className="flex items-center gap-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
                <Film size={10}/> {videos.length}
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className="h-28 bg-gradient-to-br from-slate-100 to-slate-50 dark:from-carbon-800 dark:to-carbon-900 flex flex-col items-center justify-center gap-1.5 text-slate-400">
          <MapPin size={22}/>
          <span className="text-[10px] font-medium uppercase tracking-wide">No photo attached</span>
        </div>
      )}

      <div className="p-5 flex-1 flex flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-mono text-slate-500 dark:text-slate-400">{c.complaintId}</p>
            <h3 className="font-semibold text-navy-800 dark:text-white mt-1 line-clamp-1">{c.title}</h3>
          </div>
          <StatusBadge status={c.status} />
        </div>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 line-clamp-2">{c.description}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <span className="badge bg-slate-100 text-slate-600 dark:bg-carbon-800 dark:text-slate-300">{c.category}</span>
          <span className={`badge ${SEVERITY_COLORS[c.severity] || 'bg-slate-100 text-slate-600'}`}>{c.severity}</span>
          {c.isSeed && <span className="badge bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">Sample</span>}
          {c.priority && c.priority !== 'Normal' && <span className="badge bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">Priority: {c.priority}</span>}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1"><MapPin size={14}/>{c.location?.ward || c.location?.municipality || 'Location set'}</span>
          <span className="flex items-center gap-1"><Calendar size={14}/>{fmtDate(c.createdAt)}</span>
          {coords && (
            <a href={`https://www.google.com/maps?q=${coords[1]},${coords[0]}`} target="_blank" rel="noreferrer"
              className="ml-auto flex items-center gap-1 font-medium text-tealbrand-700 hover:underline dark:text-tealbrand-400">
              Map <ArrowUpRight size={12}/>
            </a>
          )}
        </div>
        <Link to={`/complaints/${c._id}`} className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-tealbrand-700 dark:text-tealbrand-400 hover:underline">
          View details <ArrowUpRight size={15}/>
        </Link>
      </div>
    </div>
  );
}
