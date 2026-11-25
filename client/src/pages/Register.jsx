import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, UserPlus } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import GoogleIcon from '../components/ui/GoogleIcon';
import { roleHome, googleAuthErrorMessage } from '../utils/helpers';

export default function Register() {
  const { user, register, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleBlocked, setGoogleBlocked] = useState('');
  const [form, setForm] = useState({ name: '', email: '', phone: '', municipality: '', ward: '', password: '', confirm: '' });

  if (user) return <Navigate to={roleHome(user.role)} replace />;
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    if (form.password.length < 8) return toast.error('Password must be at least 8 characters');
    if (form.password !== form.confirm) return toast.error('Passwords do not match');
    setLoading(true);
    try {
      const u = await register({ name: form.name, email: form.email, phone: form.phone, municipality: form.municipality, ward: form.ward, password: form.password });
      toast.success('Account created successfully');
      navigate(roleHome(u.role), { replace: true });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed');
    } finally { setLoading(false); }
  };

  const googleSubmit = async () => {
    setGoogleLoading(true);
    try {
      const u = await loginWithGoogle();
      setGoogleBlocked('');
      toast.success('Account ready with Google');
      navigate(roleHome(u.role), { replace: true });
    } catch (err) {
      if (err?.code === 'auth/unauthorized-domain') setGoogleBlocked(window.location.host);
      toast.error(googleAuthErrorMessage(err));
    } finally { setGoogleLoading(false); }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-slate-50 dark:bg-carbon-950">
      <div className="hidden lg:flex flex-col justify-between bg-navy-900 text-white p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,_rgba(5,200,165,0.25),_transparent_45%)]" />
        <Link to="/" className="flex items-center gap-3 relative"><div className="h-11 w-11 rounded-xl bg-tealbrand-600 flex items-center justify-center font-bold">CT</div><span className="text-2xl font-bold">CivicTrack</span></Link>
        <div className="relative">
          <h1 className="text-4xl font-bold leading-tight">Report issues that matter in your community.</h1>
          <p className="mt-4 text-slate-300 max-w-md">Create a citizen account to submit complaints, upload evidence, track status, and give feedback after resolution.</p>
        </div>
        <p className="text-sm text-slate-400 relative">Authority accounts are provisioned and verified by administrators.</p>
      </div>
      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md">
          <Link to="/" className="lg:hidden flex items-center gap-2 mb-8"><div className="h-9 w-9 rounded-xl bg-navy-700 text-white flex items-center justify-center font-bold">CT</div><span className="font-bold text-xl text-navy-800 dark:text-white">CivicTrack</span></Link>
          <h2 className="text-3xl font-bold text-navy-900 dark:text-white">Create citizen account</h2>
          <p className="mt-2 text-slate-500 dark:text-slate-400">Only citizen self-registration is available. Authority accounts are provisioned by administrators.</p>
          <button type="button" onClick={googleSubmit} disabled={googleLoading || loading}
            className="mt-8 flex w-full items-center justify-center gap-3 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-carbon-600 dark:bg-carbon-800 dark:text-white dark:hover:bg-carbon-700">
            <GoogleIcon />
            {googleLoading ? 'Opening Google…' : 'Sign up with Google'}
          </button>
          {googleBlocked && (
            <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
              <p className="font-semibold">Google sign-up is blocked on <span className="font-mono">{googleBlocked}</span></p>
              <p className="mt-1">Add that exact address in Firebase → Authentication → Settings → Authorized domains, then reload. Email sign-up works right now.</p>
            </div>
          )}
          <div className="my-5 flex items-center gap-3 text-[11px] font-medium uppercase tracking-wider text-slate-400">
            <span className="h-px flex-1 bg-slate-200 dark:bg-carbon-700" />
            or create an email account
            <span className="h-px flex-1 bg-slate-200 dark:bg-carbon-700" />
          </div>
          <form onSubmit={submit} className="space-y-4">
            <div><label className="label">Full name</label><input className="input" required value={form.name} onChange={set('name')} placeholder="Your name" /></div>
            <div><label className="label">Email</label><input className="input" type="email" required value={form.email} onChange={set('email')} placeholder="you@example.com" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="label">Phone</label><input className="input" value={form.phone} onChange={set('phone')} placeholder="Optional" /></div>
              <div><label className="label">Ward</label><input className="input" value={form.ward} onChange={set('ward')} placeholder="e.g. Ward 5" /></div>
            </div>
            <div><label className="label">Municipality / City</label><input className="input" value={form.municipality} onChange={set('municipality')} placeholder="e.g. Central City" /></div>
            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input className="input pr-11" type={show?'text':'password'} required minLength={8} value={form.password} onChange={set('password')} placeholder="At least 8 characters" />
                <button type="button" onClick={()=>setShow(s=>!s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">{show?<EyeOff size={18}/>:<Eye size={18}/>}</button>
              </div>
            </div>
            <div><label className="label">Confirm password</label><input className="input" type={show?'text':'password'} required value={form.confirm} onChange={set('confirm')} placeholder="Re-enter password" /></div>
            <button disabled={loading} className="btn-primary w-full py-3">{loading ? 'Creating account...' : <><UserPlus size={18}/> Create account</>}</button>
          </form>
          <p className="mt-6 text-sm text-slate-500">Already have an account? <Link to="/login" className="text-tealbrand-700 dark:text-tealbrand-400 font-medium hover:underline">Sign in</Link></p>
        </div>
      </div>
    </div>
  );
}
