import { useEffect, useState } from 'react';
import { UserPlus, Search, ShieldCheck, Building2, CheckCircle2, XCircle, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { ROLE_LABELS, DEPARTMENTS } from '../../utils/constants';
import { PageSkeleton } from '../../components/ui/Skeleton';
import EmptyState from '../../components/ui/EmptyState';
import { fmtDate } from '../../utils/helpers';

const emptyForm = { name: '', email: '', password: '', role: 'municipal', department: '', municipality: '', ward: '', phone: '' };

export default function AuthoritiesPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const params = {};
      if (search) params.search = search;
      if (roleFilter) params.role = roleFilter;
      const { data } = await api.get('/admin/users', { params });
      setUsers(data.users);
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to load users'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [roleFilter]);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await api.post('/admin/users', form);
      toast.success(data.message || 'Authority provisioned');
      setShowModal(false); setForm(emptyForm); load();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to provision authority'); }
    finally { setSaving(false); }
  };

  const toggle = async (u, key) => {
    try {
      const { data } = await api.patch(`/admin/users/${u._id}`, { [key]: !u[key] });
      setUsers(prev => prev.map(x => x._id === u._id ? data.user : x));
      toast.success('User updated');
    } catch (err) { toast.error(err.response?.data?.message || 'Update failed'); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy-900 dark:text-white">Authority Management</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Provision and verify municipal, ward and superior authority accounts.</p>
        </div>
        <button onClick={()=>setShowModal(true)} className="btn-accent whitespace-nowrap"><UserPlus size={18}/> Provision Authority</button>
      </div>

      <div className="card p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
          <input className="input pl-10" placeholder="Search by name or email" value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={e=>e.key==='Enter'&&load()} />
        </div>
        <select className="input sm:w-56" value={roleFilter} onChange={e=>setRoleFilter(e.target.value)}>
          <option value="">All roles</option>
          <option value="municipal">Municipal Authority</option>
          <option value="ward_officer">Ward Officer</option>
          <option value="superior">Government Superior</option>
          <option value="citizen">Citizen</option>
        </select>
        <button onClick={load} className="btn-secondary">Search</button>
      </div>

      {loading ? <PageSkeleton /> : users.length === 0 ? (
        <EmptyState icon={ShieldCheck} title="No users found" description="Provision an authority account or adjust your filters." action={<button onClick={()=>setShowModal(true)} className="btn-primary">Provision Authority</button>} />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-navy-800/60 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Jurisdiction</th>
                  <th className="px-4 py-3 font-medium">Department</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Joined</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-navy-800">
                {users.map(u => (
                  <tr key={u._id} className="hover:bg-slate-50 dark:hover:bg-navy-800/40">
                    <td className="px-4 py-3"><p className="font-medium text-navy-800 dark:text-white">{u.name}</p><p className="text-xs text-slate-500">{u.email}</p></td>
                    <td className="px-4 py-3"><span className="badge bg-navy-50 text-navy-700 dark:bg-navy-800 dark:text-slate-200">{ROLE_LABELS[u.role]}</span></td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{[u.jurisdiction?.municipality, u.jurisdiction?.ward].filter(Boolean).join(' · ') || '—'}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{u.department || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`badge ${u.isApproved && u.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                        {u.isApproved && u.isActive ? 'Active' : 'Restricted'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{fmtDate(u.createdAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button title={u.isApproved?'Revoke approval':'Approve'} onClick={()=>toggle(u,'isApproved')} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-700 text-slate-500">
                          {u.isApproved?<XCircle size={17}/>:<CheckCircle2 size={17}/>}
                        </button>
                        <button title={u.isActive?'Deactivate':'Activate'} onClick={()=>toggle(u,'isActive')} className={`p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-700 ${u.isActive?'text-rose-500':'text-emerald-600'}`}>
                          <ShieldCheck size={17}/>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={()=>setShowModal(false)} />
          <div className="relative card w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <div><h2 className="text-lg font-bold text-navy-800 dark:text-white">Provision Authority Account</h2><p className="text-xs text-slate-500 mt-0.5">Account is created verified and approved.</p></div>
              <button onClick={()=>setShowModal(false)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-800"><X size={18}/></button>
            </div>
            <form onSubmit={submit} className="space-y-4">
              <div><label className="label">Full name</label><input className="input" required value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></div>
              <div><label className="label">Official email</label><input type="email" className="input" required value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></div>
              <div><label className="label">Temporary password</label><input type="text" minLength={8} className="input" required value={form.password} onChange={e=>setForm({...form,password:e.target.value})} placeholder="At least 8 characters"/></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Role</label>
                  <select className="input" value={form.role} onChange={e=>setForm({...form,role:e.target.value})}>
                    <option value="municipal">Municipal Authority</option>
                    <option value="ward_officer">Ward Officer</option>
                    <option value="superior">Government Superior</option>
                  </select>
                </div>
                <div><label className="label">Department</label>
                  <select className="input" value={form.department} onChange={e=>setForm({...form,department:e.target.value})}>
                    <option value="">None</option>
                    {DEPARTMENTS.map(d=><option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Municipality</label><input className="input" value={form.municipality} onChange={e=>setForm({...form,municipality:e.target.value})} placeholder="e.g. Central City"/></div>
                <div><label className="label">Ward</label><input className="input" value={form.ward} onChange={e=>setForm({...form,ward:e.target.value})} placeholder="e.g. Ward 5"/></div>
              </div>
              <div><label className="label">Phone</label><input className="input" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/></div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={()=>setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button disabled={saving} className="btn-accent flex-1">{saving?'Creating...':'Create authority'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
