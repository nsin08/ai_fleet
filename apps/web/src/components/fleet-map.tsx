'use client';

import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { VehicleState } from '../lib/types';

/* ── Fix Leaflet default icon ─────────────────────────────────────────────── */
/* Leaflet + bundlers lose track of the default marker images */
const iconBase = 'https://unpkg.com/leaflet@1.9.4/dist/images/';
const DefaultIcon = L.icon({
  iconUrl: `${iconBase}marker-icon.png`,
  iconRetinaUrl: `${iconBase}marker-icon-2x.png`,
  shadowUrl: `${iconBase}marker-shadow.png`,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

/* ── Status → circle colour ───────────────────────────────────────────────── */
const STATUS_COLOUR: Record<string, string> = {
  on_trip: '#22c55e', ON_TRIP: '#22c55e',
  alerting: '#ef4444', ALERTING: '#ef4444',
  idle: '#60a5fa', IDLE: '#60a5fa',
  parked: '#94a3b8', PARKED: '#94a3b8',
  off_route: '#f59e0b', OFF_ROUTE: '#f59e0b',
  maintenance_due: '#f97316', MAINTENANCE: '#f97316',
};

function statusIcon(status: string): L.DivIcon {
  const colour = STATUS_COLOUR[status] ?? '#94a3b8';
  return L.divIcon({
    className: '',
    html: `<div style="
      width:14px;height:14px;border-radius:50%;
      background:${colour};border:2px solid #0f172a;
      box-shadow:0 1px 4px rgba(15,23,42,.35);"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    popupAnchor: [0, -10],
  });
}

/* ── Auto-fit bounds ONCE on initial data load, not on every tick ────────── */
function AutoFit({ states }: { states: VehicleState[] }) {
  const map = useMap();
  // Use a ref to track whether we've already fitted the initial bounds
  const fitted = useRef(false);
  useEffect(() => {
    if (fitted.current) return;          // already done — don't jump on updates
    const pts = states.filter((s) => s.lat != null && s.lng != null);
    if (pts.length === 0) return;
    const bounds = L.latLngBounds(pts.map((s) => [Number(s.lat!), Number(s.lng!)]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });
    fitted.current = true;
  }, [map, states]);
  return null;
}

/* ── Main component ───────────────────────────────────────────────────────── */
interface Props {
  states: VehicleState[];
  className?: string;
  onVehicleClick?: (vehicleId: string) => void;
}

const INDIA_CENTER: [number, number] = [19.076, 72.877]; // Mumbai default

export default function FleetMap({ states, className = '', onVehicleClick }: Props) {
  const visible = states.filter((s) => s.lat != null && s.lng != null);

  return (
    <MapContainer
      center={INDIA_CENTER}
      zoom={6}
      scrollWheelZoom
      className={className}
      style={{ background: '#f8fafc', width: '100%', height: '100%' }}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
        maxZoom={19}
      />
      {visible.map((s) => (
        <Marker
          key={s.vehicleId}
          position={[Number(s.lat!), Number(s.lng!)]}
          icon={statusIcon(s.status)}
          eventHandlers={{
            click: () => onVehicleClick?.(s.vehicleId),
          }}
        >
          <Popup>
            <div className="text-xs font-mono leading-5">
              <strong className="block text-sm">{s.vehicleRegNo}</strong>
              <span className="capitalize">{s.status.replace(/_/g, ' ')}</span>
              <br />
              Speed: <strong>{s.speedKph != null ? Number(s.speedKph).toFixed(0) : '—'} km/h</strong>
              <br />
              Fuel: <strong>{s.fuelPct != null ? Number(s.fuelPct).toFixed(0) : '—'}%</strong>
              <br />
              Alerts: <strong>{s.activeAlertCount}</strong>
            </div>
          </Popup>
        </Marker>
      ))}
      {visible.length > 0 && <AutoFit states={visible} />}
    </MapContainer>
  );
}
