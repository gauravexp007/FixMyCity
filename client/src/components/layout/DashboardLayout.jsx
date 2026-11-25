import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LayoutDashboard, FilePlus2, ListChecks, Map, Bell, Settings, LogOut, Menu, X, Shield, Building2, Landmark, Users, ChevronLeft, Sun, Moon, Camera } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { ROLE_LABELS } from '../../utils/constants';
import { roleHome } from '../../utils/helpers';

const navByRole = {
  citizen: [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/report', label: 'Report Issue', icon: FilePlus2 },
    { to: '/complaints', label: 'My Complaints', icon: ListChecks },
    { to: '/evidence', label: 'My Evidence', icon: Camera },
    { to: '/map', label: 'Complaint Map', icon: Map },
    { to: '/notifications', label: 'Notifications', icon: Bell },
    { to: '/settings', label: 'Profile & Settings', icon: Settings },
  ],
  municipal: [
    { to: '/dashboard/municipal', label: 'Dashboard', icon: Building2, end: true },
    { to: '/complaints', label: 'Complaints', icon: ListChecks },
    { to: '/evidence', label: 'Evidence Feed', icon: Camera },
    { to: '/map', label: 'Map View', icon: Map },
    { to: '/notifications', label: 'Notifications', icon: Bell },
    { to: '/settings', label: 'Profile & Settings', icon: Settings },
  ],
  ward_officer: [
    { to: '/dashboard/ward', label: 'Ward Dashboard', icon: Shield, end: true },
    { to: '/complaints', label: 'Ward Complaints', icon: ListChecks },
    { to: '/evidence', label: 'Evidence Feed', icon: Camera },
    { to: '/map', label: 'Map View', icon: Map },
    { to: '/notifications', label: 'Notifications', icon: Bell },
    { to: '/settings', label: 'Profile & Settings', icon: Settings },
  ],
  superior: [
    { to: '/dashboard/government', label: 'Overview', icon: Landmark, end: true },
    { to: '/complaints', label: 'All Complaints', icon: ListChecks },
    { to: '/evidence', label: 'Evidence Feed', icon: Camera },
    { to: '/dashboard/government/authorities', label: 'Authorities', icon: Users },
    { to: '/map', label: 'Map View', icon: Map },
    { to: '/notifications', label: 'Notifications', icon: Bell },
    { to: '/settings', label: 'Profile & Settings', icon: Settings },
  ],
};

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const { dark, toggle } = useTheme();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const items = navByRole[user?.role] || navByRole.citizen;

  const onLogout = () => { logout(); navigate('/login'); };

  const SidebarContent = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-4 py-5 border-b border-slate-200/70 dark:border-carbon-700">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-navy-700 to-tealbrand-600 flex items-center justify-center text-white font-bold">CT</div>
        {!collapsed && <div><div className="font-bold text-navy-800 dark:text-white leading-tight">CivicTrack</div><div className="text-[11px] text-slate-500 dark:text-slate-400">{ROLE_LABELS[user?.role]}</div></div>}
      </div>
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {items.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} onClick={() => setOpen(false)}
            className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${isActive ? 'bg-navy-700 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-carbon-800'}`}>
            <Icon size={18} /> {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>
      <div className="p-3 border-t border-slate-200/70 dark:border-carbon-700 space-y-1">
        <button onClick={toggle} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-carbon-800">
          {dark ? <Sun size={18}/> : <Moon size={18}/>} {!collapsed && <span>{dark ? 'Light mode' : 'Dark mode'}</span>}
        </button>
        <button onClick={onLogout} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30">
          <LogOut size={18} /> {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-carbon-950 text-slate-800 dark:text-slate-100">
      <div className={`fixed inset-y-0 left-0 z-40 hidden lg:block border-r border-slate-200/70 dark:border-carbon-700 bg-white dark:bg-carbon-900 transition-all ${collapsed ? 'w-20' : 'w-64'}`}>
        {SidebarContent}
        <button onClick={() => setCollapsed(c=>!c)} className="absolute -right-3 top-20 h-6 w-6 rounded-full border border-slate-200 dark:border-carbon-600 bg-white dark:bg-carbon-800 flex items-center justify-center text-slate-500"><ChevronLeft size={14} className={collapsed?'rotate-180':''}/></button>
      </div>
      {open && <div className="fixed inset-0 z-40 lg:hidden"><div className="absolute inset-0 bg-black/40" onClick={()=>setOpen(false)}/><div className="absolute inset-y-0 left-0 w-72 bg-white dark:bg-carbon-900 border-r border-slate-200 dark:border-carbon-700">{SidebarContent}</div></div>}
      <div className={`${collapsed?'lg:pl-20':'lg:pl-64'} transition-all`}>
        <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-slate-200/70 dark:border-carbon-700 bg-white/80 dark:bg-carbon-950/80 backdrop-blur px-4 lg:px-8 py-4">
          <div className="flex items-center gap-3">
            <button className="lg:hidden p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-carbon-800" onClick={()=>setOpen(true)}><Menu size={20}/></button>
            <div>
              <div className="text-sm text-slate-500 dark:text-slate-400">Welcome back</div>
              <div className="font-semibold text-navy-800 dark:text-white">{user?.name}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <NavLink to="/notifications" className="p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-carbon-800 text-slate-600 dark:text-slate-300"><Bell size={19}/></NavLink>
            <button onClick={toggle} className="p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-carbon-800 text-slate-600 dark:text-slate-300">{dark?<Sun size={19}/>:<Moon size={19}/>}</button>
            <div onClick={()=>navigate(roleHome(user?.role))} className="h-9 w-9 rounded-xl bg-tealbrand-600 text-white flex items-center justify-center font-semibold cursor-pointer">{user?.name?.[0]?.toUpperCase()||'U'}</div>
          </div>
        </header>
        <main className="p-4 lg:p-8"><Outlet /></main>
      </div>
    </div>
  );
}
