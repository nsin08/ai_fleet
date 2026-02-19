'use client';

import { useState, useCallback } from 'react';
import useSWR, { mutate } from 'swr';
import clsx from 'clsx';
import type { Alert } from '../../lib/types';
import { API, fetcher, apiPost } from '../../lib/api';

const SWR_OPT = { revalidateOnFocus: false };

const SEV: Record<string, string> = {
  CRITICAL: 'bg-red-950/80 text-red-300 border-red-800/60',
  HIGH: 'bg-red-900/60 text-red-300 border-red-800/60',
  MEDIUM: 'bg-orange-900/60 text-orange-300 border-orange-800/60',
  LOW: 'bg-yellow-900/50 text-yellow-300 border-yellow-800/50',
};
const STATUS_STYLE: Record<string, string> = {
  OPEN: 'bg-red-900/40 text-red-300',
  ACK: 'bg-amber-900/40 text-amber-300',
  CLOSED: 'bg-slate-800 text-slate-500',
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 text-[11px]">
      <span className="text-slate-600 flex-shrink-0">{label}</span>
      <span className="text-slate-300 font-medium text-right truncate">{value}</span>
    </div>
  );
}

type StatusFilter = 'ALL' | 'OPEN' | 'ACK' | 'CLOSED';
type SeverityFilter = '' | 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export default function AlertsPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('OPEN');
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('');
  const [selected, setSelected] = useState<Alert | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [aiText, setAiText] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const qs = new URLSearchParams();
  if (statusFilter !== 'ALL') qs.set('status', statusFilter);
  if (severityFilter) qs.set('severity', severityFilter);
  qs.set('limit', '200');

  const { data: resp } = useSWR<{ data: Alert[] }>(
    `${API}/api/alerts?${qs.toString()}`,
    fetcher,
    { ...SWR_OPT, refreshInterval: 5000 },
  );
  const alerts = resp?.data ?? [];

  const ack = useCallback(async (id: string) => {
    setActionLoading(true);
    try {
      await apiPost(`/api/alerts/${id}/ack`);
      void mutate(`${API}/api/alerts?${qs.toString()}`);
      setSelected((prev) => prev?.id === id ? { ...prev, status: 'ACK' } : prev);
    } finally { setActionLoading(false); }
  }, [qs]);

  const close = useCallback(async (id: string) => {
    setActionLoading(true);
    try {
      await apiPost(`/api/alerts/${id}/close`);
      void mutate(`${API}/api/alerts?${qs.toString()}`);
      setSelected((prev) => prev?.id === id ? { ...prev, status: 'CLOSED' } : prev);
    } finally { setActionLoading(false); }
  }, [qs]);

  const explain = useCallback(async (id: string) => {
    setAiLoading(true);
    setAiText('');
    try {
      const data = await apiPost<{ explanation?: string; error?: string }>(`/api/ai/explain-alert`, { alertId: id });
      setAiText(data.explanation ?? data.error ?? 'No response');
    } catch (e) {
      setAiText(String(e));
    } finally { setAiLoading(false); }
  }, []);

  return (
    <div className="flex flex-col h-full bg-[#0f172a]">
      {/* Header */}
      <header className="flex items-center gap-4 px-6 py-3 border-b border-slate-800/60 bg-[#0c1322] flex-shrink-0">
        <div className="flex-1">
          <h1 className="text-sm font-semibold text-white">Alerts</h1>
          <p className="text-[11px] text-slate-500 mt-0.5">{alerts.length} result{alerts.length !== 1 ? 's' : ''}</p>
        </div>
        {/* Status filters */}
        <div className="flex items-center gap-1">
          {(['ALL', 'OPEN', 'ACK', 'CLOSED'] as StatusFilter[]).map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={clsx('px-3 py-1 rounded text-[11px] font-medium transition-colors', statusFilter === s ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white')}>
              {s}
            </button>
          ))}
        </div>
        {/* Severity */}
        <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value as SeverityFilter)}
          className="bg-slate-800 border border-slate-700 text-slate-300 text-[11px] rounded px-2 py-1 focus:outline-none focus:border-blue-500">
          <option value="">All Severity</option>
          <option value="CRITICAL">Critical</option>
          <option value="HIGH">High</option>
          <option value="MEDIUM">Medium</option>
          <option value="LOW">Low</option>
        </select>
      </header>

      {/* Body */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Table */}
        <div className="flex-1 overflow-auto">
          {alerts.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-slate-600 text-sm">No alerts</div>
          ) : (
            <table className="w-full text-[11px]">
              <thead className="sticky top-0 bg-[#0c1322] z-10">
                <tr className="text-[10px] text-slate-600 uppercase tracking-wider border-b border-slate-800/60">
                  <th className="px-4 py-2.5 text-left font-semibold">Time</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Vehicle</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Type</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Severity</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Status</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                {alerts.map((a) => (
                  <tr key={a.id}
                    onClick={() => { setSelected(a); setAiText(''); }}
                    className={clsx('cursor-pointer hover:bg-slate-800/30 transition-colors', selected?.id === a.id && 'bg-blue-950/20')}>
                    <td className="px-4 py-2.5 text-slate-500 font-mono whitespace-nowrap">
                      {new Date(a.createdTs).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-4 py-2.5 text-slate-300 whitespace-nowrap">{a.vehicleRegNo}</td>
                    <td className="px-4 py-2.5 text-white font-medium whitespace-nowrap">{a.alertType.replace(/_/g, ' ')}</td>
                    <td className="px-4 py-2.5">
                      <span className={clsx('px-1.5 py-0.5 rounded text-[10px] font-bold border', SEV[a.severity] ?? 'bg-slate-800 text-slate-400 border-slate-700')}>{a.severity}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={clsx('px-1.5 py-0.5 rounded text-[10px] font-semibold', STATUS_STYLE[a.status] ?? 'bg-slate-800 text-slate-400')}>{a.status}</span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-500 max-w-[280px] truncate">{a.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="w-[340px] flex-shrink-0 border-l border-slate-800/60 flex flex-col overflow-y-auto bg-[#0c1322]">
            {/* Header */}
            <div className="flex items-start justify-between p-4 border-b border-slate-800/60">
              <div>
                <div className="text-sm font-semibold text-white">{selected.alertType.replace(/_/g, ' ')}</div>
                <div className="text-[11px] text-slate-500 mt-0.5 font-mono">{selected.vehicleRegNo}</div>
              </div>
              <button onClick={() => setSelected(null)} className="text-slate-600 hover:text-slate-300 text-lg leading-none mt-0.5">x</button>
            </div>

            <div className="p-4 space-y-4 flex-1">
              {/* Badges */}
              <div className="flex gap-2 flex-wrap">
                <span className={clsx('px-2 py-0.5 rounded text-[10px] font-bold border', SEV[selected.severity] ?? 'bg-slate-800 text-slate-400 border-slate-700')}>{selected.severity}</span>
                <span className={clsx('px-2 py-0.5 rounded text-[10px] font-semibold', STATUS_STYLE[selected.status] ?? 'bg-slate-800 text-slate-400')}>{selected.status}</span>
              </div>

              {/* Title + description */}
              <div>
                <div className="text-xs font-semibold text-slate-300 mb-1">{selected.title}</div>
                <div className="text-[11px] text-slate-500 leading-relaxed">{selected.description}</div>
              </div>

              {/* Timestamps */}
              <div className="space-y-1">
                <Row label="Created" value={new Date(selected.createdTs).toLocaleString('en-IN')} />
                {selected.closedTs && <Row label="Closed" value={new Date(selected.closedTs).toLocaleString('en-IN')} />}
                {selected.acknowledgedBy && <Row label="Ack'd by" value={selected.acknowledgedBy} />}
              </div>

              {/* Actions */}
              {selected.status === 'OPEN' && (
                <div className="flex gap-2 pt-1">
                  <button onClick={() => ack(selected.id)} disabled={actionLoading}
                    className="flex-1 py-1.5 bg-amber-600/80 hover:bg-amber-600 disabled:opacity-50 text-white rounded text-xs font-medium transition-colors">
                    Acknowledge
                  </button>
                  <button onClick={() => close(selected.id)} disabled={actionLoading}
                    className="flex-1 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white rounded text-xs font-medium transition-colors">
                    Close
                  </button>
                </div>
              )}
              {selected.status === 'ACK' && (
                <button onClick={() => close(selected.id)} disabled={actionLoading}
                  className="w-full py-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white rounded text-xs font-medium">
                  Close Alert
                </button>
              )}

              {/* AI Explain */}
              <div className="pt-1 border-t border-slate-800/60">
                <button onClick={() => explain(selected.id)} disabled={aiLoading}
                  className="w-full py-1.5 bg-blue-600/80 hover:bg-blue-600 disabled:opacity-50 text-white rounded text-xs font-medium flex items-center justify-center gap-1.5 transition-colors">
                  {aiLoading ? (
                    <><span className="w-3 h-3 rounded-full border border-blue-300 border-t-transparent animate-spin" /> Analyzing</>
                  ) : 'AI Explain'}
                </button>
                {aiText && (
                  <div className="mt-3 p-3 bg-slate-900/60 rounded text-[11px] text-slate-300 leading-relaxed whitespace-pre-wrap max-h-[220px] overflow-y-auto">
                    {aiText}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
