'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import useSWR from 'swr';
import clsx from 'clsx';
import { API, fetcher } from '../../lib/api';
import type { DriverSummary, DriverAvailabilityStatus, DriverRiskBand } from '../../lib/types';

type AvailabilityFilter = 'all' | DriverAvailabilityStatus;
type RiskFilter = 'all' | DriverRiskBand;

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

function shiftLabel(start?: string, end?: string): string {
  if (!start || !end) return '-';
  return `${start.slice(0, 5)} - ${end.slice(0, 5)}`;
}

export default function DriversPage() {
  const [availability, setAvailability] = useState<AvailabilityFilter>('all');
  const [risk, setRisk] = useState<RiskFilter>('all');
  const [queryText, setQueryText] = useState('');

  const query = useMemo(() => {
    const q = new URLSearchParams();
    q.set('limit', '200');
    if (availability !== 'all') q.set('availability', availability);
    if (risk !== 'all') q.set('risk', risk);
    if (queryText.trim()) q.set('q', queryText.trim());
    return q.toString();
  }, [availability, risk, queryText]);

  const { data, isLoading } = useSWR<{ data: DriverSummary[]; total: number }>(
    `${API}/api/drivers?${query}`,
    fetcher,
    { refreshInterval: 10000, revalidateOnFocus: false },
  );

  const drivers = data?.data ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="flex flex-col h-full bg-[#0f172a]">
      <header className="flex items-center gap-4 px-6 py-3 border-b border-slate-800/60 bg-[#0c1322]">
        <div className="flex-1">
          <h1 className="text-sm font-semibold text-white">Drivers</h1>
          <p className="text-[11px] text-slate-500 mt-0.5">Availability, risk bands, and assignment readiness</p>
        </div>
        <div className="text-[11px] text-slate-500">Total: <span className="text-slate-300">{total}</span></div>
      </header>

      <div className="px-6 py-3 border-b border-slate-800/60 bg-[#0c1322] flex items-center gap-2 flex-wrap">
        {(['all', 'available', 'on_trip', 'off_shift', 'leave'] as AvailabilityFilter[]).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setAvailability(item)}
            className={clsx(
              'px-2.5 py-1 rounded text-[11px] font-medium',
              availability === item ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white',
            )}
          >
            {item.toUpperCase()}
          </button>
        ))}
        <span className="mx-1 text-slate-700">|</span>
        {(['all', 'low', 'medium', 'high'] as RiskFilter[]).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setRisk(item)}
            className={clsx(
              'px-2.5 py-1 rounded text-[11px] font-medium',
              risk === item ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white',
            )}
          >
            {item.toUpperCase()}
          </button>
        ))}
        <input
          value={queryText}
          onChange={(e) => setQueryText(e.target.value)}
          placeholder="Search by id, name, license"
          className="ml-auto w-[260px] bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-[11px] text-slate-200"
        />
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        <table className="w-full text-[11px]">
          <thead className="sticky top-0 bg-[#0c1322] border-b border-slate-800/60">
            <tr className="text-[10px] text-slate-600 uppercase">
              <th className="px-4 py-2 text-left">Driver</th>
              <th className="px-4 py-2 text-left">Availability</th>
              <th className="px-4 py-2 text-left">Risk</th>
              <th className="px-4 py-2 text-left">Score</th>
              <th className="px-4 py-2 text-left">Current Trip</th>
              <th className="px-4 py-2 text-left">Vehicle</th>
              <th className="px-4 py-2 text-left">Active Trips</th>
              <th className="px-4 py-2 text-left">Open Alerts</th>
              <th className="px-4 py-2 text-left">Shift</th>
              <th className="px-4 py-2 text-left">Last Trip</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/40">
            {drivers.map((driver) => (
              <tr key={driver.id} className="hover:bg-slate-800/20">
                <td className="px-4 py-2">
                  <Link href={`/drivers/${driver.id}`} className="text-white hover:text-blue-300 font-medium">
                    {driver.name}
                  </Link>
                  <div className="text-slate-500 font-mono">{driver.id}</div>
                </td>
                <td className="px-4 py-2">
                  <span className={clsx('px-2 py-0.5 rounded text-[10px] font-semibold', AVAIL_STYLE[driver.availabilityStatus] ?? 'bg-slate-700 text-slate-300')}>
                    {driver.availabilityStatus}
                  </span>
                </td>
                <td className={clsx('px-4 py-2 uppercase font-semibold', RISK_STYLE[driver.riskBand] ?? 'text-slate-400')}>
                  {driver.riskBand}
                </td>
                <td className="px-4 py-2 text-slate-200">{driver.currentSafetyScore}</td>
                <td className="px-4 py-2 text-slate-400 font-mono">
                  {driver.currentTripId ?? '-'}
                </td>
                <td className="px-4 py-2 text-slate-400">
                  {driver.currentVehicleRegNo ?? driver.currentVehicleId ?? '-'}
                </td>
                <td className="px-4 py-2 text-slate-400">{driver.activeTripCount ?? 0}</td>
                <td className="px-4 py-2 text-slate-400">{driver.openAlertCount ?? 0}</td>
                <td className="px-4 py-2 text-slate-500">{shiftLabel(driver.shiftStartLocal, driver.shiftEndLocal)}</td>
                <td className="px-4 py-2 text-slate-500">{fmtTs(driver.lastTripAt)}</td>
              </tr>
            ))}
            {!isLoading && drivers.length === 0 && (
              <tr>
                <td className="px-4 py-8 text-slate-600" colSpan={10}>No drivers match current filters.</td>
              </tr>
            )}
            {isLoading && (
              <tr>
                <td className="px-4 py-8 text-slate-600" colSpan={10}>Loading drivers...</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
