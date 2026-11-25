import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft, MapPin, Calendar, Clock, Building2, User, Shield, Star, RotateCcw,
  CheckCircle2, AlertTriangle, ArrowUpCircle, Film, X, ChevronRight, ExternalLink,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import StatusBadge from '../components/ui/StatusBadge';
import { PageSkeleton } from '../components/ui/Skeleton';
import LocationMap from '../components/map/LocationMap';
import { SEVERITY_COLORS, STATUS_COLORS, DEPARTMENTS, PRIORITIES, ROLES } from '../utils/constants';
import { fmtDateTime, timeAgo } from '../utils/helpers';
import { useAuth } from '../context/AuthContext';

const FLOW = {
  Submitted: ['Under Review', 'Rejected'],
  'Under Review': ['Verified', 'Rejected'],
  Verified: ['Assigned', 'Rejected'],
  Assigned: ['In Progress', 'Escalated'],
  'In Progress': ['Resolved', 'Escalated'],
  Resolved: [],
  Rejected: [],
  Escalated: ['Assigned', 'In Progress', 'Resolved', 'Rejected'],
};
const ROLE_STATUS = {
  municipal: ['Under Review', 'Verified', 'Assigned', 'In Progress', 'Resolved', 'Rejected', 'Escalated'],
  ward_officer: ['Assigned', 'In Progress', 'Resolved', 'Rejected', 'Escalated'],
  superior: ['Under Review', 'Verified', 'Assigned', 'In Progress', 'Resolved', 'Rejected', 'Escalated'],
};

function Modal({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative card w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-navy-800 dark:text-white">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-800"><X size={17} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function ComplaintDetails() {
  const { id } = useParams();
  const { user } = useAuth();
  const [complaint, setComplaint] = useState(null);
  const [loading, setLoading] = useState(true);
  const [officers, setOfficers] = useState([]);
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState(null);
  const [statusForm, setStatusForm] = useState({ status: '', note: '', rejectedReason: '', assignedDepartment: '', priority: '', proof: [] });
  const [assignForm, setAssignForm] = useState({ assignedTo: '', assignedDepartment: '', deadline: '', priority: 'Normal', note: '' });
  const [escalateNote, setEscalateNote] = useState('');
  const [feedback, setFeedback] = useState({ rating: 0, comment: '' });
  const [reopenReason, setReopenReason] = useState('');
  const [lightbox, setLightbox] = useState(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/complaints/${id}`);
      setComplaint(data.complaint);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Unable to load complaint');
    } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const isOfficer = user && user.role !== ROLES.CITIZEN;
  useEffect(() => {
    if (!isOfficer) return;
    api.get('/admin/officers').then(({ data }) => setOfficers(data.users)).catch(() => {});
  }, [isOfficer]);

  if (loading) return <PageSkeleton />;
  if (!complaint) return <div className="card p-10 text-center text-slate-500">Complaint not found or you do not have access.</div>;

  const isOwner = (complaint.reporter?._id || complaint.reporter) === user?._id;
  const coords = complaint.location?.coordinates;
  const allowed = (FLOW[complaint.status] || []).filter(s => (ROLE_STATUS[user.role] || []).includes(s));
  const canModerate = isOfficer && allowed.length > 0;
  const overdue = !!complaint.deadline && new Date(complaint.deadline) < new Date() && !['Resolved', 'Rejected'].includes(complaint.status);

  const withBusy = async (fn, success) => {
    setBusy(true);
    try { await fn(); toast.success(success); await load(); setModal(null); }
    catch (err) { toast.error(err.response?.data?.message || 'Action failed'); }
    finally { setBusy(false); }
  };

  const submitStatus = (e) => {
    e.preventDefault();
    if (!statusForm.status) return toast.error('Select a status');
    if (statusForm.status === 'Rejected' && !statusForm.rejectedReason.trim()) return toast.error('Rejection reason is required');
    const fd = new FormData();
    ['status', 'note', 'rejectedReason', 'assignedDepartment', 'priority'].forEach(k => { if (statusForm[k]) fd.append(k, statusForm[k]); });
    statusForm.proof.forEach(f => fd.append('media', f));
    withBusy(() => api.patch(`/complaints/${id}/status`, fd, { headers: { 'Content-Type': 'multipart/form-data' } }), 'Status updated');
  };

  const submitAssign = (e) => {
    e.preventDefault();
    if (!assignForm.assignedDepartment && !assignForm.assignedTo) return toast.error('Choose a department or officer');
    withBusy(() => api.patch(`/complaints/${id}/assign`, assignForm), 'Complaint assigned');
  };

  const submitEscalate = () => withBusy(() => api.patch(`/complaints/${id}/escalate`, { note: escalateNote }), 'Complaint escalated');

  const submitFeedback = (e) => {
    e.preventDefault();
    if (!feedback.rating) return toast.error('Choose a rating');
    withBusy(() => api.post(`/complaints/${id}/feedback`, feedback), 'Thank you for your feedback');
  };

  const submitReopen = (e) => {
    e.preventDefault();
    if (!reopenReason.trim()) return toast.error('Describe why the issue is unresolved');
    withBusy(() => api.post(`/complaints/${id}/reopen`, { reason: reopenReason }), 'Reopen request submitted');
  };

  return (
    <div className="space-y-6 max-w-7xl">
      <Link to="/complaints" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-navy-700 dark:hover:text-white"><ArrowLeft size={15} /> Back to complaints</Link>

      <div className="card p-6">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-slate-500">{complaint.complaintId}</span>
              <StatusBadge status={complaint.status} />
              {complaint.priority !== 'Normal' && <span className="badge bg-orange-100 text-orange-700">Priority: {complaint.priority}</span>}
              {complaint.isSeed && <span className="badge bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">Sample / development record</span>}
              {complaint.reopen?.isReopened && <span className="badge bg-amber-100 text-amber-700">Reopened</span>}
            </div>
            <h1 className="mt-2 text-2xl font-bold text-navy-900 dark:text-white">{complaint.title}</h1>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="badge bg-slate-100 text-slate-600 dark:bg-navy-800 dark:text-slate-300">{complaint.category}</span>
              <span className={`badge ${SEVERITY_COLORS[complaint.severity] || 'bg-slate-100 text-slate-600'}`}>{complaint.severity} severity</span>
              {complaint.assignedDepartment && <span className="badge bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">{complaint.assignedDepartment}</span>}
            </div>
          </div>
          {canModerate && (
            <div className="flex flex-wrap gap-2">
              <button onClick={() => { setStatusForm(f => ({ ...f, status: allowed[0], priority: complaint.priority })); setModal('status'); }} className="btn-primary">Update status</button>
              <button onClick={() => { setAssignForm(f => ({ ...f, assignedDepartment: complaint.assignedDepartment || '', priority: complaint.priority })); setModal('assign'); }} className="btn-secondary">Assign</button>
              {!['Escalated', 'Resolved', 'Rejected'].includes(complaint.status) && (
                <button onClick={() => setModal('escalate')} className="btn-secondary !text-orange-600 !border-orange-200 dark:!border-orange-900/50"><ArrowUpCircle size={16} /> Escalate</button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <section className="card p-6">
            <h2 className="font-semibold text-navy-800 dark:text-white mb-3">Issue description</h2>
            <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">{complaint.description}</p>
            {complaint.rejectedReason && (
              <div className="mt-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 p-3">
                <p className="text-xs font-semibold text-rose-700 dark:text-rose-300">Rejection reason</p>
                <p className="mt-1 text-sm text-rose-800 dark:text-rose-400">{complaint.rejectedReason}</p>
              </div>
            )}
            {complaint.media?.length > 0 && (
              <div className="mt-5">
                <h3 className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">Evidence ({complaint.media.length}) · geo-tagged</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {complaint.media.map((m, i) => (
                    <button key={i} onClick={() => setLightbox(m)} className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-navy-700 aspect-video bg-slate-100 dark:bg-navy-800 group">
                      {m.type === 'video' ? (
                        <><video src={m.url} className="h-full w-full object-cover" /><div className="absolute inset-0 flex items-center justify-center bg-black/30"><Film className="text-white" size={22} /></div></>
                      ) : <img src={m.url} alt="" className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300" />}
                      {m.latitude != null && (
                        <span className="absolute bottom-1.5 left-1.5 flex items-center gap-1 rounded bg-black/65 px-1.5 py-0.5 text-[9px] font-medium text-white">
                          <MapPin size={9} /> {Number(m.latitude).toFixed(4)}, {Number(m.longitude).toFixed(4)}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>

          <section className="card p-6">
            <h2 className="font-semibold text-navy-800 dark:text-white mb-3">Reported location</h2>
            {coords && <LocationMap center={[coords[1], coords[0]]} marker={[coords[1], coords[0]]} zoom={16} height={280} />}
            <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-600 dark:text-slate-300">
              <span className="flex items-center gap-1"><MapPin size={15} /> {complaint.location.address || 'Address not provided'}</span>
              {complaint.location.landmark && <span className="text-slate-500">Landmark: {complaint.location.landmark}</span>}
              <span className="text-slate-500">{[complaint.location.ward, complaint.location.municipality].filter(Boolean).join(', ')}</span>
              {coords && <span className="font-mono text-xs text-slate-400">{coords[1].toFixed(5)}, {coords[0].toFixed(5)}</span>}
              {coords && (
                <a href={`https://www.google.com/maps?q=${coords[1]},${coords[0]}`} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1 text-xs font-medium text-tealbrand-700 hover:underline dark:text-tealbrand-400">
                  <ExternalLink size={12}/> Google Maps
                </a>
              )}
              {complaint.location?.source && (
                <span className="badge bg-slate-100 text-slate-600 dark:bg-navy-800 dark:text-slate-300">
                  {complaint.location.source === 'gps' ? 'GPS verified'
                    : complaint.location.source === 'map' ? 'Pinned by citizen'
                      : complaint.location.source === 'address' ? 'Approximate from address' : complaint.location.source}
                </span>
              )}
            </div>
          </section>

          <section className="card p-6">
            <h2 className="font-semibold text-navy-800 dark:text-white mb-5">Status timeline</h2>
            <ol className="relative border-l-2 border-slate-200 dark:border-navy-700 ml-2 space-y-6">
              {complaint.timeline?.map((t, i) => (
                <li key={t._id || i} className="ml-5">
                  <span className="absolute -left-[9px] flex h-4 w-4 items-center justify-center rounded-full bg-white dark:bg-navy-900 border-2 border-tealbrand-500">
                    <span className="h-1.5 w-1.5 rounded-full bg-tealbrand-500" />
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`badge ${STATUS_COLORS[t.status] || 'bg-slate-100 text-slate-600'}`}>{t.status}</span>
                    <span className="text-xs text-slate-500">{fmtDateTime(t.at)}</span>
                  </div>
                  {t.note && <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-300">{t.note}</p>}
                  <p className="mt-1 text-xs text-slate-500">{t.byName || 'System'}{t.byRole ? ` · ${t.byRole.replace('_', ' ')}` : ''}{t.department ? ` · ${t.department}` : ''}</p>
                  {t.media?.length > 0 && (
                    <div className="mt-2 flex gap-2 flex-wrap">
                      {t.media.map((m, mi) => (
                        <button key={mi} onClick={() => setLightbox(m)} className="h-16 w-24 rounded-lg overflow-hidden border border-slate-200 dark:border-navy-700">
                          {m.type === 'video' ? <video src={m.url} className="h-full w-full object-cover" /> : <img src={m.url} alt="" className="h-full w-full object-cover" />}
                        </button>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ol>
          </section>

          {isOwner && complaint.status === 'Resolved' && (
            <section className="card p-6">
              <h2 className="font-semibold text-navy-800 dark:text-white mb-1">Resolution feedback</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Was the issue actually resolved? Your rating helps track accountability.</p>
              {complaint.feedback?.rating ? (
                <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 p-4">
                  <div className="flex items-center gap-1 text-amber-500">{[1, 2, 3, 4, 5].map(n => <Star key={n} size={18} fill={n <= complaint.feedback.rating ? 'currentColor' : 'none'} />)}</div>
                  <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">{complaint.feedback.comment || 'No comment provided.'}</p>
                  <p className="mt-1 text-xs text-slate-500">Submitted {fmtDateTime(complaint.feedback.submittedAt)}</p>
                </div>
              ) : (
                <form onSubmit={submitFeedback} className="space-y-4">
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map(n => (
                      <button key={n} type="button" onClick={() => setFeedback(f => ({ ...f, rating: n }))} className={`p-1 transition ${n <= feedback.rating ? 'text-amber-500' : 'text-slate-300 dark:text-navy-600'}`}>
                        <Star size={28} fill={n <= feedback.rating ? 'currentColor' : 'none'} />
                      </button>
                    ))}
                  </div>
                  <textarea className="input min-h-[80px]" value={feedback.comment} onChange={e => setFeedback(f => ({ ...f, comment: e.target.value }))} placeholder="Optional comment about the resolution" />
                  <button disabled={busy} className="btn-primary">{busy ? 'Submitting...' : 'Submit feedback'}</button>
                </form>
              )}
              <div className="mt-6 pt-5 border-t border-slate-200 dark:border-navy-700">
                <h3 className="text-sm font-semibold text-navy-800 dark:text-white flex items-center gap-2"><RotateCcw size={16} /> Problem still not fixed?</h3>
                <p className="text-xs text-slate-500 mt-1">Reopening sends the complaint back for verification by the authority.</p>
                <form onSubmit={submitReopen} className="mt-3 flex flex-col sm:flex-row gap-2">
                  <input className="input flex-1" value={reopenReason} onChange={e => setReopenReason(e.target.value)} placeholder="Explain what remains unresolved" />
                  <button disabled={busy} className="btn-secondary whitespace-nowrap">Reopen complaint</button>
                </form>
              </div>
            </section>
          )}
        </div>

        <aside className="space-y-4">
          <div className="card p-5">
            <h2 className="font-semibold text-navy-800 dark:text-white mb-4">Complaint information</h2>
            <dl className="space-y-4 text-sm">
              <div className="flex items-start gap-3"><User size={16} className="text-slate-400 mt-0.5" /><div><dt className="text-xs text-slate-500">Reported by</dt><dd className="font-medium text-navy-800 dark:text-white">{complaint.reporter?.name || 'Citizen'}</dd>{isOfficer && complaint.reporter?.email && <dd className="text-xs text-slate-500">{complaint.reporter.email}</dd>}</div></div>
              <div className="flex items-start gap-3"><Calendar size={16} className="text-slate-400 mt-0.5" /><div><dt className="text-xs text-slate-500">Reported on</dt><dd className="font-medium text-navy-800 dark:text-white">{fmtDateTime(complaint.createdAt)}</dd><dd className="text-xs text-slate-500">{timeAgo(complaint.createdAt)}</dd></div></div>
              <div className="flex items-start gap-3"><Building2 size={16} className="text-slate-400 mt-0.5" /><div><dt className="text-xs text-slate-500">Department</dt><dd className="font-medium text-navy-800 dark:text-white">{complaint.assignedDepartment || 'Not assigned'}</dd></div></div>
              <div className="flex items-start gap-3"><Shield size={16} className="text-slate-400 mt-0.5" /><div><dt className="text-xs text-slate-500">Assigned officer</dt><dd className="font-medium text-navy-800 dark:text-white">{complaint.assignedTo?.name || 'Unassigned'}</dd>{complaint.assignedTo?.department && <dd className="text-xs text-slate-500">{complaint.assignedTo.department}</dd>}</div></div>
              <div className="flex items-start gap-3"><Clock size={16} className={overdue ? 'text-rose-500 mt-0.5' : 'text-slate-400 mt-0.5'} /><div><dt className="text-xs text-slate-500">Resolution deadline</dt><dd className="font-medium text-navy-800 dark:text-white">{complaint.deadline ? fmtDateTime(complaint.deadline) : 'Not set'}</dd>{overdue && <dd className="text-xs text-rose-500 font-medium">Overdue</dd>}</div></div>
              {complaint.resolvedAt && <div className="flex items-start gap-3"><CheckCircle2 size={16} className="text-emerald-500 mt-0.5" /><div><dt className="text-xs text-slate-500">Resolved on</dt><dd className="font-medium text-navy-800 dark:text-white">{fmtDateTime(complaint.resolvedAt)}</dd></div></div>}
              {complaint.escalationLevel > 0 && <div className="flex items-start gap-3"><ArrowUpCircle size={16} className="text-orange-500 mt-0.5" /><div><dt className="text-xs text-slate-500">Escalation level</dt><dd className="font-medium text-navy-800 dark:text-white">Level {complaint.escalationLevel}</dd></div></div>}
            </dl>
          </div>

          {complaint.duplicateCandidates?.length > 0 && (
            <div className="card p-5 border-amber-200 dark:border-amber-900/50">
              <h2 className="font-semibold text-amber-900 dark:text-amber-300 flex items-center gap-2"><AlertTriangle size={17} /> Possible duplicates</h2>
              <p className="text-xs text-amber-800 dark:text-amber-400 mt-1">Similar nearby complaints filed in the last 7 days.</p>
              <div className="mt-3 space-y-2">
                {complaint.duplicateCandidates.map(d => (
                  <Link key={d._id} to={`/complaints/${d._id}`} className="flex items-center justify-between gap-2 rounded-lg bg-amber-50/70 dark:bg-amber-950/20 px-3 py-2 text-sm hover:bg-amber-100/70 transition">
                    <span className="min-w-0"><span className="font-mono text-[11px] text-slate-500 block">{d.complaintId}</span><span className="truncate block text-navy-800 dark:text-white">{d.title}</span></span>
                    <ChevronRight size={15} className="text-slate-400 shrink-0" />
                  </Link>
                ))}
              </div>
            </div>
          )}

          {complaint.reopen?.isReopened && (
            <div className="card p-5">
              <h2 className="font-semibold text-navy-800 dark:text-white text-sm">Reopen request</h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{complaint.reopen.reason}</p>
              <p className="mt-1 text-xs text-slate-500">{fmtDateTime(complaint.reopen.reopenedAt)}</p>
            </div>
          )}
        </aside>
      </div>

      {modal === 'status' && (
        <Modal title="Update complaint status" onClose={() => setModal(null)}>
          <form onSubmit={submitStatus} className="space-y-4">
            <div><label className="label">New status</label>
              <select className="input" value={statusForm.status} onChange={e => setStatusForm(f => ({ ...f, status: e.target.value }))}>
                {allowed.map(s => <option key={s}>{s}</option>)}
              </select>
              <p className="mt-1 text-xs text-slate-500">Only valid transitions from “{complaint.status}” are shown.</p>
            </div>
            {statusForm.status === 'Rejected' && <div><label className="label">Rejection reason <span className="text-rose-500">*</span></label><textarea className="input min-h-[70px]" required value={statusForm.rejectedReason} onChange={e => setStatusForm(f => ({ ...f, rejectedReason: e.target.value }))} placeholder="Explain why this complaint is being rejected" /></div>}
            {['Assigned', 'In Progress', 'Verified'].includes(statusForm.status) && (
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Department</label>
                  <select className="input" value={statusForm.assignedDepartment} onChange={e => setStatusForm(f => ({ ...f, assignedDepartment: e.target.value }))}>
                    <option value="">Keep current</option>{DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
                  </select>
                </div>
                <div><label className="label">Priority</label>
                  <select className="input" value={statusForm.priority} onChange={e => setStatusForm(f => ({ ...f, priority: e.target.value }))}>
                    {PRIORITIES.map(p => <option key={p}>{p}</option>)}
                  </select>
                </div>
              </div>
            )}
            {statusForm.status === 'Resolved' && (
              <div><label className="label">Resolution proof (photos/videos)</label>
                <input type="file" multiple accept="image/*,video/*" onChange={e => setStatusForm(f => ({ ...f, proof: [...e.target.files] }))} className="block w-full text-xs text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-navy-700 file:px-3 file:py-2 file:text-white file:text-xs" />
              </div>
            )}
            <div><label className="label">Official note</label><textarea className="input min-h-[70px]" value={statusForm.note} onChange={e => setStatusForm(f => ({ ...f, note: e.target.value }))} placeholder="Add an update visible to the citizen" /></div>
            <div className="flex gap-2"><button type="button" onClick={() => setModal(null)} className="btn-secondary flex-1">Cancel</button><button disabled={busy} className="btn-primary flex-1">{busy ? 'Updating...' : 'Confirm update'}</button></div>
          </form>
        </Modal>
      )}

      {modal === 'assign' && (
        <Modal title="Assign complaint" onClose={() => setModal(null)}>
          <form onSubmit={submitAssign} className="space-y-4">
            <div><label className="label">Department</label>
              <select className="input" value={assignForm.assignedDepartment} onChange={e => setAssignForm(f => ({ ...f, assignedDepartment: e.target.value }))}>
                <option value="">Keep current</option>{DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
              </select>
            </div>
            <div><label className="label">Officer</label>
              <select className="input" value={assignForm.assignedTo} onChange={e => setAssignForm(f => ({ ...f, assignedTo: e.target.value }))}>
                <option value="">Unassigned</option>
                {officers.map(o => <option key={o._id} value={o._id}>{o.name} — {o.role.replace('_', ' ')}{o.department ? ` (${o.department})` : ''}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Priority</label>
                <select className="input" value={assignForm.priority} onChange={e => setAssignForm(f => ({ ...f, priority: e.target.value }))}>{PRIORITIES.map(p => <option key={p}>{p}</option>)}</select>
              </div>
              <div><label className="label">Deadline</label><input type="date" className="input" value={assignForm.deadline} onChange={e => setAssignForm(f => ({ ...f, deadline: e.target.value }))} /></div>
            </div>
            <div><label className="label">Note</label><textarea className="input min-h-[60px]" value={assignForm.note} onChange={e => setAssignForm(f => ({ ...f, note: e.target.value }))} placeholder="Instructions for the assigned team" /></div>
            <div className="flex gap-2"><button type="button" onClick={() => setModal(null)} className="btn-secondary flex-1">Cancel</button><button disabled={busy} className="btn-primary flex-1">{busy ? 'Assigning...' : 'Assign complaint'}</button></div>
          </form>
        </Modal>
      )}

      {modal === 'escalate' && (
        <Modal title="Escalate complaint" onClose={() => setModal(null)}>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">This forwards the complaint to ward officers and government superiors with a full audit record.</p>
          <textarea className="input min-h-[90px]" value={escalateNote} onChange={e => setEscalateNote(e.target.value)} placeholder="Reason for escalation (urgency, missed deadline, etc.)" />
          <div className="flex gap-2 mt-4"><button type="button" onClick={() => setModal(null)} className="btn-secondary flex-1">Cancel</button><button disabled={busy} onClick={submitEscalate} className="btn-primary flex-1">{busy ? 'Escalating...' : 'Confirm escalation'}</button></div>
        </Modal>
      )}

      {lightbox && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 p-6 bg-black/80" onClick={() => setLightbox(null)}>
          <button className="absolute top-5 right-5 h-10 w-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20"><X size={20} /></button>
          {lightbox.type === 'video'
            ? <video src={lightbox.url} controls autoPlay className="max-h-[80vh] max-w-full rounded-xl" />
            : <img src={lightbox.url} alt="" className="max-h-[80vh] max-w-full rounded-xl object-contain" />}
          {lightbox.latitude != null && (
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 rounded-xl bg-white/10 px-4 py-2 text-xs text-white" onClick={(e) => e.stopPropagation()}>
              <span className="flex items-center gap-1.5 font-mono">
                <MapPin size={13} /> {Number(lightbox.latitude).toFixed(6)}, {Number(lightbox.longitude).toFixed(6)}
                {lightbox.accuracy ? ` · ±${Math.round(lightbox.accuracy)} m` : ''}
              </span>
              {lightbox.capturedAt && <span>Captured {fmtDateTime(lightbox.capturedAt)}</span>}
              <a href={`https://www.google.com/maps?q=${lightbox.latitude},${lightbox.longitude}`} target="_blank" rel="noreferrer"
                className="flex items-center gap-1 font-medium text-tealbrand-300 hover:underline">
                <ExternalLink size={12} /> Google Maps
              </a>
              <a href={lightbox.url} download={lightbox.filename || 'civictrack-evidence'} className="flex items-center gap-1 font-medium text-white/80 hover:underline">
                Save file
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
