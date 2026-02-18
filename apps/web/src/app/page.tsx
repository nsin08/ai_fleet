'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';

const API = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';
const WS_URL = process.env['NEXT_PUBLIC_WS_URL'] ?? 'ws://localhost:3001/ws';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Vehicle {
  id: string;
  vehicleRegNo: string;
  name: string;
  vehicleType: string;
  depotId: string;
  status: string;
  isActive: boolean;
}

interface Alert {
  id: string;
  vehicleId: string;
  eventType: string;
  severity: string;
  message: string;
  status: string;
  ts: string;
}

interface FleetMode {
  mode: string;
  active_run_id: string | null;
}

export default function HomePage() {
  const { data: fleetMode } = useSWR<FleetMode>(`${API}/api/fleet/mode`, fetcher, {
    refreshInterval: 5000,
  });
  const { data: vehiclesResp } = useSWR<{ data: Vehicle[] }>(
    `${API}/api/fleet/vehicles?limit=20`,
    fetcher,
    { refreshInterval: 10000 },
  );
  const { data: alertsResp } = useSWR<{ data: Alert[] }>(
    `${API}/api/alerts?status=OPEN&limit=10`,
    fetcher,
    { refreshInterval: 5000 },
  );

  const [liveEvents, setLiveEvents] = useState<string[]>([]);

  useEffect(() => {
    const ws = new WebSocket(WS_URL);
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data as string);
        if (msg.type === 'alert') {
          setLiveEvents((prev) => [
            `[ALERT] ${msg.data.eventType} — ${msg.data.message}`,
            ...prev.slice(0, 19),
          ]);
        } else if (msg.type === 'event') {
          setLiveEvents((prev) => [
            `[EVENT] ${msg.data.type} — vehicle ${msg.data.vehicleId.slice(0, 8)}`,
            ...prev.slice(0, 19),
          ]);
        }
      } catch {/* ignore */}
    };
    return () => ws.close();
  }, []);

  const vehicles = vehiclesResp?.data ?? [];
  const alerts = alertsResp?.data ?? [];

  return (
    <main className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-blue-400">AI Fleet Operations</h1>
        <span
          className={`px-3 py-1 rounded-full text-sm font-medium ${
            fleetMode?.mode === 'live'
              ? 'bg-green-700 text-green-100'
              : fleetMode?.mode === 'replay'
                ? 'bg-yellow-700 text-yellow-100'
                : 'bg-slate-700 text-slate-300'
          }`}
        >
          {fleetMode?.mode ?? 'loading…'}
        </span>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Stats */}
        <div className="bg-slate-800 rounded-xl p-4">
          <p className="text-slate-400 text-sm">Active Vehicles</p>
          <p className="text-3xl font-bold">{vehicles.length}</p>
        </div>
        <div className="bg-slate-800 rounded-xl p-4">
          <p className="text-slate-400 text-sm">Open Alerts</p>
          <p className="text-3xl font-bold text-red-400">{alerts.length}</p>
        </div>
        <div className="bg-slate-800 rounded-xl p-4">
          <p className="text-slate-400 text-sm">Fleet Mode</p>
          <p className="text-3xl font-bold capitalize">{fleetMode?.mode ?? '—'}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Vehicles */}
        <section className="bg-slate-800 rounded-xl p-4">
          <h2 className="font-semibold text-blue-300 mb-3">Vehicles</h2>
          {vehicles.length === 0 ? (
            <p className="text-slate-500 text-sm">No vehicles found</p>
          ) : (
            <ul className="space-y-2">
              {vehicles.map((v) => (
                <li
                  key={v.id}
                  className="flex justify-between items-center text-sm border-b border-slate-700 pb-2"
                >
                  <span className="font-mono text-blue-200">{v.vehicleRegNo}</span>
                  <span className="text-slate-400 truncate max-w-[120px]">{v.name}</span>
                  <span className="text-slate-500 text-xs">{v.vehicleType}</span>
                  <span
                    className={`px-2 py-0.5 rounded text-xs ${
                      v.status === 'on_trip'
                        ? 'bg-green-800 text-green-200'
                        : v.status === 'idle'
                          ? 'bg-blue-900 text-blue-300'
                          : 'bg-slate-700 text-slate-400'
                    }`}
                  >
                    {v.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Alerts */}
        <section className="bg-slate-800 rounded-xl p-4">
          <h2 className="font-semibold text-red-300 mb-3">Open Alerts</h2>
          {alerts.length === 0 ? (
            <p className="text-slate-500 text-sm">No open alerts</p>
          ) : (
            <ul className="space-y-2">
              {alerts.map((a) => (
                <li key={a.id} className="text-sm border-b border-slate-700 pb-2">
                  <div className="flex justify-between">
                    <span className="font-medium text-red-200">{a.eventType}</span>
                    <span
                      className={`px-2 py-0.5 rounded text-xs ${
                        a.severity === 'critical'
                          ? 'bg-red-900 text-red-200'
                          : a.severity === 'high'
                            ? 'bg-orange-900 text-orange-200'
                            : 'bg-yellow-900 text-yellow-200'
                      }`}
                    >
                      {a.severity}
                    </span>
                  </div>
                  <p className="text-slate-400 truncate">{a.message}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Live event feed */}
      <section className="bg-slate-800 rounded-xl p-4">
        <h2 className="font-semibold text-slate-300 mb-3">Live Event Feed</h2>
        <div className="font-mono text-xs text-slate-400 space-y-1 h-40 overflow-y-auto">
          {liveEvents.length === 0 ? (
            <p className="text-slate-600">Waiting for events…</p>
          ) : (
            liveEvents.map((e, i) => <p key={i}>{e}</p>)
          )}
        </div>
      </section>
    </main>
  );
}
