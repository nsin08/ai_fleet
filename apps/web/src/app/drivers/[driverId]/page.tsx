'use client';

import Link from 'next/link';
import clsx from 'clsx';
import useSWR from 'swr';
import { API, fetcher } from '../../../lib/api';
import type { DriverProfile, DriverScoreSnapshot } from '../../../lib/types';

const AVAIL_STYLE: Record<string, string> = {
  available: 'bg-green-900/60 text-green-300',
  on_trip: 'bg-blue-900/60 text-blue-300',
  off_shift: 'bg-amber-900/60 text-amber-300',
  leave: 'bg-rose-900/60 text-rose-300',
};

const RISK_STYLE: Record<string, string> = {
  low: 'text-green-300',
  medium: 'text-amber-300',
  high: 'text-red-300',
};

function fmtTs(ts?: string): string {
  if (!ts) return '-';
  try {
    return new Date(ts).toLocaleString('en-IN');
  } catch {
    return ts;
  }
}

export default function DriverDetailPage({ params }: { params: { driverId: string } }) {
  const { data: profile } = useSWR<DriverProfile | { error?: string }>(
    `${API}/api/drivers/${params.driverId}`,
    fetcher,
    { refreshInterval: 10000, revalidateOnFocus: false },
  );
  const { data: score } = useSWR<DriverScoreSnapshot>(
    `${API}/api/drivers/${params.driverId}/score`,
    fetcher,
    { refreshInterval: 10000, revalidateOnFocus: false },
  );

  if (!profile) {
    return <div className="h-full bg-[#0f172a] p-6 text-slate-500 text-sm">Loading driver profile...</div>;
  }

  if ('error' in profile && profile.error) {
    return (
      <div className="h-full bg-[#0f172a] p-6 space-y-2">
        <Link href="/drivers" className="text-xs text-blue-400 hover:text-blue-300">Back to Drivers</Link>
        <div className="text-sm text-rose-300">{profile.error}</div>
      </div>
    );
  }

  const driver = profile as DriverProfile;
  const scoreData = score ?? {
    driverId: driver.id,
    baseSafetyScore: driver.baseSafetyScore,
    currentSafetyScore: driver.currentSafetyScore,
    delta: driver.currentSafetyScore - driver.baseSafetyScore,
    riskBand: driver.riskBand,
    availabilityStatus: driver.availabilityStatus,
    isAssignable: driver.isAssignable,
    scoreTrend: driver.scoreTrend,
  };

  return (
    <div className="h-full overflow-auto bg-[#0f172a]">
      <div className="px-6 py-4 border-b border-slate-800/60 bg-[#0c1322] flex items-center gap-3">
        <Link href="/drivers" className="text-xs text-blue-400 hover:text-blue-300">Back to Drivers</Link>
        <span className="text-slate-700">/</span>
        <h1 className="text-sm text-white font-semibold">{driver.name}</h1>
        <span className="text-[10px] text-slate-500 font-mono">{driver.id}</span>
        <span className={clsx('px-2 py-0.5 rounded text-[10px] font-semibold', AVAIL_STYLE[driver.availabilityStatus] ?? 'bg-slate-700 text-slate-300')}>
          {driver.availabilityStatus}
        </span>
        <span className={clsx('text-[11px] font-semibold uppercase', RISK_STYLE[driver.riskBand] ?? 'text-slate-400')}>
          {driver.riskBand} risk
        </span>
      </div>

      <div className="p-6 space-y-4">
        <section className="grid grid-cols-2 md:grid-cols-5 gap-2 text-[11px]">
          <div className="rounded border border-slate-800 bg-[#0c1322] px-3 py-2">
            <div className="text-slate-600 text-[10px] uppercase">Current Score</div>
            <div className="text-slate-200">{scoreData.currentSafetyScore}</div>
          </div>
          <div className="rounded border border-slate-800 bg-[#0c1322] px-3 py-2">
            <div className="text-slate-600 text-[10px] uppercase">Base Score</div>
            <div className="text-slate-200">{scoreData.baseSafetyScore}</div>
          </div>
          <div className="rounded border border-slate-800 bg-[#0c1322] px-3 py-2">
            <div className="text-slate-600 text-[10px] uppercase">Delta</div>
            <div className={clsx(scoreData.delta < 0 ? 'text-amber-300' : 'text-green-300')}>{scoreData.delta}</div>
          </div>
          <div className="rounded border border-slate-800 bg-[#0c1322] px-3 py-2">
            <div className="text-slate-600 text-[10px] uppercase">Shift</div>
            <div className="text-slate-200">
              {driver.shiftStartLocal?.slice(0, 5) ?? '-'} - {driver.shiftEndLocal?.slice(0, 5) ?? '-'}
            </div>
          </div>
          <div className="rounded border border-slate-800 bg-[#0c1322] px-3 py-2">
            <div className="text-slate-600 text-[10px] uppercase">Assignable</div>
            <div className={clsx(driver.isAssignable ? 'text-green-300' : 'text-rose-300')}>
              {driver.isAssignable ? 'YES' : 'NO'}
            </div>
          </div>
        </section>

        <section className="rounded border border-slate-800 bg-[#0c1322] p-3">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">Score Trend (7 days)</div>
          <div className="space-y-1.5">
            {scoreData.scoreTrend.map((point) => (
              <div key={point.ts} className="grid grid-cols-[72px_1fr_32px] gap-2 items-center text-[10px]">
                <div className="text-slate-600">{new Date(point.ts).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</div>
                <div className="h-2 bg-slate-800 rounded overflow-hidden">
                  <div className={clsx(
                    'h-full',
                    point.score < 60 ? 'bg-red-500/80' : point.score < 80 ? 'bg-amber-500/80' : 'bg-green-500/80',
                  )} style={{ width: `${Math.max(0, Math.min(100, point.score))}%` }} />
                </div>
                <div className="text-slate-300 text-right">{point.score}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded border border-slate-800 bg-[#0c1322]">
            <div className="px-3 py-2 border-b border-slate-800 text-[10px] uppercase text-slate-500 tracking-wider">Current Trip</div>
            <div className="px-3 py-3 text-[11px]">
              {driver.currentTrip ? (
                <div className="space-y-1">
                  <div className="text-slate-200 font-mono">{driver.currentTrip.id}</div>
                  <div className="text-slate-500">Vehicle: {driver.currentTrip.vehicleRegNo ?? driver.currentTrip.vehicleId}</div>
                  <div className="text-slate-500">Route: {driver.currentTrip.routeName ?? driver.currentTrip.routeId ?? '-'}</div>
                  <div className="text-slate-500">Started: {fmtTs(driver.currentTrip.startedAt)}</div>
                  <div className="text-slate-500">Status: {driver.currentTrip.status}</div>
                </div>
              ) : (
                <div className="text-slate-600">No active trip.</div>
              )}
            </div>
          </div>

          <div className="rounded border border-slate-800 bg-[#0c1322]">
            <div className="px-3 py-2 border-b border-slate-800 text-[10px] uppercase text-slate-500 tracking-wider">Recent Alerts</div>
            <div className="divide-y divide-slate-800/50">
              {driver.recentAlerts.length === 0 ? (
                <div className="px-3 py-3 text-[11px] text-slate-600">No driver-linked alerts.</div>
              ) : (
                driver.recentAlerts.map((alert) => (
                  <div key={alert.id} className="px-3 py-2 text-[11px]">
                    <div className="text-slate-200">{alert.alertType}</div>
                    <div className="text-slate-500">{alert.severity} | {alert.status} | {fmtTs(alert.createdTs)}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded border border-slate-800 bg-[#0c1322]">
            <div className="px-3 py-2 border-b border-slate-800 text-[10px] uppercase text-slate-500 tracking-wider">Previous Trips</div>
            <div className="divide-y divide-slate-800/50">
              {driver.recentTrips.length === 0 ? (
                <div className="px-3 py-3 text-[11px] text-slate-600">No completed/cancelled trips.</div>
              ) : (
                driver.recentTrips.map((trip) => (
                  <div key={trip.id} className="px-3 py-2 text-[11px]">
                    <div className="text-slate-200 font-mono">{trip.id}</div>
                    <div className="text-slate-500">{trip.routeName ?? trip.routeId ?? '-'} | {trip.status}</div>
                    <div className="text-slate-600">{fmtTs(trip.startedAt)}</div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded border border-slate-800 bg-[#0c1322]">
            <div className="px-3 py-2 border-b border-slate-800 text-[10px] uppercase text-slate-500 tracking-wider">Recent Events</div>
            <div className="divide-y divide-slate-800/50">
              {driver.recentEvents.length === 0 ? (
                <div className="px-3 py-3 text-[11px] text-slate-600">No driver-linked events.</div>
              ) : (
                driver.recentEvents.map((event) => (
                  <div key={event.id} className="px-3 py-2 text-[11px]">
                    <div className="text-slate-200">{event.eventType}</div>
                    <div className="text-slate-500">{event.severity} | {fmtTs(event.ts)}</div>
                    <div className="text-slate-600">{event.message}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
