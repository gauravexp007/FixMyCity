import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents, CircleMarker } from 'react-leaflet';
import L from 'leaflet';

const pinIcon = L.divIcon({
  className: '',
  html: `<div style="width:26px;height:26px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#1e3a5f;border:3px solid #05c8a5;box-shadow:0 2px 8px rgba(0,0,0,.35)"></div>`,
  iconSize: [26, 26],
  iconAnchor: [13, 26],
});

const STATUS_HEX = { Submitted: '#94a3b8', 'Under Review': '#f59e0b', Verified: '#3b82f6', Assigned: '#6366f1', 'In Progress': '#06b6d4', Resolved: '#10b981', Rejected: '#f43f5e', Escalated: '#f97316' };

function Recenter({ center, zoom }) {
  const map = useMap();
  useEffect(() => { if (center) map.setView(center, zoom || map.getZoom()); }, [center?.[0], center?.[1], zoom]);
  return null;
}

function ClickHandler({ onPick }) {
  useMapEvents({ click(e) { onPick?.([e.latlng.lat, e.latlng.lng]); } });
  return null;
}

export default function LocationMap({
  center = [12.9716, 77.5946], zoom = 13, marker, onPick, complaints, onSelect, height = 320, interactive = true, className = '',
}) {
  const mapCenter = useMemo(() => center || [12.9716, 77.5946], [center?.[0], center?.[1]]);
  return (
    <div className={`rounded-2xl overflow-hidden border border-slate-200 dark:border-navy-700 ${className}`} style={{ height }}>
      <MapContainer center={mapCenter} zoom={zoom} style={{ height: '100%', width: '100%' }} scrollWheelZoom={interactive}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Recenter center={mapCenter} zoom={zoom} />
        {onPick && <ClickHandler onPick={onPick} />}
        {marker && (
          <Marker
            position={marker}
            icon={pinIcon}
            draggable={!!onPick}
            eventHandlers={{ dragend: (e) => { const p = e.target.getLatLng(); onPick?.([p.lat, p.lng]); } }}
          />
        )}
        {complaints?.map((c) => {
          const coords = c.location?.coordinates;
          if (!coords || coords.length < 2) return null;
          return (
            <CircleMarker
              key={c._id}
              center={[coords[1], coords[0]]}
              radius={8}
              pathOptions={{ color: '#fff', weight: 2, fillColor: STATUS_HEX[c.status] || '#1e3a5f', fillOpacity: 0.95 }}
              eventHandlers={{ click: () => onSelect?.(c) }}
            >
              <Popup>
                <div style={{ minWidth: 160 }}>
                  <div style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace' }}>{c.complaintId}</div>
                  <div style={{ fontWeight: 600, margin: '2px 0' }}>{c.title}</div>
                  <div style={{ fontSize: 12 }}>{c.category} · {c.status}</div>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}
