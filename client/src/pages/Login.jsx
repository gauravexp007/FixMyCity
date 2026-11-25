import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, LogIn, Shield } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { roleHome } from '../utils/helpers';

export default function Login() {
  const { user, login, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  if (user) return <Navigate to={roleHome(user.role)} replace />;

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const u = await login(form.email, form.password);
      toast.success('Signed in successfully');
      const dest = location.state?.from?.pathname || roleHome(u.role);
      navigate(dest, { replace: true });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed');
    } finally { setLoading(false); }
  };

  const googleSubmit = async () => {
    setGoogleLoading(true);
    try {
      const u = await loginWithGoogle();
      toast.success('Signed in with Google');
      const dest = location.state?.from?.pathname || roleHome(u.role);
      navigate(dest, { replace: true });
    } catch (err) {
      toast.error(googleErrorMessage(err));
    } finally { setGoogleLoading(false); }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-slate-50 dark:bg-carbon-950">
      <div className="hidden lg:flex flex-col justify-between bg-navy-900 text-white p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(5,200,165,0.25),_transparent_45%)]" />
        <Link to="/" className="flex items-center gap-3 relative"><div className="h-11 w-11 rounded-xl bg-tealbrand-600 flex items-center justify-center font-bold">CT</div><span className="text-2xl font-bold">CivicTrack</span></Link>
        <div className="relative">
          <h1 className="text-4xl font-bold leading-tight">A transparent bridge between citizens and government.</h1>
          <p className="mt-4 text-slate-300 max-w-md">Report civic issues, track resolution timelines, and hold authorities accountable through one secure platform.</p>
          <div className="mt-8 space-y-3 text-sm text-slate-200">
            {['Role-based secure access', 'Live status tracking', 'Escalation and accountability'].map(t => <div key={t} className="flex items-center gap-2"><Shield size={16} className="text-tealbrand-400"/> {t}</div>)}
          </div>
        </div>
        <p className="text-sm text-slate-400 relative">Government authority accounts are provisioned by authorized administrators.</p>
      </div>
      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md">
          <Link to="/" className="lg:hidden flex items-center gap-2 mb-8"><div className="h-9 w-9 rounded-xl bg-navy-700 text-white flex items-center justify-center font-bold">CT</div><span className="font-bold text-xl text-navy-800 dark:text-white">CivicTrack</span></Link>
          <h2 className="text-3xl font-bold text-navy-900 dark:text-white">Sign in</h2>
          <p className="mt-2 text-slate-500 dark:text-slate-400">Access your CivicTrack dashboard.</p>
          <button type="button" onClick={googleSubmit} disabled={googleLoading || loading}
            className="mt-8 flex w-full items-center justify-center gap-3 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-carbon-600 dark:bg-carbon-800 dark:text-white dark:hover:bg-carbon-700">
            <GoogleIcon />
            {googleLoading ? 'Opening Google…' : 'Continue with Google'}
          </button>
          <div className="my-5 flex items-center gap-3 text-[11px] font-medium uppercase tracking-wider text-slate-400">
            <span className="h-px flex-1 bg-slate-200 dark:bg-carbon-700" />
            or sign in with email
            <span className="h-px flex-1 bg-slate-200 dark:bg-carbon-700" />
          </div>
          <form onSubmit={submit} className="space-y-5">
            <div><label className="label">Email address</label><input className="input" type="email" required value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="you@example.com" /></div>
            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input className="input pr-11" type={show?'text':'password'} required value={form.password} onChange={e=>setForm({...form,password:e.target.value})} placeholder="Enter your password" />
                <button type="button" onClick={()=>setShow(s=>!s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">{show?<EyeOff size={18}/>:<Eye size={18}/>}</button>
              </div>
            </div>
            <button disabled={loading} className="btn-primary w-full py-3">{loading ? 'Signing in...' : <><LogIn size={18}/> Sign in</>}</button>
          </form>
          <p className="mt-6 text-sm text-slate-500">New citizen? <Link to="/register" className="text-tealbrand-700 dark:text-tealbrand-400 font-medium hover:underline">Create an account</Link></p>
          <div className="mt-8 card p-4 text-xs text-slate-500 dark:text-slate-400">
            <p className="font-medium text-slate-700 dark:text-slate-300 mb-1">Verified against the database</p>
            <p>Sign in with Google or your email password. Accounts and every report are stored in the CivicTrack Firebase database.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47a5.57 5.57 0 0 1-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A11.99 11.99 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.27 14.29a7.2 7.2 0 0 1 0-4.58V6.62H1.29a11.99 11.99 0 0 0 0 10.76l3.98-3.09z" />
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z" />
    </svg>
  );
}

function googleErrorMessage(error) {
  const code = error?.code || '';
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return 'Google sign-in was cancelled';
  if (code === 'auth/popup-blocked') return 'Your browser blocked the Google popup. Allow pop-ups and try again.';
  if (code === 'auth/unauthorized-domain') return 'Google sign-in is not allowed on this domain yet. Add it in Firebase → Authentication → Settings → Authorized domains.';
  if (code === 'auth/operation-not-allowed') return 'Google sign-in is disabled in Firebase Authentication. Enable the Google provider.';
  if (code === 'auth/network-request-failed') return 'Network error while contacting Google. Check your connection.';
  return error?.response?.data?.message || error?.message || 'Google sign-in failed';
}
