'use client';

import { useMemo, useState, useCallback } from 'react';
import useSWR, { mutate } from 'swr';
import clsx from 'clsx';
import Link from 'next/link';
import { API, fetcher, apiPost } from '../../lib/api';
import type { TripSummary, Vehicle, TripDispatchDetail, TripException, DriverSummary } from '../../lib/types';

type TripStatus = 'all' | 'planned' | 'active' | 'paused' | 'completed' | 'cancelled';

const STATUS_STYLE: Record<string, string> = {
  planned: 'bg-slate-700 text-slate-200',
  active: 'bg-green-900/60 text-green-300',
  paused: 'bg-amber-900/60 text-amber-300',
  completed: 'bg-blue-900/60 text-blue-300',
  cancelled: 'bg-red-900/60 text-red-300',
};

function getApiError(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const body = payload as { error?: unknown; requiredPermission?: unknown };
  if (typeof body.error !== 'string') return null;
  if (body.error === 'forbidden' && typeof body.requiredPermission === 'string') {
    return `forbidden (${body.requiredPermission})`;
  }
  return body.error;
}

export default function DispatchPage() {
  const [status, setStatus] = useState<TripStatus>('all');
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [createVehicleId, setCreateVehicleId] = useState('');
  const [createDriverId, setCreateDriverId] = useState('');
  const [createRouteId, setCreateRouteId] = useState('');
  const [createDistance, setCreateDistance] = useState('');
  const [createPlannedEtaAt, setCreatePlannedEtaAt] = useState('');
  const [createDelayReason, setCreateDelayReason] = useState('');
  const [assignVehicleId, setAssignVehicleId] = useState('');
  const [assignDriverId, setAssignDriverId] = useState('');
  const [assignRouteId, setAssignRouteId] = useState('');
  const [transitionDelayReason, setTransitionDelayReason] = useState('');
  const [exceptionType, setExceptionType] = useState<TripException['exceptionType']>('manual_blocker');
  const [exceptionSeverity, setExceptionSeverity] = useState<TripException['severity']>('MEDIUM');
  const [exceptionTitle, setExceptionTitle] = useState('');
  const [exceptionDescription, setExceptionDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const query = useMemo(() => {
    const q = new URLSearchParams();
    q.set('limit', '100');
    if (status !== 'all') q.set('status', status);
    return q.toString();
  }, [status]);

  const tripsKey = `${API}/api/dispatch/trips?${query}`;
  const { data: tripsResp } = useSWR<{ data: TripSummary[] }>(tripsKey, fetcher, { refreshInterval: 5000, revalidateOnFocus: false });
  const tripDetailKey = selectedTripId ? `${API}/api/dispatch/trips/${selectedTripId}` : null;
  const { data: tripDetail } = useSWR<TripDispatchDetail>(tripDetailKey, fetcher, { refreshInterval: 5000, revalidateOnFocus: false });
  const { data: vehiclesResp } = useSWR<{ data: Vehicle[] }>(`${API}/api/fleet/vehicles?limit=200`, fetcher, { revalidateOnFocus: false });
  const { data: driversResp } = useSWR<{ data: DriverSummary[] }>(`${API}/api/drivers?limit=200`, fetcher, { revalidateOnFocus: false });

  const trips = tripsResp?.data ?? [];
  const vehicles = vehiclesResp?.data ?? [];
  const drivers = driversResp?.data ?? [];
  const selectedTrip = tripDetail ?? trips.find((t) => t.id === selectedTripId) ?? null;
  const driverById = useMemo(
    () => new Map(drivers.map((driver) => [driver.id, driver])),
    [drivers],
  );
  const createDriver = createDriverId ? driverById.get(createDriverId) : null;
  const assignDriver = assignDriverId ? driverById.get(assignDriverId) : null;
  const createDriverBlocked = Boolean(createDriverId) && createDriver?.isAssignable === false;
  const assignDriverBlocked = Boolean(assignDriverId) && assignDriver?.isAssignable === false;

  const refreshTrips = useCallback(() => {
    void mutate(tripsKey);
    if (tripDetailKey) void mutate(tripDetailKey);
    void mutate(`${API}/api/fleet/trips?limit=15`);
    void mutate(`${API}/api/fleet/inventory`);
  }, [tripsKey, tripDetailKey]);

  const createTrip = useCallback(async () => {
    if (!createVehicleId || !createDriverId) return;
    if (createDriverBlocked) {
      setActionError(`driver ${createDriverId} is not assignable`);
      return;
    }
    setActionError(null);
    setLoading(true);
    try {
      const payload = await apiPost('/api/dispatch/trips', {
        vehicleId: createVehicleId,
        driverId: createDriverId,
        routeId: createRouteId || undefined,
        plannedDistanceKm: createDistance ? Number(createDistance) : undefined,
        plannedEtaAt: createPlannedEtaAt ? new Date(createPlannedEtaAt).toISOString() : undefined,
        delayReason: createDelayReason.trim() || undefined,
      });
      const error = getApiError(payload);
      if (error) {
        setActionError(error);
        return;
      }
      setCreateDistance('');
      setCreatePlannedEtaAt('');
      setCreateDelayReason('');
      refreshTrips();
    } finally {
      setLoading(false);
    }
  }, [createVehicleId, createDriverId, createRouteId, createDistance, createPlannedEtaAt, createDelayReason, createDriverBlocked, refreshTrips]);

  const assignTrip = useCallback(async () => {
    if (!selectedTripId) return;
    if (!assignVehicleId && !assignDriverId && !assignRouteId) return;
    if (assignDriverBlocked) {
      setActionError(`driver ${assignDriverId} is not assignable`);
      return;
    }
    setActionError(null);
    setLoading(true);
    try {
      const payload = await apiPost(`/api/dispatch/trips/${selectedTripId}/assign`, {
        vehicleId: assignVehicleId || undefined,
        driverId: assignDriverId || undefined,
        routeId: assignRouteId || undefined,
      });
      const error = getApiError(payload);
      if (error) {
        setActionError(error);
        return;
      }
      refreshTrips();
    } finally {
      setLoading(false);
    }
  }, [selectedTripId, assignVehicleId, assignDriverId, assignRouteId, assignDriverBlocked, refreshTrips]);

  const transitionTrip = useCallback(async (nextStatus: Exclude<TripStatus, 'all'>) => {
    if (!selectedTripId) return;
    setActionError(null);
    setLoading(true);
    try {
      const payload = await apiPost(`/api/dispatch/trips/${selectedTripId}/transition`, {
        status: nextStatus,
        delayReason: transitionDelayReason.trim() || undefined,
      });
      const error = getApiError(payload);
      if (error) {
        setActionError(error);
        return;
      }
      setTransitionDelayReason('');
      refreshTrips();
    } finally {
      setLoading(false);
    }
  }, [selectedTripId, transitionDelayReason, refreshTrips]);

  const createException = useCallback(async () => {
    if (!selectedTripId) return;
    if (!exceptionTitle.trim() || !exceptionDescription.trim()) return;
    setActionError(null);
    setLoading(true);
    try {
      const payload = await apiPost(`/api/dispatch/trips/${selectedTripId}/exceptions`, {
        exceptionType,
        severity: exceptionSeverity,
        title: exceptionTitle.trim(),
        description: exceptionDescription.trim(),
      });
      const error = getApiError(payload);
      if (error) {
        setActionError(error);
        return;
      }
      setExceptionTitle('');
      setExceptionDescription('');
      refreshTrips();
    } finally {
      setLoading(false);
    }
  }, [selectedTripId, exceptionType, exceptionSeverity, exceptionTitle, exceptionDescription, refreshTrips]);

  const setExceptionStatus = useCallback(async (exceptionId: string, status: 'ACK' | 'RESOLVED') => {
    if (!selectedTripId) return;
    setActionError(null);
    setLoading(true);
    try {
      const payload = await apiPost(`/api/dispatch/trips/${selectedTripId}/exceptions/${exceptionId}/status`, { status });
      const error = getApiError(payload);
      if (error) {
        setActionError(error);
        return;
      }
      refreshTrips();
    } finally {
      setLoading(false);
    }
  }, [selectedTripId, refreshTrips]);

  return (
    <div className="flex flex-col h-full bg-[#0f172a]">
      <header className="flex items-center gap-4 px-6 py-3 border-b border-slate-800/60 bg-[#0c1322] flex-shrink-0">
        <div className="flex-1">
          <h1 className="text-sm font-semibold text-white">Dispatch</h1>
          <p className="text-[11px] text-slate-500 mt-0.5">Trip planning, assignment and lifecycle transitions</p>
        </div>
        <div className="flex items-center gap-1">
          {(['all', 'planned', 'active', 'paused', 'completed', 'cancelled'] as TripStatus[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className={clsx(
                'px-2.5 py-1 rounded text-[11px] font-medium',
                status === s ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white',
              )}
            >
              {s.toUpperCase()}
            </button>
          ))}
        </div>
      </header>

      <div className="border-b border-slate-800/60 bg-[#0c1322] px-6 py-3 grid grid-cols-7 gap-2">
        <select
          value={createVehicleId}
          onChange={(e) => setCreateVehicleId(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-[11px] text-slate-200"
        >
          <option value="">Vehicle</option>
          {vehicles.map((v) => (
            <option key={v.id} value={v.id}>{v.vehicleRegNo}</option>
          ))}
        </select>
        <select
          value={createDriverId}
          onChange={(e) => setCreateDriverId(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-[11px] text-slate-200"
        >
          <option value="">Driver</option>
          {drivers.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name} ({d.availabilityStatus})
            </option>
          ))}
        </select>
        <input
          value={createRouteId}
          onChange={(e) => setCreateRouteId(e.target.value)}
          placeholder="Route ID (optional)"
          className="bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-[11px] text-slate-200"
        />
        <input
          value={createDistance}
          onChange={(e) => setCreateDistance(e.target.value)}
          placeholder="Planned KM (optional)"
          className="bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-[11px] text-slate-200"
        />
        <input
          type="datetime-local"
          value={createPlannedEtaAt}
          onChange={(e) => setCreatePlannedEtaAt(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-[11px] text-slate-200"
        />
        <input
          value={createDelayReason}
          onChange={(e) => setCreateDelayReason(e.target.value)}
          placeholder="Delay reason (optional)"
          className="bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-[11px] text-slate-200"
        />
        <button
          type="button"
          onClick={createTrip}
          disabled={loading || !createVehicleId || !createDriverId || createDriverBlocked}
          className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded text-[11px] font-semibold"
        >
          Create Trip
        </button>
      </div>
      {(actionError || createDriverBlocked) && (
        <div className="px-6 py-2 border-b border-slate-800/60 bg-rose-950/20 text-[11px] text-rose-300">
          {actionError ?? `Selected driver (${createDriverId}) is unavailable for assignment.`}
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-hidden flex">
        <div className="flex-1 overflow-auto">
          <table className="w-full text-[11px]">
            <thead className="sticky top-0 bg-[#0c1322] border-b border-slate-800/60">
              <tr className="text-[10px] text-slate-600 uppercase">
                <th className="px-4 py-2 text-left">Trip</th>
                <th className="px-4 py-2 text-left">Vehicle</th>
                <th className="px-4 py-2 text-left">Driver</th>
                <th className="px-4 py-2 text-left">Route</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-left">Open Exc.</th>
                <th className="px-4 py-2 text-left">Start</th>
                <th className="px-4 py-2 text-left">Planned ETA</th>
                <th className="px-4 py-2 text-left">Delay Reason</th>
                <th className="px-4 py-2 text-left">Last Assign</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              {trips.map((trip) => (
                <tr
                  key={trip.id}
                  onClick={() => setSelectedTripId(trip.id)}
                  className={clsx(
                    'cursor-pointer hover:bg-slate-800/30',
                    selectedTripId === trip.id && 'bg-blue-950/30',
                  )}
                >
                  <td className="px-4 py-2 text-slate-300 font-mono">
                    <Link
                      href={`/dispatch/trips/${trip.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="hover:text-blue-300"
                    >
                      {trip.id}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-white">{trip.vehicleRegNo ?? trip.vehicleId}</td>
                  <td className="px-4 py-2 text-slate-400">{trip.driverName ?? trip.driverId}</td>
                  <td className="px-4 py-2 text-slate-500">{trip.routeName ?? trip.routeId ?? '-'}</td>
                  <td className="px-4 py-2">
                    <span className={clsx('px-2 py-0.5 rounded text-[10px] font-semibold', STATUS_STYLE[trip.status] ?? 'bg-slate-800 text-slate-400')}>
                      {trip.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-slate-400">{trip.openExceptionCount ?? 0}</td>
                  <td className="px-4 py-2 text-slate-500">{trip.startedAt ? new Date(trip.startedAt).toLocaleString('en-IN') : '-'}</td>
                  <td className="px-4 py-2 text-slate-500">{trip.plannedEtaAt ? new Date(trip.plannedEtaAt).toLocaleString('en-IN') : '-'}</td>
                  <td className="px-4 py-2 text-slate-500 max-w-[220px] truncate">{trip.delayReason ?? '-'}</td>
                  <td className="px-4 py-2 text-slate-500">{trip.lastAssignedAt ? new Date(trip.lastAssignedAt).toLocaleString('en-IN') : '-'}</td>
                </tr>
              ))}
              {trips.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-slate-600" colSpan={10}>No trips found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <aside className="w-[360px] border-l border-slate-800/60 bg-[#0c1322] p-4 space-y-4 overflow-auto">
          <h2 className="text-sm font-semibold text-white">Trip Actions</h2>
          {!selectedTrip ? (
            <div className="text-[11px] text-slate-600">Select a trip to manage assignment and transitions.</div>
          ) : (
            <>
              <div className="space-y-1 text-[11px]">
                <div className="text-slate-400 font-mono">{selectedTrip.id}</div>
                <div className="text-slate-500">Current status: <span className="text-slate-300">{selectedTrip.status}</span></div>
                <div className="text-slate-500">Vehicle: <span className="text-slate-300">{selectedTrip.vehicleRegNo ?? selectedTrip.vehicleId}</span></div>
                <div className="text-slate-500">Driver: <span className="text-slate-300">{selectedTrip.driverName ?? selectedTrip.driverId}</span></div>
                <div className="text-slate-500">Planned ETA: <span className="text-slate-300">{selectedTrip.plannedEtaAt ? new Date(selectedTrip.plannedEtaAt).toLocaleString('en-IN') : '-'}</span></div>
                <div className="text-slate-500">Delay reason: <span className="text-slate-300">{selectedTrip.delayReason ?? '-'}</span></div>
              </div>
              <Link
                href={`/dispatch/trips/${selectedTrip.id}`}
                className="inline-flex items-center px-2 py-1 rounded bg-blue-700/80 hover:bg-blue-700 text-white text-[11px] font-medium"
              >
                Open Full Detail
              </Link>

              <div className="border-t border-slate-800/60 pt-3 grid grid-cols-2 gap-2 text-[11px]">
                <div className="rounded border border-slate-800 bg-slate-900/30 px-2 py-1.5">
                  <div className="text-slate-600 text-[10px] uppercase">Planned KM</div>
                  <div className="text-slate-200">{selectedTrip.plannedDistanceKm ?? '-'}</div>
                </div>
                <div className="rounded border border-slate-800 bg-slate-900/30 px-2 py-1.5">
                  <div className="text-slate-600 text-[10px] uppercase">Actual KM</div>
                  <div className="text-slate-200">{selectedTrip.actualDistanceKm ?? '-'}</div>
                </div>
                <div className="rounded border border-slate-800 bg-slate-900/30 px-2 py-1.5">
                  <div className="text-slate-600 text-[10px] uppercase">Planned Route</div>
                  <div className="text-slate-200 truncate">{selectedTrip.routeName ?? selectedTrip.routeId ?? '-'}</div>
                </div>
                <div className="rounded border border-slate-800 bg-slate-900/30 px-2 py-1.5">
                  <div className="text-slate-600 text-[10px] uppercase">Actual Stops</div>
                  <div className="text-slate-200">{tripDetail?.stops?.length ?? selectedTrip.stopCount ?? 0}</div>
                </div>
              </div>

              <div className="border-t border-slate-800/60 pt-3 space-y-2">
                <div className="text-[10px] uppercase tracking-wider text-slate-500">Assignment</div>
                <select
                  value={assignVehicleId}
                  onChange={(e) => setAssignVehicleId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-[11px] text-slate-200"
                >
                  <option value="">Vehicle (optional)</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>{v.vehicleRegNo}</option>
                  ))}
                </select>
                <select
                  value={assignDriverId}
                  onChange={(e) => setAssignDriverId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-[11px] text-slate-200"
                >
                  <option value="">Driver (optional)</option>
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.availabilityStatus})
                    </option>
                  ))}
                </select>
                <input
                  value={assignRouteId}
                  onChange={(e) => setAssignRouteId(e.target.value)}
                  placeholder="Route ID (optional)"
                  className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-[11px] text-slate-200"
                />
                {assignDriverBlocked && (
                  <div className="text-[10px] text-rose-300">Selected driver ({assignDriverId}) is unavailable.</div>
                )}
                <button
                  type="button"
                  onClick={assignTrip}
                  disabled={loading || assignDriverBlocked}
                  className="w-full py-1.5 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded text-[11px] font-semibold"
                >
                  Assign / Reassign
                </button>
              </div>

              <div className="border-t border-slate-800/60 pt-3 space-y-2">
                <div className="text-[10px] uppercase tracking-wider text-slate-500">Transition</div>
                <input
                  value={transitionDelayReason}
                  onChange={(e) => setTransitionDelayReason(e.target.value)}
                  placeholder="Delay reason (optional)"
                  className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-[11px] text-slate-200"
                />
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => transitionTrip('active')} disabled={loading} className="py-1.5 bg-green-700/80 hover:bg-green-700 disabled:bg-slate-700 text-white rounded text-[11px]">Active</button>
                  <button type="button" onClick={() => transitionTrip('paused')} disabled={loading} className="py-1.5 bg-amber-700/80 hover:bg-amber-700 disabled:bg-slate-700 text-white rounded text-[11px]">Pause</button>
                  <button type="button" onClick={() => transitionTrip('completed')} disabled={loading} className="py-1.5 bg-blue-700/80 hover:bg-blue-700 disabled:bg-slate-700 text-white rounded text-[11px]">Complete</button>
                  <button type="button" onClick={() => transitionTrip('cancelled')} disabled={loading} className="py-1.5 bg-red-700/80 hover:bg-red-700 disabled:bg-slate-700 text-white rounded text-[11px]">Cancel</button>
                </div>
              </div>

              <div className="border-t border-slate-800/60 pt-3 space-y-2">
                <div className="text-[10px] uppercase tracking-wider text-slate-500">Raise Exception</div>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={exceptionType}
                    onChange={(e) => setExceptionType(e.target.value as TripException['exceptionType'])}
                    className="bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-[11px] text-slate-200"
                  >
                    <option value="manual_blocker">manual_blocker</option>
                    <option value="sla_delay">sla_delay</option>
                    <option value="off_route">off_route</option>
                    <option value="idle_overrun">idle_overrun</option>
                    <option value="fuel_anomaly">fuel_anomaly</option>
                  </select>
                  <select
                    value={exceptionSeverity}
                    onChange={(e) => setExceptionSeverity(e.target.value as TripException['severity'])}
                    className="bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-[11px] text-slate-200"
                  >
                    <option value="LOW">LOW</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HIGH">HIGH</option>
                    <option value="CRITICAL">CRITICAL</option>
                  </select>
                </div>
                <input
                  value={exceptionTitle}
                  onChange={(e) => setExceptionTitle(e.target.value)}
                  placeholder="Exception title"
                  className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-[11px] text-slate-200"
                />
                <textarea
                  value={exceptionDescription}
                  onChange={(e) => setExceptionDescription(e.target.value)}
                  placeholder="Exception description"
                  rows={3}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-[11px] text-slate-200 resize-none"
                />
                <button
                  type="button"
                  onClick={createException}
                  disabled={loading || !exceptionTitle.trim() || !exceptionDescription.trim()}
                  className="w-full py-1.5 bg-rose-700/80 hover:bg-rose-700 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded text-[11px] font-semibold"
                >
                  Add Exception
                </button>
              </div>

              <div className="border-t border-slate-800/60 pt-3 space-y-2">
                <div className="text-[10px] uppercase tracking-wider text-slate-500">Assignment Timeline</div>
                {tripDetail?.assignments?.length ? (
                  <div className="space-y-2">
                    {tripDetail.assignments.slice(0, 8).map((a) => (
                      <div key={a.id} className="rounded border border-slate-800 bg-slate-900/40 px-2 py-1.5 text-[11px]">
                        <div className="text-slate-300 font-mono">{new Date(a.assignedAt).toLocaleString('en-IN')}</div>
                        <div className="text-slate-500">By: {a.assignedBy ?? 'system'}</div>
                        <div className="text-slate-500 truncate">
                          {a.previousVehicleId ?? '-'} {'->'} {a.newVehicleId ?? '-'} | {a.previousDriverId ?? '-'} {'->'} {a.newDriverId ?? '-'}
                        </div>
                        {a.note && <div className="text-slate-600">{a.note}</div>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-[11px] text-slate-600">No assignment history.</div>
                )}
              </div>

              <div className="border-t border-slate-800/60 pt-3 space-y-2">
                <div className="text-[10px] uppercase tracking-wider text-slate-500">Exceptions</div>
                {tripDetail?.exceptions?.length ? (
                  <div className="space-y-2">
                    {tripDetail.exceptions.slice(0, 8).map((e) => (
                      <div key={e.id} className="rounded border border-slate-800 bg-slate-900/40 px-2 py-1.5 text-[11px]">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-slate-200 font-semibold truncate">{e.title}</span>
                          <span className={clsx(
                            'px-1.5 py-0.5 rounded text-[10px] font-semibold',
                            e.status === 'OPEN' ? 'bg-red-900/60 text-red-300' :
                              e.status === 'ACK' ? 'bg-amber-900/60 text-amber-300' :
                                'bg-green-900/60 text-green-300',
                          )}>
                            {e.status}
                          </span>
                        </div>
                        <div className="text-slate-500">{e.exceptionType} | {e.severity}</div>
                        <div className="text-slate-600 line-clamp-2">{e.description}</div>
                        <div className="text-slate-600">{new Date(e.openedAt).toLocaleString('en-IN')}</div>
                        {e.status !== 'RESOLVED' && (
                          <div className="mt-1 flex gap-1">
                            {e.status === 'OPEN' && (
                              <button
                                type="button"
                                onClick={() => setExceptionStatus(e.id, 'ACK')}
                                disabled={loading}
                                className="px-2 py-0.5 rounded bg-amber-700/80 hover:bg-amber-700 text-white text-[10px]"
                              >
                                Ack
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setExceptionStatus(e.id, 'RESOLVED')}
                              disabled={loading}
                              className="px-2 py-0.5 rounded bg-green-700/80 hover:bg-green-700 text-white text-[10px]"
                            >
                              Resolve
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-[11px] text-slate-600">No exceptions.</div>
                )}
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
