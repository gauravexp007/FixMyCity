import { useState } from 'react';
import { User, Lock, Moon, Sun, Bell, ShieldCheck, Loader2, Save, Building2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

import { fmtDateTime } from '../utils/helpers';

export default function SettingsPage() {
  const { user, updateUser } = useAuth();
  const { dark, toggle } = useTheme();
  const [profile, setProfile] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    avatar: user?.avatar || '',
    notificationPreferences: {
      email: user?.notificationPreferences?.email ?? true,
      inApp: user?.notificationPreferences?.inApp ?? true,
    },
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [pwd, setPwd] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [savingPwd, setSavingPwd] = useState(false);

  const saveProfile = async (e) => {
    e.preventDefault();
    if (!profile.name.trim()) return toast.error('Name cannot be empty');
    setSavingProfile(true);
    try {
      const { data } = await api.patch('/auth/profile', profile);
      updateUser(data.user);
      toast.success('Profile updated');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not update profile');
    } finally { setSavingProfile(false); }
  };

  const savePassword = async (e) => {
    e.preventDefault();
    if (pwd.newPassword.length < 8) return toast.error('New password must be at least 8 characters');
    if (pwd.newPassword !== pwd.confirmPassword) return toast.error('Passwords do not match');
    setSavingPwd(true);
    try {
      await api.post('/auth/change-password', { currentPassword: pwd.currentPassword, newPassword: pwd.newPassword });
      toast.success('Password changed');
      setPwd({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not change password');
    } finally { setSavingPwd(false); }
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy-900 dark:text-white">Profile & settings</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Manage your account details, security and display preferences.</p>
      </div>

      <div className="card p-6 flex flex-col sm:flex-row sm:items-center gap-5">
        <div className="h-16 w-16 rounded-2xl bg-navy-700 text-white flex items-center justify-center text-2xl font-bold shrink-0 overflow-hidden">
          {profile.avatar ? <img src={profile.avatar} alt="" className="h-full w-full object-cover" /> : (user?.name || 'U').charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-navy-900 dark:text-white">{user?.name}</h2>
          <p className="text-sm text-slate-500">{user?.email}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="badge bg-navy-50 text-navy-700 dark:bg-navy-800 dark:text-slate-200 capitalize">{user?.role?.replace('_', ' ')}</span>
            {user?.isApproved ? <span className="badge bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">Verified account</span> : <span className="badge bg-amber-50 text-amber-700">Pending approval</span>}
            {user?.isSeed && <span className="badge bg-violet-50 text-violet-700">Demo account</span>}
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <form onSubmit={saveProfile} className="card p-6 space-y-4">
          <h2 className="font-semibold text-navy-800 dark:text-white flex items-center gap-2"><User size={18} /> Personal information</h2>
          <div><label className="label">Full name</label><input className="input" value={profile.name} onChange={e => setProfile(p => ({ ...p, name: e.target.value }))} required maxLength={100} /></div>
          <div><label className="label">Email</label><input className="input bg-slate-50 dark:bg-navy-800" value={user?.email || ''} disabled /><p className="mt-1 text-[11px] text-slate-500">Email changes require an administrator.</p></div>
          <div><label className="label">Phone</label><input className="input" value={profile.phone} onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))} placeholder="+91 98765 43210" /></div>
          <div><label className="label">Avatar image URL</label><input className="input" value={profile.avatar} onChange={e => setProfile(p => ({ ...p, avatar: e.target.value }))} placeholder="https://..." /></div>
          <button disabled={savingProfile} className="btn-primary w-full">{savingProfile ? <><Loader2 size={16} className="animate-spin" /> Saving...</> : <><Save size={16} /> Save changes</>}</button>
        </form>

        <div className="space-y-6">
          <div className="card p-6">
            <h2 className="font-semibold text-navy-800 dark:text-white flex items-center gap-2 mb-4"><Building2 size={18} /> Jurisdiction</h2>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-slate-500">Municipality</dt><dd className="font-medium text-navy-800 dark:text-white text-right">{user?.municipality || '—'}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-500">Ward</dt><dd className="font-medium text-navy-800 dark:text-white text-right">{user?.ward || '—'}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-500">Department</dt><dd className="font-medium text-navy-800 dark:text-white text-right">{user?.department || '—'}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-500">Last login</dt><dd className="font-medium text-navy-800 dark:text-white text-right">{user?.lastLoginAt ? fmtDateTime(user.lastLoginAt) : '—'}</dd></div>
            </dl>
            <p className="mt-4 flex items-start gap-2 text-[11px] text-slate-500"><ShieldCheck size={14} className="shrink-0 mt-0.5" /> Jurisdiction and role are assigned by an authorized administrator and cannot be self-edited.</p>
          </div>

          <div className="card p-6">
            <h2 className="font-semibold text-navy-800 dark:text-white flex items-center gap-2 mb-4"><Bell size={18} /> Notifications</h2>
            {[{ k: 'inApp', label: 'In-app notifications', desc: 'Status changes, assignments and escalations' }, { k: 'email', label: 'Email notifications', desc: 'Deadline reminders and resolution updates' }].map(o => (
              <label key={o.k} className="flex items-start gap-3 py-2 cursor-pointer">
                <input type="checkbox" className="mt-1 h-4 w-4 rounded border-slate-300 text-tealbrand-600 focus:ring-tealbrand-500"
                  checked={profile.notificationPreferences[o.k]}
                  onChange={e => setProfile(p => ({ ...p, notificationPreferences: { ...p.notificationPreferences, [o.k]: e.target.checked } }))} />
                <span><span className="block text-sm font-medium text-navy-800 dark:text-white">{o.label}</span><span className="block text-xs text-slate-500">{o.desc}</span></span>
              </label>
            ))}
            <button onClick={saveProfile} disabled={savingProfile} className="btn-secondary w-full mt-3">{savingProfile ? 'Saving...' : 'Save preferences'}</button>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <form onSubmit={savePassword} className="card p-6 space-y-4">
          <h2 className="font-semibold text-navy-800 dark:text-white flex items-center gap-2"><Lock size={18} /> Change password</h2>
          <div><label className="label">Current password</label><input type="password" className="input" value={pwd.currentPassword} onChange={e => setPwd(p => ({ ...p, currentPassword: e.target.value }))} required autoComplete="current-password" /></div>
          <div><label className="label">New password</label><input type="password" className="input" value={pwd.newPassword} onChange={e => setPwd(p => ({ ...p, newPassword: e.target.value }))} required minLength={8} autoComplete="new-password" /><p className="mt-1 text-[11px] text-slate-500">At least 8 characters.</p></div>
          <div><label className="label">Confirm new password</label><input type="password" className="input" value={pwd.confirmPassword} onChange={e => setPwd(p => ({ ...p, confirmPassword: e.target.value }))} required autoComplete="new-password" /></div>
          <button disabled={savingPwd} className="btn-primary w-full">{savingPwd ? <><Loader2 size={16} className="animate-spin" /> Updating...</> : 'Update password'}</button>
        </form>

        <div className="card p-6">
          <h2 className="font-semibold text-navy-800 dark:text-white flex items-center gap-2 mb-4">{dark ? <Moon size={18} /> : <Sun size={18} />} Appearance</h2>
          <div className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-navy-700 p-4">
            <div>
              <p className="text-sm font-medium text-navy-800 dark:text-white">Dark mode</p>
              <p className="text-xs text-slate-500">Switch between light and dark interface.</p>
            </div>
            <button onClick={toggle} role="switch" aria-checked={dark} aria-label="Toggle dark mode"
              className={`relative h-7 w-12 rounded-full transition ${dark ? 'bg-tealbrand-500' : 'bg-slate-300'}`}>
              <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${dark ? 'left-6' : 'left-1'}`} />
            </button>
          </div>
          <div className="mt-4 rounded-xl bg-slate-50 dark:bg-navy-800 p-4">
            <p className="text-xs text-slate-500 dark:text-slate-400">Your theme preference is stored on this device only. Complaint data and account security are unaffected.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
