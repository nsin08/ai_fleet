'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import useSWR, { mutate } from 'swr';
import Link from 'next/link';
import clsx from 'clsx';
import type {
  Vehicle,
  Alert,
  VehicleState,
  InventorySnapshot,
  TripSummary,
  TripDetail,
} from '../lib/types';
import { API, WS_URL, fetcher } from '../lib/api';

const FleetMap = dynamic(() => import('../components/fleet-map'), { ssr: false });

const SWR_OPT = { refreshInterval: 5000, revalidateOnFocus: false };

/** Safely format a number that may come as string from the DB */
function n(v: unknown, decimals = 0): string {
  if (v == null) return '—';
  const num = Number(v);
  return isNaN(num) ? '—' : num.toFixed(decimals);
}

const STATUS_DOT: Record<string, string> = {
  ON_TRIP: 'bg-green-400', on_trip: 'bg-green-400',
  ALERTING: 'bg-red-400 animate-pulse', alerting: 'bg-red-400 animate-pulse',
  IDLE: 'bg-blue-400', idle: 'bg-blue-400',
  PARKED: 'bg-slate-400', parked: 'bg-slate-400',
  MAINTENANCE: 'bg-orange-400',
  OFFLINE: 'bg-slate-600',
};
const SEVERITY_BG: Record<string, string> = {
  CRITICAL: 'bg-red-950/70 text-red-300 border-red-800/60',
  HIGH: 'bg-red-900/60 text-red-300 border-red-800/60',
  MEDIUM: 'bg-orange-900/60 text-orange-300 border-orange-800/60',
  LOW: 'bg-yellow-900/50 text-yellow-300 border-yellow-800/50',
};

function StatCard({ label, value, sub, valueClass = 'text-white' }: {
  label: string; value: number | string; sub?: string; valueClass?: string;
}) {
  return (
    <div className="px-6 py-3 bg-[#0c1322]">
      <div className="text-[10px] font-medium text-slate-600 uppercase tracking-wide">{label}</div>
      <div className={clsx('text-2xl font-bold mt-0.5 leading-tight tabular-nums', valueClass)}>{value}</div>
      {sub && <div className="text-[10px] text-slate-600 mt-0.5">{sub}</div>}
    </div>
  );
}

export default function DashboardPage() {
  const { data: vehiclesResp } = useSWR<{ data: Vehicle[] }>(`${API}/api/fleet/vehicles?limit=100`, fetcher, SWR_OPT);
  const { data: statesResp } = useSWR<{ data: VehicleState[] }>(`${API}/api/fleet/states`, fetcher, { refreshInterval: 4000, revalidateOnFocus: false });
  const { data: alertsResp } = useSWR<{ data: Alert[] }>(`${API}/api/alerts?status=OPEN&limit=30`, fetcher, { refreshInterval: 4000, revalidateOnFocus: false });
  const { data: inventory } = useSWR<InventorySnapshot>(`${API}/api/fleet/inventory`, fetcher, SWR_OPT);
  const { data: recentTripsResp } = useSWR<{ data: TripSummary[] }>(`${API}/api/fleet/trips?limit=15`, fetcher, SWR_OPT);

  const vehicles = vehiclesResp?.data ?? [];
  const states = statesResp?.data ?? [];
  const alerts = alertsResp?.data ?? [];
  const recentTrips = recentTripsResp?.data ?? [];

  const [liveEvents, setLiveEvents] = useState<string[]>([]);
  const [wsOk, setWsOk] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);

  // Vehicle trail tracking — keep last 30 positions per vehicle
  const trailsRef = useRef<Map<string, [number, number][]>>(new Map());
  const [trails, setTrails] = useState<Map<string, [number, number][]>>(new Map());

  const { data: selectedTrip } = useSWR<TripDetail>(
    selectedTripId ? `${API}/api/fleet/trips/${selectedTripId}` : null,
    fetcher,
    SWR_OPT,
  );
  const { data: trailResp } = useSWR<{ tripId: string; points: [number, number][] }>(
    selectedTripId ? `${API}/api/fleet/trips/${selectedTripId}/trail` : null,
    fetcher,
    { revalidateOnFocus: false, revalidateOnReconnect: false },
  );
  const tripTrail = trailResp?.points;

  useEffect(() => {
    let ws: WebSocket;
    let retryTimer: ReturnType<typeof setTimeout>;
    const connect = () => {
      try {
        ws = new WebSocket(WS_URL);
        ws.onopen = () => setWsOk(true);
        ws.onclose = () => { setWsOk(false); retryTimer = setTimeout(connect, 3000); };
        ws.onerror = () => ws.close();
        ws.onmessage = (ev) => {
          try {
            const msg = JSON.parse(ev.data as string);
            if (msg.type === 'alert') {
              setLiveEvents((p) => [`ALERT: ${msg.data?.alertType} — ${msg.data?.title ?? ''}`, ...p.slice(0, 49)]);
              void mutate(`${API}/api/alerts?status=OPEN&limit=30`);
              void mutate(`${API}/api/fleet/states`);
              void mutate(`${API}/api/fleet/inventory`);
            } else if (msg.type === 'vehicleState') {
              void mutate(`${API}/api/fleet/states`);
              void mutate(`${API}/api/fleet/inventory`);
              // Update trail for this vehicle
              const d = msg.data as Partial<VehicleState>;
              if (d?.vehicleId && d.lat != null && d.lng != null) {
                const trail = trailsRef.current.get(d.vehicleId) ?? [];
                trail.push([Number(d.lat), Number(d.lng)]);
                if (trail.length > 30) trail.splice(0, trail.length - 30);
                trailsRef.current.set(d.vehicleId, trail);
                setTrails(new Map(trailsRef.current));
              }
            } else if (msg.type === 'event') {
              void mutate(`${API}/api/fleet/trips?limit=15`);
              setLiveEvents((p) => [`EVENT: ${msg.data?.eventType} — ${msg.data?.vehicleRegNo ?? ''}`, ...p.slice(0, 49)]);
            } else if (msg.type === 'telemetry') {
              void mutate(`${API}/api/fleet/inventory`);
              setLiveEvents((p) => [`${msg.data?.vehicleRegNo ?? msg.vehicleId?.slice(0, 8) ?? '?'} — ${n(msg.data?.speedKph)} km/h`, ...p.slice(0, 49)]);
              void mutate(`${API}/api/fleet/states`);
            }
          } catch { /* ignore */ }
        };
      } catch { /* ws unavailable */ }
    };
    connect();
    return () => { clearTimeout(retryTimer); ws?.close(); };
  }, []);

  useEffect(() => {
    if (!selectedTripId && recentTrips.length > 0) {
      setSelectedTripId(recentTrips[0]!.id);
    }
  }, [recentTrips, selectedTripId]);

  const onTripCount = inventory?.totals.onTrip
    ?? states.filter((s) => ['ON_TRIP', 'on_trip'].includes(s.status)).length;
  const alertingCount = inventory?.totals.alerting
    ?? states.filter((s) => s.activeAlertCount > 0).length;
  const activeTripCount = inventory?.totals.activeTrips
    ?? recentTrips.filter((t) => ['planned', 'active', 'paused'].includes(t.status)).length;
  const completedTripCount = inventory?.totals.completedTrips
    ?? recentTrips.filter((t) => ['completed', 'cancelled'].includes(t.status)).length;
  const fmtTs = (ts?: string) => (ts ? new Date(ts).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-');
  const fmtKm = (km?: number) => (km == null ? '-' : `${Number(km).toFixed(1)} km`);

  return (
    <div className="flex flex-col h-full bg-[#0f172a] overflow-hidden">
      {/* Top header bar */}
      <div className="flex items-center gap-4 px-6 py-2.5 border-b border-slate-800/60 bg-[#0c1322] flex-shrink-0">
        <div className="flex-1">
          <span className="text-sm font-semibold text-white">Fleet Operations</span>
          <span className="text-[11px] text-slate-500 ml-3">{new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
        </div>
        <span className={clsx('flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium', wsOk ? 'bg-green-950/60 text-green-400' : 'bg-slate-800 text-slate-500')}>
          <span className={clsx('w-1.5 h-1.5 rounded-full', wsOk ? 'bg-green-400 animate-pulse' : 'bg-slate-600')} />
          {wsOk ? 'Live' : 'Connecting'}
        </span>
      </div>

      {/* KPI strip */}
      <div className="flex gap-px bg-slate-800/40 border-b border-slate-800/60 flex-shrink-0">
        <StatCard label="Total Vehicles" value={vehicles.length} />
        <StatCard label="On Trip" value={onTripCount} valueClass={onTripCount > 0 ? 'text-green-400' : 'text-white'} />
        <StatCard label="Open Alerts" value={alerts.length} valueClass={alerts.length > 0 ? 'text-red-400' : 'text-white'} />
        <StatCard label="Active Trips" value={activeTripCount} valueClass={activeTripCount > 0 ? 'text-cyan-300' : 'text-white'} />
        <StatCard label="Completed Trips" value={completedTripCount} valueClass={completedTripCount > 0 ? 'text-blue-300' : 'text-white'} />
        <StatCard label="Alerting" value={alertingCount} valueClass={alertingCount > 0 ? 'text-orange-400' : 'text-white'} sub="vehicles with active alerts" />
      </div>

      {/* Main content */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Map + trip history */}
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex-1 relative min-h-0">
            <FleetMap
              states={states}
              trails={trails}
              tripTrail={tripTrail}
              onVehicleClick={(id) => setSelectedVehicleId(id === selectedVehicleId ? null : id)}
            />
          </div>

          <div className="h-64 border-t border-slate-800/60 bg-[#0c1322] grid grid-cols-2 min-h-0">
            <div className="border-r border-slate-800/60 flex flex-col min-h-0">
              <div className="px-4 pt-2 pb-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                <span>Previous Trips</span>
                <span className="text-slate-700">{recentTrips.length}</span>
              </div>
              <div className="flex-1 overflow-y-auto divide-y divide-slate-800/40">
                {recentTrips.length === 0 ? (
                  <div className="px-4 py-4 text-[11px] text-slate-700">No trip history</div>
                ) : (
                  recentTrips.map((trip) => (
                    <button
                      key={trip.id}
                      type="button"
                      onClick={() => setSelectedTripId(trip.id)}
                      className={clsx(
                        'w-full text-left px-4 py-2 hover:bg-slate-800/30 transition-colors',
                        selectedTripId === trip.id && 'bg-blue-950/30',
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-semibold text-white">{trip.vehicleRegNo}</span>
                        <span className={clsx(
                          'px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase',
                          trip.status === 'completed' ? 'bg-green-900/60 text-green-300' :
                            trip.status === 'cancelled' ? 'bg-red-900/60 text-red-300' :
                              'bg-blue-900/60 text-blue-300',
                        )}>
                          {trip.status}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5 truncate">
                        {trip.routeName ?? 'Unassigned route'} | {trip.driverName ?? trip.driverId}
                      </div>
                      <div className="text-[10px] text-slate-600 mt-0.5">
                        {fmtTs(trip.startedAt)}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="flex flex-col min-h-0">
              <div className="px-4 pt-2 pb-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                Trip Details
              </div>
              <div className="flex-1 overflow-y-auto px-4 pb-3">
                {!selectedTrip ? (
                  <div className="text-[11px] text-slate-700 pt-2">Select a trip to view details</div>
                ) : (
                  <div className="space-y-2 text-[11px]">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-slate-900/50 rounded px-2 py-1.5">
                        <div className="text-slate-600 text-[9px] uppercase">Vehicle</div>
                        <div className="text-white font-semibold">{selectedTrip.vehicleRegNo}</div>
                      </div>
                      <div className="bg-slate-900/50 rounded px-2 py-1.5">
                        <div className="text-slate-600 text-[9px] uppercase">Driver</div>
                        <div className="text-white font-semibold truncate">{selectedTrip.driverName ?? selectedTrip.driverId}</div>
                      </div>
                      <div className="bg-slate-900/50 rounded px-2 py-1.5">
                        <div className="text-slate-600 text-[9px] uppercase">Route</div>
                        <div className="text-white font-semibold truncate">{selectedTrip.routeName ?? '-'}</div>
                      </div>
                      <div className="bg-slate-900/50 rounded px-2 py-1.5">
                        <div className="text-slate-600 text-[9px] uppercase">Distance</div>
                        <div className="text-white font-semibold">{fmtKm(selectedTrip.actualDistanceKm ?? selectedTrip.plannedDistanceKm)}</div>
                      </div>
                    </div>
                    <div className="text-slate-500">
                      <span className="text-slate-600">Start:</span> {fmtTs(selectedTrip.startedAt)}
                    </div>
                    <div className="text-slate-500">
                      <span className="text-slate-600">End:</span> {fmtTs(selectedTrip.endedAt)}
                    </div>
                    <div className="text-slate-500">
                      <span className="text-slate-600">Stops:</span> {selectedTrip.stops?.length ?? selectedTrip.stopCount ?? 0}
                    </div>
                    {selectedTrip.endReason && (
                      <div className="text-slate-500">
                        <span className="text-slate-600">End reason:</span> {selectedTrip.endReason}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right panel */}
        <div className="w-72 flex-shrink-0 border-l border-slate-800/60 flex flex-col overflow-hidden bg-[#0c1322]">
          {/* Vehicle list */}
          <div className="flex-1 overflow-y-auto min-h-0">
            <div className="px-4 pt-3 pb-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wider sticky top-0 bg-[#0c1322] z-10">
              Vehicles <span className="text-slate-700">({vehicles.length})</span>
            </div>
            {vehicles.map((v) => {
              const st = states.find((s) => s.vehicleId === v.id);
              const status = st?.status ?? v.status;
              const isSelected = selectedVehicleId === v.id;
              return (
                <Link key={v.id} href={`/vehicles/${v.id}`}
                  className={clsx('flex items-center gap-3 px-4 py-2.5 border-b border-slate-800/40 hover:bg-slate-800/30 transition-colors', isSelected && 'bg-blue-950/30 border-blue-800/40')}>
                  <span className={clsx('w-2 h-2 rounded-full flex-shrink-0', STATUS_DOT[status] ?? 'bg-slate-600')} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-semibold text-white truncate">{v.vehicleRegNo}</div>
                    <div className="text-[10px] text-slate-500 capitalize">{status.toLowerCase().replace(/_/g, ' ')}</div>
                  </div>
                  {(st?.activeAlertCount != null && Number(st.activeAlertCount) > 0) && (
                    <span className="text-[10px] font-bold text-red-400 flex-shrink-0">{st!.activeAlertCount}</span>
                  )}
                  {st?.speedKph != null && Number(st.speedKph) > 0 && (
                    <span className="text-[10px] text-slate-600 flex-shrink-0 tabular-nums">{n(st.speedKph)}</span>
                  )}
                </Link>
              );
            })}
          </div>

          {/* Inventory */}
          <div className="h-44 flex-shrink-0 border-t border-slate-800/60 flex flex-col">
            <div className="px-4 pt-2 pb-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Inventory</div>
            <div className="flex-1 overflow-y-auto px-4 pb-2 space-y-2">
              {inventory?.byType?.length ? (
                inventory.byType.map((row) => (
                  <div key={row.vehicleType} className="text-[10px]">
                    <div className="flex items-center justify-between text-slate-400">
                      <span className="uppercase">{row.vehicleType}</span>
                      <span className="text-white font-semibold">{row.count}</span>
                    </div>
                    <div className="text-slate-600">
                      on trip {row.onTrip} | idle {row.idle} | parked {row.parked}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-[11px] text-slate-700 pt-1">Inventory summary unavailable</div>
              )}
            </div>
          </div>

          {/* Live event feed */}
          <div className="h-48 flex-shrink-0 border-t border-slate-800/60 flex flex-col">
            <div className="px-4 pt-2 pb-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wider flex-shrink-0">Live Feed</div>
            <div className="flex-1 overflow-y-auto px-4 pb-2 space-y-1">
              {liveEvents.length === 0 ? (
                <div className="text-[11px] text-slate-700 pt-2">Waiting for events…</div>
              ) : (
                liveEvents.map((e, i) => (
                  <div key={i} className="text-[10px] text-slate-500 leading-relaxed font-mono truncate">{e}</div>
                ))
              )}
            </div>
          </div>

          {/* Open alerts */}
          <div className="h-60 flex-shrink-0 border-t border-slate-800/60 flex flex-col">
            <div className="flex items-center justify-between px-4 pt-2 pb-1 flex-shrink-0">
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Alerts</span>
              <Link href="/alerts" className="text-[10px] text-blue-500 hover:text-blue-400">All</Link>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-slate-800/40">
              {alerts.length === 0 ? (
                <div className="px-4 py-3 text-[11px] text-slate-700">No open alerts</div>
              ) : (
                alerts.map((a) => (
                  <div key={a.id} className="px-4 py-2 hover:bg-slate-800/20">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className={clsx('px-1.5 py-0 rounded text-[9px] font-bold border', SEVERITY_BG[a.severity] ?? 'bg-slate-800 text-slate-400 border-slate-700')}>{a.severity}</span>
                      <span className="text-[10px] text-slate-400 truncate flex-1">{a.vehicleRegNo}</span>
                    </div>
                    <div className="text-[11px] text-white font-medium truncate">{a.alertType.replace(/_/g, ' ')}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
