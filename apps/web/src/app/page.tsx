'use client';

import { useEffect, useState, useCallback } from 'react';
import useSWR, { mutate } from 'swr';
import Link from 'next/link';
import clsx from 'clsx';
import type {
  Vehicle,
  Alert,
  FleetMode,
  ScenarioDefinition,
  ScenarioRun,
} from '../lib/types';
import { API, WS_URL, fetcher, apiPost } from '../lib/api';

export default function HomePage() {
  /* ── data fetching ── */
  const { data: fleetMode } = useSWR<FleetMode>(`${API}/api/fleet/mode`, fetcher, {
    refreshInterval: 3000,
  });
  const { data: vehiclesResp } = useSWR<{ data: Vehicle[] }>(
    `${API}/api/fleet/vehicles?limit=50`,
    fetcher,
    { refreshInterval: 5000 },
  );
  const { data: alertsResp } = useSWR<{ data: Alert[] }>(
    `${API}/api/alerts?status=OPEN&limit=20`,
    fetcher,
    { refreshInterval: 3000 },
  );
  const { data: scenariosResp } = useSWR<{ data: ScenarioDefinition[] }>(
    `${API}/api/scenarios`,
    fetcher,
  );

  /* ── state ── */
  const [selectedScenario, setSelectedScenario] = useState<string>('');
  const [activeRun, setActiveRun] = useState<ScenarioRun | null>(null);
  const [runLoading, setRunLoading] = useState(false);
  const [liveEvents, setLiveEvents] = useState<string[]>([]);
  const [wsConnected, setWsConnected] = useState(false);

  const vehicles = vehiclesResp?.data ?? [];
  const alerts = alertsResp?.data ?? [];
  const scenarios = scenariosResp?.data ?? [];

  /* ── WebSocket ── */
  useEffect(() => {
    let ws: WebSocket;
    let retryTimer: ReturnType<typeof setTimeout>;
    const connect = () => {
      ws = new WebSocket(WS_URL);
      ws.onopen = () => setWsConnected(true);
      ws.onclose = () => {
        setWsConnected(false);
        retryTimer = setTimeout(connect, 3000);
      };
      ws.onerror = () => ws.close();
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data as string);
          if (msg.type === 'alert') {
            setLiveEvents((prev) => [
              `🔴 ALERT: ${msg.data.alertType} — ${msg.data.title}`,
              ...prev.slice(0, 49),
            ]);
            void mutate(`${API}/api/alerts?status=OPEN&limit=20`);
          } else if (msg.type === 'event') {
            setLiveEvents((prev) => [
              `⚡ EVENT: ${msg.data.eventType} — ${msg.data.vehicleRegNo}`,
              ...prev.slice(0, 49),
            ]);
          } else if (msg.type === 'telemetry') {
            setLiveEvents((prev) => [
              `📡 ${msg.data.vehicleRegNo ?? msg.vehicleId?.slice(0, 8)} — ${msg.data.speedKph?.toFixed(0) ?? '?'} kph`,
              ...prev.slice(0, 49),
            ]);
          } else if (msg.type === 'replayStatus') {
            setActiveRun(msg.data);
            void mutate(`${API}/api/fleet/mode`);
          }
        } catch {
          /* ignore bad frames */
        }
      };
    };
    connect();
    return () => {
      clearTimeout(retryTimer);
      ws?.close();
    };
  }, []);

  /* ── scenario actions ── */
  const startScenario = useCallback(async () => {
    if (!selectedScenario) return;
    setRunLoading(true);
    try {
      const run = await apiPost<ScenarioRun>(
        `/api/scenarios/${selectedScenario}/run`,
        { speedFactor: 2 },
      );
      setActiveRun(run);
      void mutate(`${API}/api/fleet/mode`);
    } finally {
      setRunLoading(false);
    }
  }, [selectedScenario]);

  const pauseRun = useCallback(async () => {
    if (!activeRun) return;
    const run = await apiPost<ScenarioRun>(`/api/scenarios/runs/${activeRun.id}/pause`);
    setActiveRun(run);
  }, [activeRun]);

  const resumeRun = useCallback(async () => {
    if (!activeRun) return;
    const run = await apiPost<ScenarioRun>(`/api/scenarios/runs/${activeRun.id}/resume`);
    setActiveRun(run);
  }, [activeRun]);

  const resetRun = useCallback(async () => {
    if (!activeRun) return;
    const run = await apiPost<ScenarioRun>(`/api/scenarios/runs/${activeRun.id}/reset`);
    setActiveRun(run);
    void mutate(`${API}/api/fleet/mode`);
  }, [activeRun]);

  const isRunning = activeRun?.status === 'RUNNING';
  const isPaused = activeRun?.status === 'PAUSED';
  const hasActiveRun = isRunning || isPaused;

  /* ── render ── */
  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Fleet Overview</h1>
          <p className="text-sm text-slate-400 mt-0.5">Real-time fleet operations dashboard</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Connection indicator */}
          <span
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium',
              wsConnected ? 'bg-green-900/50 text-green-300' : 'bg-red-900/50 text-red-300',
            )}
          >
            <span
              className={clsx(
                'w-2 h-2 rounded-full',
                wsConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400',
              )}
            />
            {wsConnected ? 'Connected' : 'Disconnected'}
          </span>
          {/* Mode badge */}
          <span
            className={clsx(
              'px-3 py-1 rounded-full text-sm font-medium',
              fleetMode?.mode === 'live'
                ? 'bg-green-700 text-green-100'
                : fleetMode?.mode === 'replay'
                  ? 'bg-yellow-700 text-yellow-100'
                  : 'bg-slate-700 text-slate-300',
            )}
          >
            {fleetMode?.mode ?? 'loading…'}
          </span>
        </div>
      </header>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Total Vehicles" value={vehicles.length} />
        <KpiCard
          label="On Trip"
          value={vehicles.filter((v) => v.status === 'on_trip').length}
          color="green"
        />
        <KpiCard label="Open Alerts" value={alerts.length} color="red" />
        <KpiCard
          label="Fleet Mode"
          value={fleetMode?.mode?.toUpperCase() ?? '—'}
          color={fleetMode?.mode === 'live' ? 'green' : 'yellow'}
        />
      </div>

      {/* Scenario Controls */}
      <section className="bg-slate-800 rounded-xl p-4">
        <h2 className="font-semibold text-blue-300 mb-3">Scenario Controls</h2>
        <div className="flex flex-wrap items-center gap-3">
          {!hasActiveRun ? (
            <>
              <select
                value={selectedScenario}
                onChange={(e) => setSelectedScenario(e.target.value)}
                className="bg-slate-700 text-slate-200 rounded-lg px-3 py-2 text-sm border border-slate-600 focus:outline-none focus:border-blue-500"
              >
                <option value="">Select scenario…</option>
                {scenarios.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({Math.round(s.timelineSec / 60)}m)
                  </option>
                ))}
              </select>
              <button
                onClick={startScenario}
                disabled={!selectedScenario || runLoading}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600 disabled:text-slate-400 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {runLoading ? 'Starting…' : '▶ Start Replay'}
              </button>
            </>
          ) : (
            <>
              <span className="text-sm text-slate-300">
                Run:{' '}
                <span className="font-mono text-blue-300">{activeRun!.id.slice(0, 8)}</span>
              </span>
              <span
                className={clsx(
                  'px-2 py-0.5 rounded text-xs font-medium',
                  isRunning
                    ? 'bg-green-800 text-green-200'
                    : 'bg-yellow-800 text-yellow-200',
                )}
              >
                {activeRun!.status}
              </span>
              {isRunning && (
                <button
                  onClick={pauseRun}
                  className="px-3 py-1.5 bg-yellow-600 hover:bg-yellow-500 text-white rounded-lg text-sm transition-colors"
                >
                  ⏸ Pause
                </button>
              )}
              {isPaused && (
                <button
                  onClick={resumeRun}
                  className="px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm transition-colors"
                >
                  ▶ Resume
                </button>
              )}
              <button
                onClick={resetRun}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm transition-colors"
              >
                ⏹ Reset
              </button>
            </>
          )}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Vehicle Table (2/3) */}
        <section className="lg:col-span-2 bg-slate-800 rounded-xl p-4">
          <h2 className="font-semibold text-blue-300 mb-3">
            Vehicles <span className="text-slate-500 text-sm font-normal">({vehicles.length})</span>
          </h2>
          {vehicles.length === 0 ? (
            <p className="text-slate-500 text-sm">No vehicles loaded</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-400 border-b border-slate-700">
                    <th className="pb-2 pr-4">Reg No</th>
                    <th className="pb-2 pr-4">Name</th>
                    <th className="pb-2 pr-4">Type</th>
                    <th className="pb-2 pr-4">Status</th>
                    <th className="pb-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {vehicles.map((v) => (
                    <tr key={v.id} className="hover:bg-slate-700/30 transition-colors">
                      <td className="py-2 pr-4">
                        <span className="font-mono text-blue-200">{v.vehicleRegNo}</span>
                      </td>
                      <td className="py-2 pr-4 text-slate-300 truncate max-w-[160px]">
                        {v.name}
                      </td>
                      <td className="py-2 pr-4">
                        <span className="text-xs px-2 py-0.5 rounded bg-slate-700 text-slate-300 capitalize">
                          {v.vehicleType}
                        </span>
                      </td>
                      <td className="py-2 pr-4">
                        <StatusBadge status={v.status} />
                      </td>
                      <td className="py-2 text-right">
                        <Link
                          href={`/vehicles/${v.id}`}
                          className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                        >
                          Details →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Alerts sidebar (1/3) */}
        <section className="bg-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-red-300">Open Alerts</h2>
            <Link
              href="/alerts"
              className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >
              View All →
            </Link>
          </div>
          {alerts.length === 0 ? (
            <p className="text-slate-500 text-sm">No open alerts</p>
          ) : (
            <ul className="space-y-2 max-h-80 overflow-y-auto">
              {alerts.map((a) => (
                <li key={a.id} className="text-sm border-b border-slate-700 pb-2">
                  <div className="flex justify-between items-start">
                    <span className="font-medium text-red-200">{a.alertType}</span>
                    <SeverityBadge severity={a.severity} />
                  </div>
                  <p className="text-slate-400 text-xs mt-0.5 truncate">{a.title}</p>
                  <p className="text-slate-500 text-xs font-mono mt-0.5">
                    {a.vehicleRegNo}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Live event feed */}
      <section className="bg-slate-800 rounded-xl p-4">
        <h2 className="font-semibold text-slate-300 mb-3">
          Live Event Feed
          {liveEvents.length > 0 && (
            <span className="text-xs text-slate-500 ml-2 font-normal">
              ({liveEvents.length} events)
            </span>
          )}
        </h2>
        <div className="font-mono text-xs text-slate-400 space-y-1 h-48 overflow-y-auto">
          {liveEvents.length === 0 ? (
            <p className="text-slate-600">
              Waiting for events… Start a scenario to see real-time data.
            </p>
          ) : (
            liveEvents.map((e, i) => (
              <p key={i} className="leading-relaxed">
                {e}
              </p>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

/* ── Sub-components ── */

function KpiCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number | string;
  color?: 'green' | 'red' | 'yellow';
}) {
  const valueColor =
    color === 'green'
      ? 'text-green-400'
      : color === 'red'
        ? 'text-red-400'
        : color === 'yellow'
          ? 'text-yellow-400'
          : 'text-white';
  return (
    <div className="bg-slate-800 rounded-xl p-4">
      <p className="text-slate-400 text-sm">{label}</p>
      <p className={clsx('text-3xl font-bold mt-1', valueColor)}>{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, string> = {
    on_trip: 'bg-green-800 text-green-200',
    idle: 'bg-blue-900 text-blue-300',
    parked: 'bg-slate-700 text-slate-300',
    maintenance_due: 'bg-orange-900 text-orange-200',
    alerting: 'bg-red-900 text-red-200',
  };
  return (
    <span
      className={clsx(
        'px-2 py-0.5 rounded text-xs font-medium',
        config[status] ?? 'bg-slate-700 text-slate-400',
      )}
    >
      {status.replace(/_/g, ' ')}
    </span>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const s = severity.toUpperCase();
  const config: Record<string, string> = {
    HIGH: 'bg-red-900 text-red-200',
    MEDIUM: 'bg-orange-900 text-orange-200',
    LOW: 'bg-yellow-900 text-yellow-200',
  };
  return (
    <span
      className={clsx(
        'px-2 py-0.5 rounded text-xs font-medium',
        config[s] ?? 'bg-slate-700 text-slate-400',
      )}
    >
      {severity}
    </span>
  );
}
