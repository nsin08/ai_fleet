'use client';

import Link from 'next/link';
import clsx from 'clsx';
import useSWR from 'swr';
import { API, fetcher } from '../../../../lib/api';
import type { TripDispatchDetail, TripException } from '../../../../lib/types';

const SWR_OPT = { refreshInterval: 5000, revalidateOnFocus: false };

const STATUS_STYLE: Record<string, string> = {
  planned: 'bg-slate-700 text-slate-200',
  active: 'bg-green-900/60 text-green-300',
  paused: 'bg-amber-900/60 text-amber-300',
  completed: 'bg-blue-900/60 text-blue-300',
  cancelled: 'bg-red-900/60 text-red-300',
};

const EXCEPTION_STYLE: Record<TripException['status'], string> = {
  OPEN: 'bg-red-900/60 text-red-300',
  ACK: 'bg-amber-900/60 text-amber-300',
  RESOLVED: 'bg-green-900/60 text-green-300',
};

function fmtTs(ts?: string): string {
  if (!ts) return '-';
  try {
    return new Date(ts).toLocaleString('en-IN');
  } catch {
    return ts;
  }
}

function fmtNum(value?: number, suffix = ''): string {
  if (value == null) return '-';
  return `${Number(value).toFixed(1)}${suffix}`;
}

export default function DispatchTripDetailPage({ params }: { params: { tripId: string } }) {
  const { data } = useSWR<TripDispatchDetail | { error?: string }>(
    `${API}/api/dispatch/trips/${params.tripId}`,
    fetcher,
    SWR_OPT,
  );

  if (!data) {
    return (
      <div className="h-full bg-[#0f172a] text-slate-300 p-6">
        <div className="text-sm">Loading trip detail...</div>
      </div>
    );
  }

  if ('error' in data && data.error) {
    return (
      <div className="h-full bg-[#0f172a] text-slate-300 p-6 space-y-3">
        <Link href="/dispatch" className="inline-flex text-xs text-blue-400 hover:text-blue-300">
          Back to Dispatch
        </Link>
        <div className="text-sm text-red-300">{data.error}</div>
      </div>
    );
  }

  const trip = data as TripDispatchDetail;

  return (
    <div className="h-full overflow-auto bg-[#0f172a]">
      <div className="px-6 py-4 border-b border-slate-800/60 bg-[#0c1322] flex items-center gap-3">
        <Link href="/dispatch" className="inline-flex text-xs text-blue-400 hover:text-blue-300">
          Back to Dispatch
        </Link>
        <span className="text-slate-700">/</span>
        <h1 className="text-sm text-white font-semibold font-mono">{trip.id}</h1>
        <span className={clsx('px-2 py-0.5 rounded text-[10px] font-semibold', STATUS_STYLE[trip.status] ?? 'bg-slate-800 text-slate-400')}>
          {trip.status}
        </span>
      </div>

      <div className="p-6 space-y-4">
        <section className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
          <div className="rounded border border-slate-800 bg-[#0c1322] px-3 py-2">
            <div className="text-slate-600 text-[10px] uppercase">Vehicle</div>
            <div className="text-slate-200">{trip.vehicleRegNo ?? trip.vehicleId}</div>
          </div>
          <div className="rounded border border-slate-800 bg-[#0c1322] px-3 py-2">
            <div className="text-slate-600 text-[10px] uppercase">Driver</div>
            <div className="text-slate-200">{trip.driverName ?? trip.driverId}</div>
          </div>
          <div className="rounded border border-slate-800 bg-[#0c1322] px-3 py-2">
            <div className="text-slate-600 text-[10px] uppercase">Route</div>
            <div className="text-slate-200">{trip.routeName ?? trip.routeId ?? '-'}</div>
          </div>
          <div className="rounded border border-slate-800 bg-[#0c1322] px-3 py-2">
            <div className="text-slate-600 text-[10px] uppercase">Open Exceptions</div>
            <div className="text-slate-200">{trip.openExceptionCount ?? 0}</div>
          </div>
          <div className="rounded border border-slate-800 bg-[#0c1322] px-3 py-2">
            <div className="text-slate-600 text-[10px] uppercase">Start</div>
            <div className="text-slate-200">{fmtTs(trip.startedAt)}</div>
          </div>
          <div className="rounded border border-slate-800 bg-[#0c1322] px-3 py-2">
            <div className="text-slate-600 text-[10px] uppercase">End</div>
            <div className="text-slate-200">{fmtTs(trip.endedAt)}</div>
          </div>
          <div className="rounded border border-slate-800 bg-[#0c1322] px-3 py-2">
            <div className="text-slate-600 text-[10px] uppercase">Planned ETA</div>
            <div className="text-slate-200">{fmtTs(trip.plannedEtaAt)}</div>
          </div>
          <div className="rounded border border-slate-800 bg-[#0c1322] px-3 py-2">
            <div className="text-slate-600 text-[10px] uppercase">Delay Reason</div>
            <div className="text-slate-200">{trip.delayReason ?? '-'}</div>
          </div>
          <div className="rounded border border-slate-800 bg-[#0c1322] px-3 py-2">
            <div className="text-slate-600 text-[10px] uppercase">Planned KM</div>
            <div className="text-slate-200">{fmtNum(trip.plannedDistanceKm, ' km')}</div>
          </div>
          <div className="rounded border border-slate-800 bg-[#0c1322] px-3 py-2">
            <div className="text-slate-600 text-[10px] uppercase">Actual KM</div>
            <div className="text-slate-200">{fmtNum(trip.actualDistanceKm, ' km')}</div>
          </div>
          <div className="rounded border border-slate-800 bg-[#0c1322] px-3 py-2">
            <div className="text-slate-600 text-[10px] uppercase">Planned Stops</div>
            <div className="text-slate-200">{trip.stopCount ?? 0}</div>
          </div>
          <div className="rounded border border-slate-800 bg-[#0c1322] px-3 py-2">
            <div className="text-slate-600 text-[10px] uppercase">Actual Stops</div>
            <div className="text-slate-200">{trip.stops?.length ?? 0}</div>
          </div>
        </section>

        <section className="rounded border border-slate-800 bg-[#0c1322]">
          <div className="px-3 py-2 border-b border-slate-800 text-[10px] uppercase text-slate-500 tracking-wider">Stop Timeline</div>
          {!trip.stops?.length ? (
            <div className="px-3 py-3 text-[11px] text-slate-600">No stops recorded.</div>
          ) : (
            <div className="divide-y divide-slate-800/50">
              {trip.stops.map((stop) => (
                <div key={stop.id} className="px-3 py-2 text-[11px] grid grid-cols-5 gap-2">
                  <div className="text-slate-400">#{stop.seq}</div>
                  <div className="text-slate-300">{stop.stopType}</div>
                  <div className="text-slate-500">{fmtTs(stop.arrivedAt)}</div>
                  <div className="text-slate-500">{fmtTs(stop.departedAt)}</div>
                  <div className="text-slate-600 truncate">{stop.reason ?? '-'}</div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded border border-slate-800 bg-[#0c1322]">
          <div className="px-3 py-2 border-b border-slate-800 text-[10px] uppercase text-slate-500 tracking-wider">Assignment Timeline</div>
          {!trip.assignments?.length ? (
            <div className="px-3 py-3 text-[11px] text-slate-600">No assignment history.</div>
          ) : (
            <div className="divide-y divide-slate-800/50">
              {trip.assignments.map((a) => (
                <div key={a.id} className="px-3 py-2 text-[11px]">
                  <div className="text-slate-300">{fmtTs(a.assignedAt)} | {a.assignedBy ?? 'system'}</div>
                  <div className="text-slate-500">
                    Vehicle {a.previousVehicleId ?? '-'} {'->'} {a.newVehicleId ?? '-'} | Driver {a.previousDriverId ?? '-'} {'->'} {a.newDriverId ?? '-'}
                  </div>
                  {a.note && <div className="text-slate-600">{a.note}</div>}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded border border-slate-800 bg-[#0c1322]">
          <div className="px-3 py-2 border-b border-slate-800 text-[10px] uppercase text-slate-500 tracking-wider">Exceptions</div>
          {!trip.exceptions?.length ? (
            <div className="px-3 py-3 text-[11px] text-slate-600">No exceptions.</div>
          ) : (
            <div className="divide-y divide-slate-800/50">
              {trip.exceptions.map((e) => (
                <div key={e.id} className="px-3 py-2 text-[11px]">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-slate-200 font-semibold">{e.title}</div>
                    <span className={clsx('px-1.5 py-0.5 rounded text-[10px] font-semibold', EXCEPTION_STYLE[e.status])}>
                      {e.status}
                    </span>
                  </div>
                  <div className="text-slate-500">{e.exceptionType} | {e.severity}</div>
                  <div className="text-slate-600">{e.description}</div>
                  <div className="text-slate-600">Opened: {fmtTs(e.openedAt)} | Resolved: {fmtTs(e.resolvedAt)}</div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
