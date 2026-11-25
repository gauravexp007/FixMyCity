import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  MapPin, Crosshair, AlertTriangle, CheckCircle2, Send, Loader2, ArrowLeft,
  LocateFixed, Info, ExternalLink, Search, Camera, MousePointerClick, Building2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import MediaCapture from '../components/complaints/MediaCapture';
import LocationMap from '../components/map/LocationMap';
import { CATEGORIES, SEVERITIES } from '../utils/constants';
import { useAuth } from '../context/AuthContext';

const DEFAULT_CENTER = [12.9716, 77.5946];

const initial = {
  title: '', description: '', category: 'Pothole', severity: 'Medium',
  address: '', landmark: '', municipality: '', ward: '',
};

const SOURCE_LABEL = {
  gps: 'Detected from your device GPS',
  map: 'Pinned by you on the map',
  address: 'Approximate — matched from your address',
  profile: 'Default area centre',
};

export default function ReportIssue() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [files, setFiles] = useState([]);
  const [form, setForm] = useState({ ...initial, municipality: user?.municipality || '', ward: user?.ward || '' });
  const [coords, setCoords] = useState(null);
  const [locationSource, setLocationSource] = useState('');
  const [locating, setLocating] = useState(true);
  const [locError, setLocError] = useState('');
  const [geoAccuracy, setGeoAccuracy] = useState(null);
  const [locationMissing, setLocationMissing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const locationRef = useRef(null);
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const addressQuery = () => [form.address, form.landmark, form.ward, form.municipality]
    .filter(Boolean).join(', ');

  const geocodeAddress = async (query) => {
    if (!query || query.trim().length < 5) return null;
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`,
        { headers: { Accept: 'application/json' } }
      );
      if (!res.ok) return null;
      const [hit] = await res.json();
      if (!hit?.lat || !hit?.lon) return null;
      return [Number(hit.lat), Number(hit.lon)];
    } catch {
      return null;
    }
  };

  const reverseGeocode = async ([lat, lng]) => {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`, { headers: { Accept: 'application/json' } });
      if (!res.ok) return;
      const data = await res.json();
      const a = data.address || {};
      const line = [a.road, a.suburb || a.neighbourhood, a.city || a.town || a.village, a.state].filter(Boolean).join(', ');
      setForm(f => ({
        ...f,
        address: f.address || line || data.display_name || '',
        municipality: f.municipality || a.city || a.town || a.village || a.county || '',
        ward: f.ward || a.suburb || a.neighbourhood || '',
      }));
    } catch { /* reverse geocoding is best-effort; manual entry remains */ }
  };

  const detectLocation = () => {
    setLocError('');
    if (!navigator.geolocation) {
      setLocating(false);
      setLocError('Geolocation is not supported by this browser. Pin the location on the map, or use your address.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const c = [pos.coords.latitude, pos.coords.longitude];
        setCoords(c);
        setLocationSource('gps');
        setGeoAccuracy(Math.round(pos.coords.accuracy));
        setLocating(false);
        setLocationMissing(false);
        await reverseGeocode(c);
      },
      (err) => {
        setLocating(false);
        setLocError(err.code === err.PERMISSION_DENIED
          ? 'Location permission was blocked. Pin it on the map, or let us match your address.'
          : 'GPS did not respond in time. Pin the location on the map, or let us match your address.');
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  };

  // Location is detected automatically as soon as the page opens — the map and
  // manual options stay available the whole time, so a slow or blocked GPS can
  // never trap the citizen on a "detecting…" screen.
  useEffect(() => {
    const timer = setTimeout(() => detectLocation(), 200);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const locateFromAddress = async () => {
    const query = addressQuery();
    if (!query) { toast.error('Type a street or area first, then match it to a location'); return; }
    setLocating(true);
    setLocError('');
    const found = await geocodeAddress(query);
    setLocating(false);
    if (found) {
      setCoords(found);
      setGeoAccuracy(null);
      setLocationSource('address');
      setLocationMissing(false);
      toast.success('Location estimated from your address — adjust the pin if needed');
    } else {
      setLocError('We could not find that address. Tap the map to pin the exact spot.');
    }
  };

  const pickOnMap = (c) => {
    setCoords(c);
    setLocationSource('map');
    setGeoAccuracy(null);
    setLocationMissing(false);
    setLocError('');
  };

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      let point = coords;
      if (!point) {
        // Last automatic attempt: resolve the typed address before giving up.
        const query = addressQuery();
        if (query) {
          const found = await geocodeAddress(query);
          if (found) {
            point = found;
            setCoords(found);
            setGeoAccuracy(null);
            setLocationSource('address');
          }
        }
      }
      if (!point) {
        setLocationMissing(true);
        setSubmitting(false);
        toast.error('Set the complaint location: tap the map, or use your address');
        locationRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }

      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      fd.append('latitude', point[0]);
      fd.append('longitude', point[1]);
      fd.append('locationSource', locationSource || 'map');
      // Capture geo-tags stay attached to each file so the municipal desk sees
      // exactly where and when the photo/video was taken.
      fd.append('mediaMeta', JSON.stringify(files.map(f => f.geotag || null)));
      files.forEach(f => fd.append('media', f));
      const { data } = await api.post('/complaints', fd);
      setResult(data);
      toast.success('Complaint submitted successfully');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not submit the complaint. Please try again.');
    } finally { setSubmitting(false); }
  };

  const reset = () => {
    setResult(null);
    setFiles([]);
    setCoords(null);
    setLocationSource('');
    setGeoAccuracy(null);
    setLocationMissing(false);
    setForm({ ...initial, municipality: user?.municipality || '', ward: user?.ward || '' });
    detectLocation();
  };

  if (result) {
    const c = result.complaint;
    const point = c.location?.coordinates;
    return (
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="card p-8 text-center">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center"><CheckCircle2 size={32}/></div>
          <h1 className="mt-5 text-2xl font-bold text-navy-900 dark:text-white">Complaint submitted</h1>
          <p className="mt-2 text-slate-500 dark:text-slate-400">
            Saved on the server and delivered to the {c.location?.municipality || 'municipal'} municipal desk
            {c.location?.ward ? ` and ${c.location.ward} ward officers` : ''}.
          </p>
          <div className="mt-5 inline-flex items-center gap-2 rounded-xl bg-slate-50 dark:bg-carbon-800 px-4 py-3">
            <span className="text-sm text-slate-500">Complaint ID</span>
            <span className="font-mono font-bold text-navy-800 dark:text-white">{c.complaintId}</span>
          </div>
          {point && (
            <a href={`https://www.google.com/maps?q=${point[1]},${point[0]}`} target="_blank" rel="noreferrer"
              className="mt-3 mx-auto flex w-fit items-center gap-1 text-xs font-medium text-tealbrand-700 hover:underline dark:text-tealbrand-400">
              <MapPin size={13}/> {point[1].toFixed(5)}, {point[0].toFixed(5)} · open in Google Maps
            </a>
          )}
          <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
            <Link to={`/complaints/${c._id}`} className="btn-primary">View complaint & timeline</Link>
            <Link to="/evidence" className="btn-secondary">My evidence</Link>
            <button onClick={reset} className="btn-secondary">Report another issue</button>
          </div>
        </div>
        {result.duplicates?.length > 0 && (
          <div className="card p-5 border-amber-200 dark:border-amber-900/50 bg-amber-50/60 dark:bg-amber-950/20">
            <div className="flex items-start gap-3">
              <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={20}/>
              <div>
                <h3 className="font-semibold text-amber-900 dark:text-amber-300">Similar nearby complaints detected</h3>
                <p className="text-sm text-amber-800 dark:text-amber-400 mt-1">{result.message}</p>
                <div className="mt-3 space-y-2">
                  {result.duplicates.map(d => (
                    <Link key={d._id} to={`/complaints/${d._id}`} className="block rounded-lg bg-white/70 dark:bg-carbon-900/60 px-3 py-2 text-sm hover:bg-white transition">
                      <span className="font-mono text-xs text-slate-500">{d.complaintId}</span> · {d.title} · <span className="font-medium">{d.status}</span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  const steps = [
    { n: 1, label: 'Evidence', done: files.length > 0, href: '#evidence' },
    { n: 2, label: 'Location', done: Boolean(coords), href: '#location' },
    { n: 3, label: 'Details', done: Boolean(form.title.trim() && form.description.trim()), href: '#details' },
  ];
  const mapCenter = coords || DEFAULT_CENTER;
  const mapZoom = coords ? 16 : 12;

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <button onClick={() => navigate(-1)} className="text-sm text-slate-500 hover:text-navy-700 dark:hover:text-white flex items-center gap-1 mb-3"><ArrowLeft size={15}/> Back</button>
        <h1 className="text-2xl font-bold text-navy-900 dark:text-white">Report a civic issue</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Add geo-tagged evidence, confirm the location and describe the problem. Your complaint is only created after the server confirms it.</p>
      </div>

      <ol className="flex flex-wrap items-center gap-2 text-sm">
        {steps.map((s, i) => (
          <li key={s.n} className="flex items-center gap-2">
            <a href={s.href} className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 transition ${s.done
              ? 'border-tealbrand-200 bg-tealbrand-50 text-tealbrand-800 dark:border-tealbrand-900/60 dark:bg-tealbrand-900/15 dark:text-tealbrand-300'
              : 'border-slate-200 bg-white text-slate-500 dark:border-carbon-700 dark:bg-carbon-900 dark:text-slate-400'}`}>
              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${s.done ? 'bg-tealbrand-600 text-white' : 'bg-slate-200 text-slate-600 dark:bg-carbon-700 dark:text-slate-300'}`}>
                {s.done ? '✓' : s.n}
              </span>
              {s.label}
            </a>
            {i < steps.length - 1 && <span className="h-px w-6 bg-slate-200 dark:bg-carbon-700" />}
          </li>
        ))}
      </ol>

      <form onSubmit={submit} className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <section id="evidence" className="card p-5 lg:p-6 scroll-mt-24">
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className="h-7 w-7 rounded-lg bg-navy-700 text-white text-xs font-bold flex items-center justify-center">1</span>
              <h2 className="font-semibold text-navy-800 dark:text-white">Photo & video evidence</h2>
              <span className="badge bg-tealbrand-50 text-tealbrand-700 dark:bg-tealbrand-900/20 dark:text-tealbrand-300">Geo-tagged</span>
              <span className="ml-auto text-xs text-slate-500 dark:text-slate-400">Optional · up to 6 files</span>
            </div>
            <MediaCapture files={files} setFiles={setFiles} fallbackCoords={coords} />
          </section>

          <section id="location" ref={locationRef} className={`card p-5 lg:p-6 scroll-mt-24 transition ${locationMissing ? 'ring-2 ring-rose-300 dark:ring-rose-800' : ''}`}>
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className="h-7 w-7 rounded-lg bg-navy-700 text-white text-xs font-bold flex items-center justify-center">2</span>
              <h2 className="text-lg font-semibold text-navy-800 dark:text-white">Issue location</h2>
              <span className={`badge ${coords
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300'
                : 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300'}`}>
                {coords ? 'Location set' : 'Required'}
              </span>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 mb-3">
              <button type="button" onClick={detectLocation} disabled={locating} className="btn-primary">
                {locating ? <><Loader2 size={17} className="animate-spin"/> Detecting…</> : <><Crosshair size={17}/> Detect my location</>}
              </button>
              <button type="button" onClick={locateFromAddress} disabled={locating} className="btn-secondary">
                <Search size={16}/> Match my address
              </button>
            </div>

            <div className={`mb-4 rounded-2xl border p-4 ${coords
              ? 'border-slate-200/80 bg-slate-50/80 dark:border-carbon-700 dark:bg-carbon-800/50'
              : 'border-dashed border-slate-300 bg-slate-50/60 dark:border-carbon-600 dark:bg-carbon-800/30'}`}>
              {coords ? (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-tealbrand-600/10 text-tealbrand-700 dark:bg-tealbrand-500/15 dark:text-tealbrand-300">
                    <LocateFixed size={20}/>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-lg font-semibold tracking-tight text-slate-900 dark:text-white">
                      {coords[0].toFixed(6)}, {coords[1].toFixed(6)}
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600 dark:text-slate-300">
                      <span>{SOURCE_LABEL[locationSource] || 'Location set'}</span>
                      {geoAccuracy && <span>GPS accuracy ±{geoAccuracy} m</span>}
                    </p>
                  </div>
                  <a href={`https://www.google.com/maps?q=${coords[0]},${coords[1]}`} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1.5 self-start rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-navy-700 transition hover:bg-slate-100 dark:border-carbon-600 dark:bg-carbon-800 dark:text-tealbrand-300 dark:hover:bg-carbon-700 sm:self-center">
                    <ExternalLink size={15}/> Google Maps
                  </a>
                </div>
              ) : (
                <p className="flex items-start gap-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  <MousePointerClick size={16} className="mt-0.5 shrink-0"/> Tap anywhere on the map to drop the pin, or press “Match my address”.
                </p>
              )}
            </div>

            {locError && (
              <div className="mb-3 flex items-start gap-2 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 p-3">
                <AlertTriangle size={17} className="text-amber-600 shrink-0 mt-0.5"/>
                <p className="text-sm text-amber-800 dark:text-amber-300">{locError}</p>
              </div>
            )}

            <LocationMap center={mapCenter} marker={coords || undefined} onPick={pickOnMap} zoom={mapZoom} height={300} />

            <div className="mt-3 grid sm:grid-cols-3 gap-3">
              <div><label className="label">Address / street</label><input className="input" value={form.address} onChange={set('address')} placeholder="Street or area description" /></div>
              <div><label className="label">Landmark</label><input className="input" value={form.landmark} onChange={set('landmark')} placeholder="Near..." /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Municipality</label><input className="input" value={form.municipality} onChange={set('municipality')} placeholder="City" /></div>
                <div><label className="label">Ward</label><input className="input" value={form.ward} onChange={set('ward')} placeholder="Ward" /></div>
              </div>
            </div>
            <p className="mt-3 flex items-start gap-1.5 text-sm text-slate-500 dark:text-slate-400">
              <Building2 size={15} className="mt-0.5 shrink-0"/> Municipality and ward decide which municipal and ward desks receive this complaint.
            </p>
          </section>

          <section id="details" className="card p-5 lg:p-6 scroll-mt-24">
            <div className="flex items-center gap-2 mb-4"><span className="h-7 w-7 rounded-lg bg-navy-700 text-white text-xs font-bold flex items-center justify-center">3</span><h2 className="font-semibold text-navy-800 dark:text-white">Complaint details</h2></div>
            <div className="space-y-4">
              <div><label className="label">Title <span className="text-rose-500">*</span></label><input className="input" required maxLength={150} value={form.title} onChange={set('title')} placeholder="e.g. Deep pothole near the school gate" /></div>
              <div><label className="label">Description <span className="text-rose-500">*</span></label><textarea className="input min-h-[110px]" required maxLength={2000} value={form.description} onChange={set('description')} placeholder="Describe the problem, how long it has existed and its impact..." /></div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div><label className="label">Category <span className="text-rose-500">*</span></label>
                  <select className="input" value={form.category} onChange={set('category')}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select>
                </div>
                <div><label className="label">Severity <span className="text-rose-500">*</span></label>
                  <select className="input" value={form.severity} onChange={set('severity')}>{SEVERITIES.map(s => <option key={s}>{s}</option>)}</select>
                </div>
              </div>
            </div>
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 self-start">
          <div className="card p-5">
            <h3 className="font-semibold text-navy-800 dark:text-white">Submission summary</h3>
            <ul className="mt-4 space-y-2.5 text-sm">
              {[
                { ok: files.length > 0, label: 'Evidence', value: files.length ? `${files.length} file(s)` : 'None — optional' },
                { ok: Boolean(coords), label: 'Location', value: coords ? 'Set' : 'Not set yet' },
                { ok: Boolean(form.title.trim()), label: 'Title', value: form.title.trim() ? 'Added' : 'Required' },
                { ok: Boolean(form.description.trim()), label: 'Description', value: form.description.trim() ? 'Added' : 'Required' },
              ].map((row) => (
                <li key={row.label} className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                    {row.ok ? <CheckCircle2 size={15} className="text-emerald-500"/> : <span className="h-[15px] w-[15px] rounded-full border border-slate-300 dark:border-carbon-600" />}
                    {row.label}
                  </span>
                  <span className={`text-xs ${row.ok ? 'text-slate-500 dark:text-slate-400' : 'font-medium text-amber-600 dark:text-amber-400'}`}>{row.value}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-4 space-y-2 border-t border-slate-100 pt-4 text-sm dark:border-carbon-800">
              <div className="flex items-center justify-between"><dt className="text-slate-500">Category</dt><dd className="font-medium text-navy-800 dark:text-white">{form.category}</dd></div>
              <div className="flex items-center justify-between"><dt className="text-slate-500">Severity</dt><dd className="font-medium text-navy-800 dark:text-white">{form.severity}</dd></div>
              <div className="flex items-center justify-between"><dt className="text-slate-500">Ward</dt><dd className="font-medium text-navy-800 dark:text-white">{form.ward || '—'}</dd></div>
            </dl>
            <button type="submit" disabled={submitting} className="btn-accent w-full mt-5 py-3">
              {submitting ? <><Loader2 size={18} className="animate-spin"/> Submitting...</> : <><Send size={17}/> Submit complaint</>}
            </button>
            <p className="mt-3 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
              Your complaint ID is generated only after the server saves it. Similar nearby complaints may be flagged for duplicate verification.
            </p>
            <p className="mt-2 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
              Geo-tagged photos and videos are delivered to the {form.municipality || 'municipal'} authority desk and saved to your own login under <Link to="/evidence" className="font-medium text-tealbrand-700 hover:underline dark:text-tealbrand-400">My Evidence</Link>.
            </p>
          </div>
          <div className="card p-5 text-sm text-slate-600 dark:text-slate-300">
            <div className="flex items-center gap-2 font-medium text-navy-800 dark:text-white mb-2"><Camera size={16}/> Location is automatic</div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">We request your GPS when this page opens. If it is blocked or slow, tap the map or use “Match my address” — you can always submit.</p>
          </div>
          <div className="card p-5 text-sm text-slate-600 dark:text-slate-300">
            <div className="flex items-center gap-2 font-medium text-navy-800 dark:text-white mb-2"><Info size={16}/> Who receives it</div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">The complaint is routed by municipality and ward to the municipal authority and ward officer, and grouped by category on their dashboards.</p>
          </div>
        </aside>
      </form>
    </div>
  );
}
