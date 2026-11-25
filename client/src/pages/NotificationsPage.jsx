import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, BellRing, CheckCheck, Check, Loader2, Inbox } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { getSocket } from '../services/socket';
import EmptyState from '../components/ui/EmptyState';
import { PageSkeleton } from '../components/ui/Skeleton';
import { timeAgo } from '../utils/helpers';
import { useAuth } from '../context/AuthContext';

const TONE = {
  success: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
  warning: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
  error: 'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400',
  info: 'bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400',
};

export default function NotificationsPage() {
  const { user } = useAuth();
  const [data, setData] = useState({ notifications: [], unread: 0 });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState('all');

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/notifications');
      setData({ notifications: data.notifications, unread: data.unread });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not load notifications');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const onNew = (n) => {
      setData(d => ({ notifications: [n, ...d.notifications], unread: d.unread + (n.isRead ? 0 : 1) }));
    };
    socket.on('notification', onNew);
    return () => socket.off('notification', onNew);
  }, [user?._id]);

  const markRead = async (id) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setData(d => ({ notifications: d.notifications.map(n => n._id === id ? { ...n, isRead: true } : n), unread: Math.max(0, d.unread - 1) }));
    } catch { toast.error('Could not mark notification as read'); }
  };

  const markAll = async () => {
    setBusy(true);
    try {
      await api.patch('/notifications/read-all');
      setData(d => ({ notifications: d.notifications.map(n => ({ ...n, isRead: true })), unread: 0 }));
      toast.success('All notifications marked as read');
    } catch { toast.error('Could not update notifications'); }
    finally { setBusy(false); }
  };

  const list = filter === 'unread' ? data.notifications.filter(n => !n.isRead) : data.notifications;

  if (loading) return <PageSkeleton />;

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy-900 dark:text-white">Notifications</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{data.unread} unread of {data.notifications.length} total</p>
        </div>
        <button onClick={markAll} disabled={busy || data.unread === 0} className="btn-secondary">
          {busy ? <Loader2 size={16} className="animate-spin" /> : <CheckCheck size={16} />} Mark all as read
        </button>
      </div>

      <div className="flex gap-2">
        {[{ k: 'all', label: 'All' }, { k: 'unread', label: `Unread (${data.unread})` }].map(t => (
          <button key={t.k} onClick={() => setFilter(t.k)}
            className={`rounded-lg px-3.5 py-2 text-sm font-medium transition ${filter === t.k ? 'bg-navy-700 text-white' : 'bg-white dark:bg-carbon-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-carbon-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <EmptyState icon={Inbox} title={filter === 'unread' ? 'No unread notifications' : 'No notifications yet'} description="Status updates on your complaints, assignments and escalation alerts will appear here." />
      ) : (
        <div className="card divide-y divide-slate-100 dark:divide-carbon-800 overflow-hidden">
          {list.map(n => (
            <div key={n._id} className={`flex gap-4 p-4 sm:p-5 transition ${n.isRead ? '' : 'bg-tealbrand-50/40 dark:bg-tealbrand-900/10'}`}>
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${TONE[n.type] || TONE.info}`}>
                {n.isRead ? <Bell size={18} /> : <BellRing size={18} />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <p className={`text-sm ${n.isRead ? 'text-slate-700 dark:text-slate-300' : 'font-semibold text-navy-900 dark:text-white'}`}>{n.title}</p>
                  <span className="text-[11px] text-slate-400 whitespace-nowrap">{timeAgo(n.createdAt)}</span>
                </div>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{n.message}</p>
                <div className="mt-2 flex items-center gap-3">
                  {n.complaint && (
                    <Link to={`/complaints/${n.complaint}`} className="text-xs font-medium text-tealbrand-700 dark:text-tealbrand-400 hover:underline">View complaint</Link>
                  )}
                  {!n.isRead && (
                    <button onClick={() => markRead(n._id)} className="text-xs font-medium text-slate-500 hover:text-navy-700 dark:hover:text-white flex items-center gap-1"><Check size={12} /> Mark read</button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
