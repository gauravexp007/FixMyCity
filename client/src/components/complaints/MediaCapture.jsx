import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera, Video, Square, Upload, X, CameraOff, ImageIcon, Film, RefreshCw,
  MapPin, ExternalLink, ShieldCheck, Radar, Loader2,
} from 'lucide-react';
import toast from 'react-hot-toast';

const MAX_FILES = 6;
const MAX_BYTES = 25 * 1024 * 1024;
const GEO_LOOKUP_METERS = 120;

const fmtCoord = (lat, lng) => `${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}`;
const mapsUrl = (lat, lng) => `https://www.google.com/maps?q=${lat},${lng}`;

function distanceMeters(a, b) {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function stampLine(when) {
  return when.toLocaleString(undefined, {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function fitText(ctx, value, maxWidth) {
  if (ctx.measureText(value).width <= maxWidth) return value;
  let text = value;
  while (text.length > 4 && ctx.measureText(`${text}…`).width > maxWidth) text = text.slice(0, -1);
  return `${text}…`;
}

/**
 * Burns the capture geo-tag into the frame: coordinates, GPS accuracy, the
 * reverse-geocoded place and the exact capture time.
 */
function drawGeoStamp(ctx, width, height, geo, when) {
  const pad = Math.round(width * 0.026);
  const bandHeight = Math.round(Math.max(92, height * 0.24));
  const gradient = ctx.createLinearGradient(0, height - bandHeight, 0, height);
  gradient.addColorStop(0, 'rgba(6,16,28,0)');
  gradient.addColorStop(0.35, 'rgba(6,16,28,0.82)');
  gradient.addColorStop(1, 'rgba(6,16,28,0.95)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, height - bandHeight, width, bandHeight);

  const base = Math.max(14, Math.round(width * 0.026));
  const gap = Math.round(base * 1.55);
  const x = pad + Math.max(10, Math.round(width * 0.016));
  const maxWidth = width - x - pad;
  const y = height - pad - gap * 2 - Math.round(base * 0.3);

  ctx.fillStyle = '#05c8a5';
  ctx.fillRect(pad, y - Math.round(base * 1.1), Math.max(3, Math.round(width * 0.005)), Math.round(base * 4.1));

  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 ${Math.round(base * 1.12)}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
  const coords = geo?.latitude != null
    ? `${fmtCoord(geo.latitude, geo.longitude)}${geo.accuracy ? `   GPS ±${geo.accuracy} m` : ''}`
    : 'GPS location unavailable';
  ctx.fillText(fitText(ctx, coords, maxWidth), x, y);

  ctx.font = `500 ${base}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
  ctx.fillStyle = 'rgba(226,240,248,0.92)';
  if (geo?.address) ctx.fillText(fitText(ctx, geo.address, maxWidth), x, y + gap);

  ctx.font = `500 ${Math.round(base * 0.84)}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
  ctx.fillStyle = '#7fe6d0';
  ctx.fillText(`CivicTrack verified capture · ${stampLine(when)}`, x, y + gap * 2);

  const label = 'GEO-TAGGED';
  ctx.font = `700 ${Math.round(base * 0.78)}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
  const pillWidth = ctx.measureText(label).width + base * 1.5;
  const pillHeight = base * 1.75;
  const pillX = width - pad - pillWidth;
  const pillY = pad;
  ctx.fillStyle = 'rgba(5,200,165,0.92)';
  roundRect(ctx, pillX, pillY, pillWidth, pillHeight, pillHeight / 2);
  ctx.fill();
  ctx.fillStyle = '#062b26';
  ctx.fillText(label, pillX + base * 0.75, pillY + pillHeight / 2 + base * 0.28);
}

export default function MediaCapture({ files, setFiles, fallbackCoords }) {
  const [tab, setTab] = useState('camera');
  const [streaming, setStreaming] = useState(false);
  const [recording, setRecording] = useState(false);
  const [camError, setCamError] = useState('');
  const [facing, setFacing] = useState('environment');
  const [live, setLive] = useState(null);
  const [place, setPlace] = useState('');
  const [geoError, setGeoError] = useState('');
  const [ready, setReady] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const fileInputRef = useRef(null);
  const compositeRef = useRef(null);
  const lookupRef = useRef({ lat: null, lng: null, label: '' });
  const placeRef = useRef('');

  const stopCamera = () => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    compositeRef.current?.cancel?.();
    compositeRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setStreaming(false);
    setRecording(false);
    setReady(false);
  };

  useEffect(() => () => stopCamera(), []);

  // The <video> element only exists once streaming starts, so the stream has to be
  // attached after that render — attaching it while the placeholder is shown is
  // what left the preview black.
  useEffect(() => {
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!streaming || !video || !stream) return undefined;
    video.srcObject = stream;
    const play = () => video.play().catch(() => {});
    if (video.readyState >= 2) play();
    else video.addEventListener('loadedmetadata', play, { once: true });
    return () => video.removeEventListener('loadedmetadata', play);
  }, [streaming]);

  useEffect(() => {
    setNow(new Date());
    if (!streaming) return undefined;
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, [streaming]);

  // Continuous live-position watch: the same fix is shown on screen and stamped
  // into every capture, so the evidence carries the place it was taken.
  const reverseLookup = useCallback(async (position) => {
    const previous = lookupRef.current;
    if (previous.lat != null && distanceMeters(previous, position) < GEO_LOOKUP_METERS) return;
    lookupRef.current = { lat: position.lat, lng: position.lng, label: previous.label };
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${position.lat}&lon=${position.lng}`,
        { headers: { Accept: 'application/json' } }
      );
      if (!res.ok) return;
      const data = await res.json();
      const a = data.address || {};
      const label = [a.road, a.suburb || a.neighbourhood, a.city || a.town || a.village]
        .filter(Boolean).join(', ') || data.display_name || '';
      lookupRef.current = { ...lookupRef.current, label };
      placeRef.current = label;
      setPlace(label);
    } catch {
      /* reverse geocoding is best-effort; coordinates are still stamped */
    }
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) {
      setGeoError('This browser cannot read GPS. The confirmed complaint location will be used instead.');
      return undefined;
    }
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const position = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy),
          at: new Date(),
        };
        setLive(position);
        setGeoError('');
        reverseLookup(position);
      },
      (err) => {
        setGeoError(err.code === err.PERMISSION_DENIED
          ? 'Location permission denied — captures use the confirmed complaint location.'
          : 'Live GPS unavailable — captures use the confirmed complaint location.');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [reverseLookup]);

  const fallback = fallbackCoords ? { lat: fallbackCoords[0], lng: fallbackCoords[1], accuracy: null } : null;
  const geo = live
    ? { ...live, address: placeRef.current || place }
    : fallback
      ? { ...fallback, address: '' }
      : null;
  const geoSource = live ? 'Live GPS' : fallback ? 'Complaint location' : geoError ? 'No fix' : 'Waiting for GPS';
  const geoStatus = live ? 'Live geo-location' : fallback ? 'Using complaint location' : geoError ? 'Location unavailable' : 'Locating';

  const startCamera = async (mode = facing) => {
    setCamError('');
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Camera API is not supported in this browser.');
      }
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        // `ideal` keeps devices without a rear camera (or a matching resolution) working.
        video: { facingMode: { ideal: mode }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });
      streamRef.current = stream;
      setReady(false);
      setStreaming(true);
      setFacing(mode);
      // Covers camera flips, where `streaming` is already true so the effect
      // above does not re-run, and the preview would otherwise stay black.
      requestAnimationFrame(() => {
        if (videoRef.current && streamRef.current === stream) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      });
    } catch (err) {
      const msg = err?.name === 'NotAllowedError'
        ? 'Camera permission was denied. Allow camera access in your browser settings, or upload a photo instead.'
        : err?.name === 'NotFoundError'
          ? 'No camera device was found on this device. You can upload from gallery instead.'
          : err?.message || 'Unable to access the camera.';
      setCamError(msg);
      setTab('upload');
    }
  };

  const addFile = (file, geotag) => {
    if (files.length >= MAX_FILES) { toast.error(`You can attach up to ${MAX_FILES} media files`); return; }
    if (file.size > MAX_BYTES) { toast.error('Each file must be under 25 MB'); return; }
    if (!/^image\//.test(file.type) && !/^video\//.test(file.type)) { toast.error('Only images and videos are allowed'); return; }
    file.geotag = geotag;
    setFiles((prev) => [...prev, file]);
  };

  const currentGeotag = (when = new Date()) => (geo ? {
    latitude: geo.lat,
    longitude: geo.lng,
    accuracy: geo.accuracy ?? null,
    address: geo.address || '',
    capturedAt: when.toISOString(),
  } : null);

  const capturePhoto = async () => {
    const video = videoRef.current;
    if (!video || !streaming) return;
    const geotag = currentGeotag();
    if (!geotag) {
      toast.error('Waiting for a GPS fix. Allow location access or confirm the issue location in step 2.');
      return;
    }
    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, width, height);
    drawGeoStamp(ctx, width, height, geo, new Date());
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
    if (!blob) return toast.error('Failed to capture photo');
    addFile(new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' }), geotag);
    toast.success('Geo-tagged photo captured');
  };

  const startRecording = () => {
    const stream = streamRef.current;
    const video = videoRef.current;
    if (!stream) return;

    const startedAt = new Date();
    const geotag = currentGeotag(startedAt);
    if (!geotag) {
      toast.error('Waiting for a GPS fix before recording. Allow location access or confirm the issue location.');
      return;
    }

    if (!video?.videoWidth) {
      toast.error('The camera is still starting. Try recording again in a moment.');
      return;
    }

    // Composite the live camera frame with the geo banner so the recorded video
    // itself carries the coordinates at the moment it was shot.
    let recordStream = stream;
    let canvas = null;
    let raf = null;
    try {
      canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext('2d');
      const paint = () => {
        if (!canvas || !videoRef.current) return;
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        drawGeoStamp(ctx, canvas.width, canvas.height, geotag, new Date());
        raf = requestAnimationFrame(paint);
      };
      paint();
      const composited = canvas.captureStream(30);
      recordStream = new MediaStream([
        ...composited.getVideoTracks(),
        ...stream.getAudioTracks(),
      ]);
      compositeRef.current = { cancel: () => cancelAnimationFrame(raf), canvas };
    } catch {
      recordStream = stream;
      canvas = null;
    }

    const mime = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
      .find((type) => window.MediaRecorder?.isTypeSupported?.(type)) || '';
    if (!window.MediaRecorder) {
      toast.error('Video recording is not supported in this browser. Upload a video instead.');
      return;
    }

    try {
      const rec = new MediaRecorder(recordStream, mime ? { mimeType: mime, videoBitsPerSecond: 2500000 } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (event) => { if (event.data.size > 0) chunksRef.current.push(event.data); };
      rec.onstop = () => {
        if (raf) cancelAnimationFrame(raf);
        compositeRef.current = null;
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        if (blob.size > 0) {
          addFile(new File([blob], `recording-${Date.now()}.webm`, { type: 'video/webm' }), geotag);
          toast.success('Geo-tagged video recorded');
        }
        setRecording(false);
      };
      rec.start(1000);
      recorderRef.current = rec;
      setRecording(true);
    } catch {
      if (raf) cancelAnimationFrame(raf);
      compositeRef.current = null;
      toast.error('Video recording is not supported in this browser. Upload a video instead.');
    }
  };

  const toggleRecording = () => {
    if (recording) {
      recorderRef.current?.stop();
      return;
    }
    startRecording();
  };

  const handleUpload = (list) => {
    [...list].forEach((file) => {
      const capturedAt = new Date(file.lastModified || Date.now());
      const geotag = currentGeotag(capturedAt);
      addFile(file, geotag);
    });
  };

  const previews = useMemo(() => files.map((file, i) => ({
    file,
    url: URL.createObjectURL(file),
    isVideo: /^video\//.test(file.type),
    i,
  })), [files]);

  useEffect(() => () => previews.forEach((preview) => URL.revokeObjectURL(preview.url)), [previews]);

  return (
    <div className="space-y-4">
      {/* Live geo status — the same fix that is stamped into the capture */}
      <div className={`overflow-hidden rounded-3xl border bg-gradient-to-br shadow-sm ${live
        ? 'border-tealbrand-200/80 from-tealbrand-50 to-white dark:border-tealbrand-900/40 dark:from-tealbrand-900/20 dark:to-carbon-900'
        : 'border-amber-200/80 from-amber-50 to-white dark:border-amber-900/40 dark:from-amber-950/25 dark:to-carbon-900'}`}>
        <div className="flex items-start gap-3 p-4 sm:p-5">
          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${live
            ? 'bg-tealbrand-600/10 text-tealbrand-700 dark:bg-tealbrand-500/15 dark:text-tealbrand-300'
            : 'bg-amber-500/10 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'}`}>
            <MapPin size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`flex items-center gap-2 text-base font-semibold ${live ? 'text-tealbrand-800 dark:text-tealbrand-300' : 'text-amber-800 dark:text-amber-300'}`}>
                <span className={`h-2.5 w-2.5 rounded-full ${live ? 'animate-pulse bg-tealbrand-500' : 'bg-amber-500'}`} />
                {geoStatus}
              </span>
              <span className="rounded-full bg-white/70 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:bg-white/10 dark:text-slate-300">{geoSource}</span>
            </div>

            {geo ? (
              <>
                <p className="mt-2 font-mono text-lg font-semibold tracking-tight text-slate-900 dark:text-white">
                  {fmtCoord(geo.lat, geo.lng)}
                  {geo.accuracy ? <span className="ml-2 align-middle text-xs font-normal text-slate-500 dark:text-slate-400">±{geo.accuracy} m</span> : null}
                </p>
                {geo.address && (
                  <p className="mt-1 flex items-start gap-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                    <MapPin size={15} className="mt-0.5 shrink-0" /> <span>{geo.address}</span>
                  </p>
                )}
              </>
            ) : (
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                {geoError ? 'Pin the issue location in step 2 to enable geo-tagged capture.' : 'Waiting for a GPS fix…'}
              </p>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500 dark:text-slate-400">
              {live?.at && <span className="inline-flex items-center gap-1.5"><Radar size={13} /> updated {live.at.toLocaleTimeString()}</span>}
              {geo && (
                <a href={mapsUrl(geo.lat, geo.lng)} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-tealbrand-700 hover:underline dark:text-tealbrand-300">
                  <ExternalLink size={14} /> Open in Google Maps
                </a>
              )}
            </div>

            {geoError && <p className="mt-2 text-sm text-amber-800 dark:text-amber-300">{geoError}</p>}
          </div>
        </div>
      </div>

      <div className="mx-auto flex w-fit gap-1 rounded-2xl border border-slate-200/80 bg-slate-100/80 p-1 dark:border-carbon-700 dark:bg-carbon-800/80">
        {[{ k: 'camera', label: 'Live Camera', icon: Camera }, { k: 'upload', label: 'Gallery Upload', icon: Upload }].map(t => (
          <button key={t.k} type="button" onClick={() => setTab(t.k)}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${tab === t.k ? 'bg-white text-navy-800 shadow-sm dark:bg-carbon-700 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}>
            <t.icon size={16}/> {t.label}
          </button>
        ))}
      </div>

      {tab === 'camera' && (
        <div>
          {!streaming ? (
            <div className="mx-auto max-w-xl rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50 p-8 text-center dark:border-carbon-700 dark:bg-carbon-800/40 sm:p-10">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-navy-600 shadow-sm dark:bg-carbon-700 dark:text-tealbrand-400"><Camera size={26}/></div>
              <h4 className="mt-4 font-semibold text-navy-800 dark:text-white">Capture live evidence with your location</h4>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto">Your browser will ask for camera, microphone and location permission. The coordinates and timestamp are printed onto the photo or video, and nothing is uploaded until you submit the complaint.</p>
              <button type="button" onClick={() => startCamera()} className="btn-primary mt-4"><Camera size={17}/> Enable camera</button>
              {camError && (
                <div className="mt-4 flex items-start gap-2 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 p-3 text-left max-w-lg mx-auto">
                  <CameraOff size={18} className="text-amber-600 shrink-0 mt-0.5"/>
                  <p className="text-xs text-amber-800 dark:text-amber-300">{camError}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="mx-auto w-full max-w-xl">
                <div className="relative aspect-video overflow-hidden rounded-3xl bg-black shadow-xl ring-1 ring-slate-900/10 dark:ring-white/10">
                  <video ref={videoRef} autoPlay playsInline muted
                    onLoadedData={() => setReady(true)}
                    onCanPlay={() => setReady(true)}
                    className="h-full w-full object-cover" />
                  {!ready && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black text-white/80">
                      <Loader2 size={22} className="animate-spin" />
                      <p className="text-sm">Starting camera…</p>
                    </div>
                  )}
                  {recording && <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-rose-600 px-3 py-1 text-xs font-semibold text-white shadow-lg"><span className="h-2 w-2 animate-pulse rounded-full bg-white"/>REC · geo-stamped</div>}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-4 pb-4 pt-12">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-white">
                      <span className="flex items-center gap-1.5 text-sm font-semibold">
                        <Radar size={15} className={geo ? 'text-tealbrand-300' : 'text-amber-300'} />
                        {geo ? fmtCoord(geo.lat, geo.lng) : 'Acquiring GPS…'}
                      </span>
                      {geo?.accuracy ? <span className="text-xs text-white/70">±{geo.accuracy} m</span> : null}
                      <span className="text-xs tabular-nums text-white/70">{now.toLocaleTimeString()}</span>
                      {geo && (
                        <a href={mapsUrl(geo.lat, geo.lng)} target="_blank" rel="noreferrer" className="ml-auto flex items-center gap-1 text-xs font-semibold text-tealbrand-300 hover:underline">
                          <ExternalLink size={12} /> Map
                        </a>
                      )}
                    </div>
                    {geo?.address && <p className="mt-1 truncate text-sm text-white/85">{geo.address}</p>}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                <button type="button" onClick={capturePhoto} className="btn-primary"><Camera size={17}/> Capture photo</button>
                <button type="button" onClick={toggleRecording} className={recording ? 'btn-secondary !text-rose-600 !border-rose-300' : 'btn-secondary'}>
                  {recording ? <><Square size={16}/> Stop recording</> : <><Video size={17}/> Record video</>}
                </button>
                <button type="button" onClick={() => startCamera(facing === 'environment' ? 'user' : 'environment')} className="btn-secondary"><RefreshCw size={16}/> Flip</button>
                <button type="button" onClick={stopCamera} className="btn-secondary">Turn off</button>
              </div>
              <p className="mx-auto flex max-w-xl items-start gap-1.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                <ShieldCheck size={14} className="mt-0.5 shrink-0 text-tealbrand-600"/> The coordinate banner is burned into the photo and video, so the municipal desk sees exactly where and when it was captured.
              </p>
            </div>
          )}
        </div>
      )}

      {tab === 'upload' && (
        <div>
          <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple className="hidden"
            onChange={(e) => { handleUpload(e.target.files); e.target.value = ''; }} />
          <button type="button" onClick={() => fileInputRef.current?.click()}
            className="w-full rounded-2xl border-2 border-dashed border-slate-200 dark:border-carbon-700 bg-slate-50 dark:bg-carbon-800/50 p-8 text-center hover:border-tealbrand-400 hover:bg-tealbrand-50/40 dark:hover:bg-tealbrand-900/10 transition">
            <div className="mx-auto h-14 w-14 rounded-2xl bg-white dark:bg-carbon-700 text-navy-600 dark:text-tealbrand-400 flex items-center justify-center shadow-sm"><Upload size={24}/></div>
            <h4 className="mt-4 font-semibold text-navy-800 dark:text-white">Choose photos or videos</h4>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">JPG, PNG, HEIC, MP4 or WebM · up to 6 files · max 25 MB each</p>
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">Uploads are tagged with your current location.</p>
          </button>
        </div>
      )}

      {files.length > 0 && (
        <div>
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">Attached evidence ({files.length}/6)</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {previews.map(({ file, url, isVideo, i }) => {
              const tag = file.geotag;
              return (
                <div key={`${file.name}-${i}`} className="relative group rounded-xl overflow-hidden border border-slate-200 dark:border-carbon-700 bg-slate-100 dark:bg-carbon-800 aspect-video">
                  {isVideo ? (
                    <video src={url} className="h-full w-full object-cover" controls />
                  ) : (
                    <img src={url} alt={file.name} className="h-full w-full object-cover" />
                  )}
                  <div className="absolute top-2 left-2 rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white flex items-center gap-1">
                    {isVideo ? <Film size={11}/> : <ImageIcon size={11}/>} {isVideo ? 'Video' : 'Photo'}
                  </div>
                  <button type="button" onClick={() => setFiles(prev => prev.filter((_, idx) => idx !== i))}
                    className="absolute top-2 right-2 h-7 w-7 rounded-full bg-black/60 text-white flex items-center justify-center opacity-90 hover:bg-rose-600 transition">
                    <X size={14}/>
                  </button>
                  {tag?.latitude != null && (
                    <a href={mapsUrl(tag.latitude, tag.longitude)} target="_blank" rel="noreferrer"
                      className="absolute top-9 left-2 flex items-center gap-1 rounded-md bg-tealbrand-600/90 px-2 py-0.5 text-[10px] font-medium text-white hover:bg-tealbrand-700"
                      title="Open this capture location in Google Maps">
                      <MapPin size={10}/> {Number(tag.latitude).toFixed(4)}, {Number(tag.longitude).toFixed(4)}
                    </a>
                  )}
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5">
                    <p className="text-[10px] text-white truncate">{file.name}</p>
                    {tag?.capturedAt && <p className="text-[9px] text-white/70">{new Date(tag.capturedAt).toLocaleString()}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
