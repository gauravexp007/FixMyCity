export const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';
export const fmtDateTime = (d) => d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';
export const timeAgo = (d) => {
  if (!d) return '';
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s/60); if (m < 60) return `${m}m ago`;
  const h = Math.floor(m/60); if (h < 24) return `${h}h ago`;
  const days = Math.floor(h/24); if (days < 30) return `${days}d ago`;
  return fmtDate(d);
};
export const titleCase = (s='') => s.replace(/_/g,' ').replace(/\b\w/g, c => c.toUpperCase());
export const roleHome = (role) => ({ citizen:'/dashboard', municipal:'/dashboard/municipal', ward_officer:'/dashboard/ward', superior:'/dashboard/government' }[role] || '/dashboard');
export const fileToDataUrl = (file) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
