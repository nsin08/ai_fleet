'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState, useCallback } from 'react';
import useSWR, { mutate } from 'swr';
import Link from 'next/link';
import clsx from 'clsx';
import type { Vehicle, Alert, FleetMode, ScenarioDefinition, ScenarioRun, VehicleState } from '../lib/types';
import { API, WS_URL, fetcher, apiPost } from '../lib/api';

const FleetMap = dynamic(() => import('../components/fleet-map'), { ssr: false });

const SWR_OPT = { refreshInterval: 5000, revalidateOnFocus: false };

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
  const { data: modeData } = useSWR<FleetMode>(`${API}/api/fleet/mode`, fetcher, SWR_OPT);
  const { data: vehiclesResp } = useSWR<{ data: Vehicle[] }>(`${API}/api/fleet/vehicles?limit=100`, fetcher, SWR_OPT);
  const { data: statesResp } = useSWR<{ data: VehicleState[] }>(`${API}/api/fleet/states`, fetcher, { refreshInterval: 4000, revalidateOnFocus: false });
  const { data: alertsResp } = useSWR<{ data: Alert[] }>(`${API}/api/alerts?status=OPEN&limit=30`, fetcher, { refreshInterval: 4000, revalidateOnFocus: false });
  const { data: scenariosResp } = useSWR<{ data: ScenarioDefinition[] }>(`${API}/api/scenarios`, fetcher, { revalidateOnFocus: false });

  const vehicles = vehiclesResp?.data ?? [];
  const states = statesResp?.data ?? [];
  const alerts = alertsResp?.data ?? [];
  const scenarios = scenariosResp?.data ?? [];
  const fleetMode = modeData;

  const [liveEvents, setLiveEvents] = useState<string[]>([]);
  const [wsOk, setWsOk] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [activeRun, setActiveRun] = useState<ScenarioRun | null>(null);
  const [runLoading, setRunLoading] = useState(false);

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
            } else if (msg.type === 'event') {
              setLiveEvents((p) => [`EVENT: ${msg.data?.eventType} — ${msg.data?.vehicleRegNo ?? ''}`, ...p.slice(0, 49)]);
            } else if (msg.type === 'telemetry') {
              setLiveEvents((p) => [`${msg.data?.vehicleRegNo ?? msg.vehicleId?.slice(0, 8) ?? '?'} — ${msg.data?.speedKph?.toFixed(0) ?? '?'} km/h`, ...p.slice(0, 49)]);
              void mutate(`${API}/api/fleet/states`);
            } else if (msg.type === 'replayStatus') {
              setActiveRun(msg.data as ScenarioRun);
              void mutate(`${API}/api/fleet/mode`);
            }
          } catch { /* ignore */ }
        };
      } catch { /* ws unavailable */ }
    };
    connect();
    return () => { clearTimeout(retryTimer); ws?.close(); };
  }, []);

  const startScenario = useCallback(async (scenarioId: string) => {
    setRunLoading(true);
    try {
      const run = await apiPost<ScenarioRun>(`/api/scenarios/${scenarioId}/run`, { speedFactor: 2 });
      setActiveRun(run);
      void mutate(`${API}/api/fleet/mode`);
    } finally { setRunLoading(false); }
  }, []);

  const pauseRun = useCallback(async () => {
    if (!activeRun) return;
    setActiveRun(await apiPost<ScenarioRun>(`/api/scenarios/runs/${activeRun.id}/pause`));
  }, [activeRun]);

  const resumeRun = useCallback(async () => {
    if (!activeRun) return;
    setActiveRun(await apiPost<ScenarioRun>(`/api/scenarios/runs/${activeRun.id}/resume`));
  }, [activeRun]);

  const resetRun = useCallback(async () => {
    if (!activeRun) return;
    setActiveRun(await apiPost<ScenarioRun>(`/api/scenarios/runs/${activeRun.id}/reset`));
    void mutate(`${API}/api/fleet/mode`);
  }, [activeRun]);

  const isRunning = activeRun?.status === 'RUNNING';
  const isPaused = activeRun?.status === 'PAUSED';
  const hasActiveRun = isRunning || isPaused;

  const onTripCount = vehicles.filter((v) => ['ON_TRIP', 'on_trip'].includes(v.status)).length;
  const alertingCount = states.filter((s) => s.activeAlertCount > 0).length;

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
        <span className={clsx('px-2.5 py-0.5 rounded-full text-[11px] font-semibold', fleetMode?.mode === 'replay' ? 'bg-amber-900/60 text-amber-300' : fleetMode?.mode === 'live' ? 'bg-green-900/60 text-green-300' : 'bg-slate-800 text-slate-500')}>
          {fleetMode?.mode?.toUpperCase() ?? 'MODE'}
        </span>
      </div>

      {/* KPI strip */}
      <div className="flex gap-px bg-slate-800/40 border-b border-slate-800/60 flex-shrink-0">
        <StatCard label="Total Vehicles" value={vehicles.length} />
        <StatCard label="On Trip" value={onTripCount} valueClass={onTripCount > 0 ? 'text-green-400' : 'text-white'} />
        <StatCard label="Open Alerts" value={alerts.length} valueClass={alerts.length > 0 ? 'text-red-400' : 'text-white'} />
        <StatCard label="Alerting" value={alertingCount} valueClass={alertingCount > 0 ? 'text-orange-400' : 'text-white'} sub="vehicles with active alerts" />
      </div>

      {/* Scenario controls bar */}
      <div className="flex items-center gap-3 px-6 py-2 border-b border-slate-800/60 bg-[#0c1322]/60 flex-shrink-0 flex-wrap">
        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Replay</span>
        {!hasActiveRun ? (
          scenarios.map((s) => (
            <button key={s.id} onClick={() => startScenario(s.id)} disabled={runLoading}
              className="px-3 py-1 bg-blue-600/80 hover:bg-blue-600 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded text-[11px] font-medium transition-colors">
              {runLoading ? 'Starting…' : s.name}
            </button>
          ))
        ) : (
          <>
            <span className={clsx('flex items-center gap-1.5 text-[11px] font-semibold', isRunning ? 'text-green-400' : 'text-amber-400')}>
              <span className={clsx('w-1.5 h-1.5 rounded-full', isRunning ? 'bg-green-400 animate-pulse' : 'bg-amber-400')} />
              {activeRun?.status}
            </span>
            <span className="text-[11px] text-slate-600 font-mono">{activeRun?.id.slice(0, 8)}</span>
            {isRunning && <button onClick={pauseRun} className="px-2.5 py-0.5 bg-amber-700/70 hover:bg-amber-600 text-white rounded text-[11px] font-medium">Pause</button>}
            {isPaused && <button onClick={resumeRun} className="px-2.5 py-0.5 bg-green-700/70 hover:bg-green-600 text-white rounded text-[11px] font-medium">Resume</button>}
            <button onClick={resetRun} className="px-2.5 py-0.5 bg-slate-700 hover:bg-slate-600 text-white rounded text-[11px] font-medium">Reset</button>
          </>
        )}
      </div>

      {/* Main content */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Map */}
        <div className="flex-1 relative min-w-0">
          <FleetMap
            states={states}
            onVehicleClick={(id) => setSelectedVehicleId(id === selectedVehicleId ? null : id)}
          />
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
              const isSelected = selectedVehicleId === v.id;
              return (
                <Link key={v.id} href={`/vehicles/${v.id}`}
                  className={clsx('flex items-center gap-3 px-4 py-2.5 border-b border-slate-800/40 hover:bg-slate-800/30 transition-colors', isSelected && 'bg-blue-950/30 border-blue-800/40')}>
                  <span className={clsx('w-2 h-2 rounded-full flex-shrink-0', STATUS_DOT[v.status] ?? 'bg-slate-600')} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-semibold text-white truncate">{v.vehicleRegNo}</div>
                    <div className="text-[10px] text-slate-500 capitalize">{v.status.toLowerCase().replace(/_/g, ' ')}</div>
                  </div>
                  {(st?.activeAlertCount ?? 0) > 0 && (
                    <span className="text-[10px] font-bold text-red-400 flex-shrink-0">{st!.activeAlertCount}</span>
                  )}
                  {st?.speedKph != null && st.speedKph > 0 && (
                    <span className="text-[10px] text-slate-600 flex-shrink-0 tabular-nums">{st.speedKph.toFixed(0)}</span>
                  )}
                </Link>
              );
            })}
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
