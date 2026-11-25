import { Link } from 'react-router-dom';
import { ArrowRight, Camera, MapPin, ShieldCheck, BarChart3, Bell, CheckCircle2, Building2, Users, Clock, ChevronRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { roleHome } from '../utils/helpers';

const stats = [
  { label: 'Issues Reported', value: '12,400+' },
  { label: 'Resolution Rate', value: '94%' },
  { label: 'Avg. Response', value: '36 hrs' },
  { label: 'Departments', value: '25+' },
];
const features = [
  { icon: Camera, title: 'Live Evidence Capture', desc: 'Capture photos or videos directly from your device and attach them to complaints for faster verification.' },
  { icon: MapPin, title: 'Precise Geo-Location', desc: 'Auto-detect GPS coordinates with map-based correction so authorities reach the exact issue location.' },
  { icon: ShieldCheck, title: 'Hierarchical Escalation', desc: 'Complaints flow through municipal, ward, and government levels with transparent accountability.' },
  { icon: BarChart3, title: 'Smart Analytics', desc: 'Role-based dashboards with ward-wise, department-wise, and city-wide performance insights.' },
  { icon: Bell, title: 'Real-time Updates', desc: 'Get notified on submission, status changes, assignments, deadlines, and resolution outcomes.' },
  { icon: CheckCircle2, title: 'Feedback & Reopen', desc: 'Rate resolutions and reopen unresolved issues with verification to ensure real closure.' },
];
const steps = [
  { n: '01', title: 'Report the Issue', desc: 'Capture evidence, pin location, choose category and severity, then submit securely.' },
  { n: '02', title: 'Authorities Act', desc: 'Municipal teams verify and assign; ward officers monitor; escalations reach superiors when needed.' },
  { n: '03', title: 'Track to Resolution', desc: 'Follow the live timeline, receive updates, and confirm resolution with feedback.' },
];

export default function Landing() {
  const { user } = useAuth();
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-navy-950 text-slate-800 dark:text-slate-100">
      <header className="sticky top-0 z-40 border-b border-slate-200/60 dark:border-navy-700/60 bg-white/80 dark:bg-navy-950/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-navy-700 to-tealbrand-600 text-white font-bold flex items-center justify-center">CT</div>
            <span className="font-bold text-xl text-navy-800 dark:text-white">CivicTrack</span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm text-slate-600 dark:text-slate-300">
            <a href="#features" className="hover:text-navy-700 dark:hover:text-white">Features</a>
            <a href="#how" className="hover:text-navy-700 dark:hover:text-white">How it works</a>
            <a href="#impact" className="hover:text-navy-700 dark:hover:text-white">Impact</a>
          </nav>
          <div className="flex items-center gap-3">
            {user ? (
              <Link to={roleHome(user.role)} className="btn-primary">Go to Dashboard <ArrowRight size={16}/></Link>
            ) : (<>
              <Link to="/login" className="btn-secondary hidden sm:inline-flex">Sign in</Link>
              <Link to="/register" className="btn-primary">Get Started <ArrowRight size={16}/></Link>
            </>)}
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-tealbrand-100/60 via-transparent to-transparent dark:from-tealbrand-900/10" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28 relative">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-tealbrand-50 dark:bg-tealbrand-900/20 text-tealbrand-700 dark:text-tealbrand-300 px-4 py-1.5 text-sm font-medium mb-6">
                <ShieldCheck size={16}/> Transparent civic governance
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight text-navy-900 dark:text-white">
                Report civic issues. <span className="text-transparent bg-clip-text bg-gradient-to-r from-tealbrand-600 to-navy-600">Track real action.</span>
              </h1>
              <p className="mt-6 text-lg text-slate-600 dark:text-slate-300 max-w-xl">
                CivicTrack connects citizens with municipal authorities through a transparent, accountable platform for reporting, monitoring, and resolving public infrastructure problems.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <Link to={user ? roleHome(user.role) : '/register'} className="btn-accent px-6 py-3 text-base">
                  {user ? 'Open Dashboard' : 'Report an Issue'} <ArrowRight size={18}/>
                </Link>
                <a href="#how" className="btn-secondary px-6 py-3 text-base">See how it works</a>
              </div>
              <div className="mt-10 flex items-center gap-6 text-sm text-slate-500 dark:text-slate-400">
                <div className="flex items-center gap-2"><CheckCircle2 size={16} className="text-tealbrand-600"/> Secure & role-based</div>
                <div className="flex items-center gap-2"><CheckCircle2 size={16} className="text-tealbrand-600"/> Real-time tracking</div>
              </div>
            </div>
            <div className="relative">
              <div className="card p-6 lg:p-8">
                <div className="flex items-center justify-between mb-6">
                  <div><p className="text-sm text-slate-500">Live Complaint Overview</p><p className="text-xl font-bold text-navy-800 dark:text-white">City Operations</p></div>
                  <span className="badge bg-emerald-100 text-emerald-700">Live</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {[{l:'Total',v:'1,284',c:'text-navy-700 dark:text-white'},{l:'Pending',v:'142',c:'text-amber-600'},{l:'In Progress',v:'87',c:'text-cyan-600'},{l:'Resolved',v:'1,031',c:'text-emerald-600'}].map(s=>(
                    <div key={s.l} className="rounded-xl bg-slate-50 dark:bg-navy-800 p-4"><p className="text-sm text-slate-500">{s.l}</p><p className={`text-2xl font-bold ${s.c}`}>{s.v}</p></div>
                  ))}
                </div>
                <div className="mt-5 space-y-3">
                  {[{t:'Pothole on Main St',s:'In Progress',d:'Ward 5'},{t:'Streetlight not working',s:'Assigned',d:'Ward 2'}].map((c,i)=>(
                    <div key={i} className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-navy-700 p-3">
                      <div><p className="text-sm font-medium text-navy-800 dark:text-white">{c.t}</p><p className="text-xs text-slate-500">{c.d}</p></div>
                      <span className={`badge ${c.s==='In Progress'?'bg-cyan-100 text-cyan-700':'bg-indigo-100 text-indigo-700'}`}>{c.s}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="absolute -bottom-4 -left-4 card p-4 flex items-center gap-3 shadow-card-hover">
                <div className="h-10 w-10 rounded-xl bg-tealbrand-100 text-tealbrand-700 flex items-center justify-center"><Clock size={20}/></div>
                <div><p className="text-xs text-slate-500">Avg. resolution</p><p className="font-bold text-navy-800 dark:text-white">36 hours</p></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="impact" className="py-10 border-y border-slate-200/60 dark:border-navy-800 bg-white dark:bg-navy-900/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-2 md:grid-cols-4 gap-6">
          {stats.map(s => (<div key={s.label} className="text-center"><p className="text-3xl font-extrabold text-navy-800 dark:text-white">{s.value}</p><p className="text-sm text-slate-500 mt-1">{s.label}</p></div>))}
        </div>
      </section>

      <section id="features" className="py-20 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <p className="text-sm font-semibold text-tealbrand-600 uppercase tracking-wider">Platform Features</p>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-navy-900 dark:text-white">Built for citizens and authorities</h2>
            <p className="mt-4 text-slate-600 dark:text-slate-300">Everything needed to report, manage, escalate, and resolve civic issues with accountability.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map(f => (
              <div key={f.title} className="card p-6 hover:shadow-card-hover transition-all hover:-translate-y-0.5">
                <div className="h-12 w-12 rounded-xl bg-tealbrand-50 dark:bg-tealbrand-900/20 text-tealbrand-700 dark:text-tealbrand-300 flex items-center justify-center mb-4"><f.icon size={22}/></div>
                <h3 className="font-semibold text-lg text-navy-800 dark:text-white">{f.title}</h3>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how" className="py-20 bg-navy-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <p className="text-sm font-semibold text-tealbrand-400 uppercase tracking-wider">How it works</p>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold">From report to resolution</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {steps.map(s => (
              <div key={s.n} className="relative rounded-2xl border border-white/10 bg-white/5 p-6">
                <div className="text-4xl font-extrabold text-tealbrand-400/40 mb-4">{s.n}</div>
                <h3 className="text-xl font-semibold">{s.title}</h3>
                <p className="mt-3 text-slate-300 text-sm leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="card p-8 lg:p-12 bg-gradient-to-r from-navy-800 to-navy-700 text-white border-0 flex flex-col lg:flex-row items-center justify-between gap-8">
            <div>
              <h2 className="text-3xl font-bold">Make your city more responsive.</h2>
              <p className="mt-3 text-slate-200 max-w-xl">Join CivicTrack to report issues, track progress transparently, and help authorities prioritize what matters.</p>
            </div>
            <Link to={user ? roleHome(user.role) : '/register'} className="btn-accent px-6 py-3 text-base whitespace-nowrap">Create account <ChevronRight size={18}/></Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 dark:border-navy-800 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-500">
          <div className="flex items-center gap-2"><div className="h-8 w-8 rounded-lg bg-navy-700 text-white flex items-center justify-center font-bold text-xs">CT</div><span>CivicTrack</span></div>
          <p>Transparent civic issue reporting & management.</p>
        </div>
      </footer>
    </div>
  );
}
