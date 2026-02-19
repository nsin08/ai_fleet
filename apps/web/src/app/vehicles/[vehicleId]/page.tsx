'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import useSWR from 'swr';
import Link from 'next/link';
import clsx from 'clsx';
import type { Vehicle, TelemetryPoint, Alert, VehicleState } from '../../../lib/types';
import { API, WS_URL, fetcher } from '../../../lib/api';

const FleetMap = dynamic(() => import('../../../components/fleet-map'), { ssr: false });

const SWR_OPT = { revalidateOnFocus: false };

const STATUS_BADGE: Record<string, string> = {
  ON_TRIP: 'bg-green-900/60 text-green-300',
  IDLE: 'bg-slate-700 text-slate-300',
  PARKED: 'bg-blue-900/60 text-blue-300',
  MAINTENANCE: 'bg-orange-900/60 text-orange-300',
  OFFLINE: 'bg-red-900/60 text-red-300',
};

const SEVERITY_COLOR: Record<string, string> = {
  CRITICAL: 'text-red-400',
  HIGH: 'text-orange-400',
  MEDIUM: 'text-amber-400',
  LOW: 'text-slate-400',
};

function fmt(val: number | undefined, unit: string, decimals = 0) {
  if (val == null) return '—';
  return `${val.toFixed(decimals)} ${unit}`;
}

function fmtTs(ts: string) {
  try { return new Date(ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }); }
  catch { return ts; }
}

export default function VehicleDetailPage({ params }: { params: { vehicleId: string } }) {
  const { vehicleId } = params;

  const { data: vehicleResp } = useSWR<{
    vehicle: Vehicle;
    latestTelemetry: TelemetryPoint[];
    activeAlerts: Alert[];
  }>(`${API}/api/fleet/vehicles/${vehicleId}`, fetcher, { ...SWR_OPT, refreshInterval: 5000 });

  const vehicle = vehicleResp?.vehicle;
  const telemetry = vehicleResp?.latestTelemetry ?? [];
  const openAlerts = vehicleResp?.activeAlerts ?? [];

  const [liveTelemetry, setLiveTelemetry] = useState<TelemetryPoint | null>(null);

  useEffect(() => {
    let ws: WebSocket | null = null;
    try {
      ws = new WebSocket(WS_URL);
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data as string);
          if (msg.type === 'telemetry' && msg.vehicleId === vehicleId) {
            setLiveTelemetry(msg.data as TelemetryPoint);
          }
        } catch { /* ignore */ }
      };
    } catch { /* ws unavailable */ }
    return () => { ws?.close(); };
  }, [vehicleId]);

  const latest = liveTelemetry ?? telemetry[0];

  const vehicleState: VehicleState | undefined = vehicle && latest ? {
    vehicleId: vehicle.id,
    vehicleRegNo: vehicle.vehicleRegNo,
    status: vehicle.status,
    lat: latest.lat,
    lng: latest.lng,
    speedKph: latest.speedKph,
    fuelPct: latest.fuelPct,
    headingDeg: latest.headingDeg,
    activeAlertCount: openAlerts.length,
    maintenanceDue: false,
    updatedAt: latest.ts,
  } : undefined;

  const mapStates: VehicleState[] = vehicleState ? [vehicleState] : [];

  return (
    <div className="flex flex-col h-full bg-[#0f172a]">
      {/* Header */}
      <header className="flex items-center gap-4 px-6 py-3 border-b border-slate-800/60 bg-[#0c1322] flex-shrink-0">
        <Link href="/" className="flex items-center gap-1.5 text-slate-400 hover:text-white text-xs transition-colors">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Fleet
        </Link>
        <span className="text-slate-700">/</span>
        {vehicle ? (
          <>
            <h1 className="text-sm font-semibold text-white">{vehicle.vehicleRegNo}</h1>
            <span className={clsx('px-2 py-0.5 rounded text-[10px] font-bold', STATUS_BADGE[vehicle.status] ?? 'bg-slate-700 text-slate-300')}>
              {vehicle.status}
            </span>
            <span className="text-[11px] text-slate-500">{vehicle.vehicleType}</span>
          </>
        ) : (
          <span className="text-sm text-slate-500">Loading…</span>
        )}
        <div className="flex-1" />
        {openAlerts.length > 0 && (
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-red-900/50 text-red-300 text-[11px] font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
            {openAlerts.length} Alert{openAlerts.length > 1 ? 's' : ''}
          </span>
        )}
      </header>

      {!vehicle ? (
        <div className="flex-1 flex items-center justify-center text-slate-600 text-sm">Loading vehicle…</div>
      ) : (
        <div className="flex-1 flex overflow-hidden">
          {/* Left column */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* KPI strip */}
            <div className="flex gap-px bg-slate-800/40 border-b border-slate-800/60 flex-shrink-0">
              {[
                { label: 'Speed', value: fmt(latest?.speedKph, 'km/h', 1) },
                { label: 'Fuel', value: fmt(latest?.fuelPct, '%', 1) },
                { label: 'Odometer', value: fmt(vehicleState?.odometerKm, 'km', 0) },
                { label: 'Heading', value: fmt(latest?.headingDeg, '°', 0) },
                { label: 'Ignition', value: latest?.ignition ? 'ON' : latest ? 'OFF' : '—' },
                { label: 'Last Ping', value: latest ? fmtTs(latest.ts) : '—' },
              ].map((kpi) => (
                <div key={kpi.label} className="flex-1 px-4 py-3 bg-[#0c1322]">
                  <div className="text-[10px] font-medium text-slate-600 uppercase tracking-wide">{kpi.label}</div>
                  <div className="text-sm font-semibold text-white mt-0.5 tabular-nums">{kpi.value}</div>
                </div>
              ))}
            </div>

            {/* Map */}
            <div className="flex-1 min-h-0 relative">
              {mapStates.length > 0 ? (
                <FleetMap states={mapStates} />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-slate-600 text-sm bg-[#0c1322]">
                  No GPS fix available
                </div>
              )}
            </div>

            {/* Telemetry table */}
            <div className="h-52 flex-shrink-0 border-t border-slate-800/60 overflow-auto bg-[#0c1322]">
              <div className="px-4 pt-3 pb-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Recent Telemetry</div>
              {telemetry.length === 0 ? (
                <div className="px-4 py-6 text-sm text-slate-600">No telemetry history</div>
              ) : (
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="text-[10px] text-slate-600 uppercase tracking-wider">
                      <th className="px-4 py-1.5 text-left font-semibold">Time</th>
                      <th className="px-4 py-1.5 text-right font-semibold">Speed</th>
                      <th className="px-4 py-1.5 text-right font-semibold">Fuel %</th>
                      <th className="px-4 py-1.5 text-right font-semibold">Lat</th>
                      <th className="px-4 py-1.5 text-right font-semibold">Lng</th>
                      <th className="px-4 py-1.5 text-center font-semibold">Eng.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {telemetry.slice(0, 12).map((t, i) => (
                      <tr key={i} className="hover:bg-slate-800/20">
                        <td className="px-4 py-1.5 text-slate-400 font-mono">{fmtTs(t.ts)}</td>
                        <td className="px-4 py-1.5 text-right text-white tabular-nums">{fmt(t.speedKph, 'km/h', 1)}</td>
                        <td className="px-4 py-1.5 text-right text-white tabular-nums">{fmt(t.fuelPct, '%', 1)}</td>
                        <td className="px-4 py-1.5 text-right text-slate-400 font-mono">{t.lat?.toFixed(4) ?? '—'}</td>
                        <td className="px-4 py-1.5 text-right text-slate-400 font-mono">{t.lng?.toFixed(4) ?? '—'}</td>
                        <td className="px-4 py-1.5 text-center">
                          <span className={clsx('text-[10px] font-bold', t.ignition ? 'text-green-400' : 'text-slate-600')}>{t.ignition ? 'ON' : 'OFF'}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Right panel — alerts */}
          <div className="w-72 flex-shrink-0 border-l border-slate-800/60 flex flex-col bg-[#0c1322] overflow-hidden">
            <div className="px-4 pt-3 pb-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wider flex-shrink-0">
              Open Alerts <span className="ml-1 text-slate-600">({openAlerts.length})</span>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60">
              {openAlerts.length === 0 ? (
                <div className="px-4 py-6 text-sm text-slate-600 text-center">No open alerts</div>
              ) : (
                openAlerts.map((a) => (
                  <div key={a.id} className="px-4 py-3 hover:bg-slate-800/30">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span className={clsx('text-[10px] font-bold uppercase', SEVERITY_COLOR[a.severity] ?? 'text-slate-400')}>{a.severity}</span>
                      <span className="text-[10px] text-slate-600 flex-shrink-0">{fmtTs(a.createdTs)}</span>
                    </div>
                    <div className="text-xs text-white font-medium">{a.alertType.replace(/_/g, ' ')}</div>
                    {a.description && <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{a.description}</div>}
                  </div>
                ))
              )}
            </div>
            {/* Vehicle metadata */}
            <div className="border-t border-slate-800/60 px-4 py-3 flex-shrink-0 space-y-1">
              {[
                { label: 'Type', value: vehicle.vehicleType },
                { label: 'Depot', value: vehicle.depotId ?? '—' },
                { label: 'Driver', value: vehicle.assignedDriverId ?? 'Unassigned' },
              ].map((row) => (
                <div key={row.label} className="flex justify-between text-[11px]">
                  <span className="text-slate-600">{row.label}</span>
                  <span className="text-slate-300 font-medium truncate max-w-[60%] text-right">{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
