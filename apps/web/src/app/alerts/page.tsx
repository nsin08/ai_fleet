'use client';

import { useState, useCallback, useMemo } from 'react';
import useSWR, { mutate } from 'swr';
import clsx from 'clsx';
import type { Alert, AlertClosureReason } from '../../lib/types';
import { API, fetcher, apiPost } from '../../lib/api';
import { MarkdownContent } from '../../components/markdown-content';

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

const ESC_STYLE: Record<string, string> = {
  OVERDUE: 'bg-rose-900/50 text-rose-300',
  AT_RISK: 'bg-amber-900/50 text-amber-300',
  ON_TRACK: 'bg-emerald-900/50 text-emerald-300',
};

const CLOSURE_REASON_OPTIONS: Array<{ value: AlertClosureReason; label: string }> = [
  { value: 'resolved_by_ops', label: 'Resolved by Ops' },
  { value: 'resolved_by_driver', label: 'Resolved by Driver' },
  { value: 'maintenance_action', label: 'Maintenance Action' },
  { value: 'false_positive', label: 'False Positive' },
  { value: 'duplicate_alert', label: 'Duplicate Alert' },
  { value: 'other', label: 'Other' },
];

function fmtDate(ts?: string): string {
  if (!ts) return '-';
  try {
    return new Date(ts).toLocaleString('en-IN');
  } catch {
    return ts;
  }
}

function getApiError(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const body = payload as { error?: unknown; requiredPermission?: unknown };
  if (typeof body.error !== 'string') return null;
  if (body.error === 'forbidden' && typeof body.requiredPermission === 'string') {
    return `forbidden (${body.requiredPermission})`;
  }
  return body.error;
}

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
type EscalationFilter = '' | 'OVERDUE' | 'AT_RISK' | 'ON_TRACK';

export default function AlertsPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('OPEN');
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('');
  const [escalationFilter, setEscalationFilter] = useState<EscalationFilter>('');
  const [selected, setSelected] = useState<Alert | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [aiText, setAiText] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const [singleOwnerUserId, setSingleOwnerUserId] = useState('ops-desk');
  const [singleOwnerDisplayName, setSingleOwnerDisplayName] = useState('Operations Desk');
  const [singleSlaMinutes, setSingleSlaMinutes] = useState('60');
  const [singleClosureReason, setSingleClosureReason] = useState<AlertClosureReason>('resolved_by_ops');
  const [singleResolution, setSingleResolution] = useState('');

  const [bulkOwnerUserId, setBulkOwnerUserId] = useState('ops-desk');
  const [bulkOwnerDisplayName, setBulkOwnerDisplayName] = useState('Operations Desk');
  const [bulkSlaMinutes, setBulkSlaMinutes] = useState('60');
  const [bulkClosureReason, setBulkClosureReason] = useState<AlertClosureReason>('resolved_by_ops');
  const [bulkResolution, setBulkResolution] = useState('');

  const qs = useMemo(() => {
    const query = new URLSearchParams();
    if (statusFilter !== 'ALL') query.set('status', statusFilter);
    if (severityFilter) query.set('severity', severityFilter);
    if (escalationFilter) query.set('escalationState', escalationFilter);
    query.set('limit', '200');
    return query;
  }, [statusFilter, severityFilter, escalationFilter]);

  const alertsKey = `${API}/api/alerts?${qs.toString()}`;

  const { data: resp } = useSWR<{ data: Alert[]; total: number }>(
    alertsKey,
    fetcher,
    { ...SWR_OPT, refreshInterval: 5000 },
  );

  const alerts = resp?.data ?? [];
  const total = resp?.total ?? 0;

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const allSelected = alerts.length > 0 && selectedIds.length === alerts.length;

  const refresh = useCallback(async () => {
    await mutate(alertsKey);
    await mutate(`${API}/api/fleet/inventory`);
  }, [alertsKey]);

  const toggleSelectAll = useCallback(() => {
    if (allSelected) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds(alerts.map((alert) => alert.id));
  }, [allSelected, alerts]);

  const toggleRow = useCallback((id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((item) => item !== id);
      return [...prev, id];
    });
  }, []);

  const assignSingle = useCallback(async (alertId: string) => {
    setActionError(null);
    setActionLoading(true);
    try {
      const payload = await apiPost(`/api/alerts/${alertId}/assign`, {
        ownerUserId: singleOwnerUserId,
        ownerDisplayName: singleOwnerDisplayName || undefined,
        slaMinutes: singleSlaMinutes ? Number(singleSlaMinutes) : undefined,
      });
      const error = getApiError(payload);
      if (error) {
        setActionError(error);
        return;
      }
      await refresh();
      setSelected((prev) => (prev?.id === alertId ? { ...prev, ...(payload as Alert) } : prev));
    } finally {
      setActionLoading(false);
    }
  }, [singleOwnerUserId, singleOwnerDisplayName, singleSlaMinutes, refresh]);

  const ackSingle = useCallback(async (alertId: string) => {
    setActionError(null);
    setActionLoading(true);
    try {
      const payload = await apiPost(`/api/alerts/${alertId}/ack`);
      const error = getApiError(payload);
      if (error) {
        setActionError(error);
        return;
      }
      await refresh();
      setSelected((prev) => (prev?.id === alertId ? { ...prev, ...(payload as Alert) } : prev));
    } finally {
      setActionLoading(false);
    }
  }, [refresh]);

  const closeSingle = useCallback(async (alertId: string) => {
    setActionError(null);
    setActionLoading(true);
    try {
      const payload = await apiPost(`/api/alerts/${alertId}/close`, {
        closureReason: singleClosureReason,
        resolution: singleResolution.trim() || undefined,
      });
      const error = getApiError(payload);
      if (error) {
        setActionError(error);
        return;
      }
      await refresh();
      setSelected((prev) => (prev?.id === alertId ? { ...prev, ...(payload as Alert) } : prev));
      setSingleResolution('');
    } finally {
      setActionLoading(false);
    }
  }, [singleClosureReason, singleResolution, refresh]);

  const bulkAssign = useCallback(async () => {
    if (selectedIds.length === 0) return;
    setActionError(null);
    setActionLoading(true);
    try {
      const payload = await apiPost('/api/alerts/bulk', {
        action: 'assign',
        alertIds: selectedIds,
        ownerUserId: bulkOwnerUserId,
        ownerDisplayName: bulkOwnerDisplayName || undefined,
        slaMinutes: bulkSlaMinutes ? Number(bulkSlaMinutes) : undefined,
      });
      const error = getApiError(payload);
      if (error) {
        setActionError(error);
        return;
      }
      await refresh();
    } finally {
      setActionLoading(false);
    }
  }, [selectedIds, bulkOwnerUserId, bulkOwnerDisplayName, bulkSlaMinutes, refresh]);

  const bulkAck = useCallback(async () => {
    if (selectedIds.length === 0) return;
    setActionError(null);
    setActionLoading(true);
    try {
      const payload = await apiPost('/api/alerts/bulk', {
        action: 'ack',
        alertIds: selectedIds,
      });
      const error = getApiError(payload);
      if (error) {
        setActionError(error);
        return;
      }
      await refresh();
    } finally {
      setActionLoading(false);
    }
  }, [selectedIds, refresh]);

  const bulkClose = useCallback(async () => {
    if (selectedIds.length === 0) return;
    setActionError(null);
    setActionLoading(true);
    try {
      const payload = await apiPost('/api/alerts/bulk', {
        action: 'close',
        alertIds: selectedIds,
        closureReason: bulkClosureReason,
        resolution: bulkResolution.trim() || undefined,
      });
      const error = getApiError(payload);
      if (error) {
        setActionError(error);
        return;
      }
      await refresh();
      setBulkResolution('');
    } finally {
      setActionLoading(false);
    }
  }, [selectedIds, bulkClosureReason, bulkResolution, refresh]);

  const explain = useCallback(async (id: string) => {
    setAiLoading(true);
    setAiText('');
    try {
      const data = await apiPost<{ explanation?: string; error?: string }>('/api/ai/explain-alert', { alertId: id });
      setAiText(data.explanation ?? data.error ?? 'No response');
    } catch (err) {
      setAiText(String(err));
    } finally {
      setAiLoading(false);
    }
  }, []);

  return (
    <div className="flex flex-col h-full bg-[#0f172a]">
      <header className="flex items-center gap-4 px-6 py-3 border-b border-slate-800/60 bg-[#0c1322] flex-shrink-0">
        <div className="flex-1">
          <h1 className="text-sm font-semibold text-white">Alerts</h1>
          <p className="text-[11px] text-slate-500 mt-0.5">{total} total | {alerts.length} filtered</p>
        </div>

        <div className="flex items-center gap-1">
          {(['ALL', 'OPEN', 'ACK', 'CLOSED'] as StatusFilter[]).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => {
                setStatusFilter(status);
                setSelectedIds([]);
              }}
              className={clsx(
                'px-3 py-1 rounded text-[11px] font-medium transition-colors',
                statusFilter === status ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white',
              )}
            >
              {status}
            </button>
          ))}
        </div>

        <select
          value={severityFilter}
          onChange={(e) => {
            setSeverityFilter(e.target.value as SeverityFilter);
            setSelectedIds([]);
          }}
          className="bg-slate-800 border border-slate-700 text-slate-300 text-[11px] rounded px-2 py-1"
        >
          <option value="">All Severity</option>
          <option value="CRITICAL">Critical</option>
          <option value="HIGH">High</option>
          <option value="MEDIUM">Medium</option>
          <option value="LOW">Low</option>
        </select>

        <select
          value={escalationFilter}
          onChange={(e) => {
            setEscalationFilter(e.target.value as EscalationFilter);
            setSelectedIds([]);
          }}
          className="bg-slate-800 border border-slate-700 text-slate-300 text-[11px] rounded px-2 py-1"
        >
          <option value="">All SLA States</option>
          <option value="OVERDUE">Overdue</option>
          <option value="AT_RISK">At Risk</option>
          <option value="ON_TRACK">On Track</option>
        </select>
      </header>

      <div className="px-6 py-2 border-b border-slate-800/60 bg-[#0c1322] flex items-center gap-2 flex-wrap">
        <div className="text-[11px] text-slate-500">Selected: <span className="text-slate-300">{selectedIds.length}</span></div>
        <input
          value={bulkOwnerUserId}
          onChange={(e) => setBulkOwnerUserId(e.target.value)}
          placeholder="owner user id"
          className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-[11px] text-slate-200"
        />
        <input
          value={bulkOwnerDisplayName}
          onChange={(e) => setBulkOwnerDisplayName(e.target.value)}
          placeholder="owner name"
          className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-[11px] text-slate-200"
        />
        <input
          value={bulkSlaMinutes}
          onChange={(e) => setBulkSlaMinutes(e.target.value)}
          placeholder="SLA min"
          className="w-20 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-[11px] text-slate-200"
        />
        <select
          value={bulkClosureReason}
          onChange={(e) => setBulkClosureReason(e.target.value as AlertClosureReason)}
          className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-[11px] text-slate-200"
        >
          {CLOSURE_REASON_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <input
          value={bulkResolution}
          onChange={(e) => setBulkResolution(e.target.value)}
          placeholder="closure note"
          className="min-w-[180px] bg-slate-800 border border-slate-700 rounded px-2 py-1 text-[11px] text-slate-200"
        />
        <button
          type="button"
          onClick={bulkAssign}
          disabled={actionLoading || selectedIds.length === 0 || !bulkOwnerUserId.trim()}
          className="px-2.5 py-1 bg-blue-700/80 hover:bg-blue-700 disabled:bg-slate-700 text-white rounded text-[11px]"
        >
          Bulk Assign
        </button>
        <button
          type="button"
          onClick={bulkAck}
          disabled={actionLoading || selectedIds.length === 0}
          className="px-2.5 py-1 bg-amber-700/80 hover:bg-amber-700 disabled:bg-slate-700 text-white rounded text-[11px]"
        >
          Bulk Ack
        </button>
        <button
          type="button"
          onClick={bulkClose}
          disabled={actionLoading || selectedIds.length === 0}
          className="px-2.5 py-1 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-700 text-white rounded text-[11px]"
        >
          Bulk Close
        </button>
        {actionError && <div className="text-[11px] text-rose-300">{actionError}</div>}
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        <div className="flex-1 overflow-auto">
          {alerts.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-slate-600 text-sm">No alerts</div>
          ) : (
            <table className="w-full text-[11px]">
              <thead className="sticky top-0 bg-[#0c1322] z-10">
                <tr className="text-[10px] text-slate-600 uppercase tracking-wider border-b border-slate-800/60">
                  <th className="px-3 py-2.5 text-left font-semibold">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                      className="accent-blue-500"
                    />
                  </th>
                  <th className="px-4 py-2.5 text-left font-semibold">Time</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Vehicle</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Type</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Severity</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Status</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Owner</th>
                  <th className="px-4 py-2.5 text-left font-semibold">SLA Due</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Escalation</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                {alerts.map((alert) => (
                  <tr
                    key={alert.id}
                    onClick={() => {
                      setSelected(alert);
                      setAiText('');
                    }}
                    className={clsx('cursor-pointer hover:bg-slate-800/30', selected?.id === alert.id && 'bg-blue-950/20')}
                  >
                    <td className="px-3 py-2.5" onClick={(event) => event.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIdSet.has(alert.id)}
                        onChange={() => toggleRow(alert.id)}
                        className="accent-blue-500"
                      />
                    </td>
                    <td className="px-4 py-2.5 text-slate-500 font-mono whitespace-nowrap">
                      {new Date(alert.createdTs).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-4 py-2.5 text-slate-300 whitespace-nowrap">{alert.vehicleRegNo}</td>
                    <td className="px-4 py-2.5 text-white font-medium whitespace-nowrap">{alert.alertType.replace(/_/g, ' ')}</td>
                    <td className="px-4 py-2.5">
                      <span className={clsx('px-1.5 py-0.5 rounded text-[10px] font-bold border', SEV[alert.severity] ?? 'bg-slate-800 text-slate-400 border-slate-700')}>
                        {alert.severity}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={clsx('px-1.5 py-0.5 rounded text-[10px] font-semibold', STATUS_STYLE[alert.status] ?? 'bg-slate-800 text-slate-400')}>
                        {alert.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-400 whitespace-nowrap">{alert.ownerDisplayName ?? alert.ownerUserId ?? '-'}</td>
                    <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">{alert.slaDueTs ? fmtDate(alert.slaDueTs) : '-'}</td>
                    <td className="px-4 py-2.5">
                      {alert.escalationState ? (
                        <span className={clsx('px-1.5 py-0.5 rounded text-[10px] font-semibold', ESC_STYLE[alert.escalationState] ?? 'bg-slate-800 text-slate-400')}>
                          {alert.escalationState}
                        </span>
                      ) : (
                        <span className="text-slate-600">-</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-slate-500 max-w-[220px] truncate">{alert.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {selected && (
          <aside className="w-[380px] flex-shrink-0 border-l border-slate-800/60 flex flex-col overflow-y-auto bg-[#0c1322]">
            <div className="flex items-start justify-between p-4 border-b border-slate-800/60">
              <div>
                <div className="text-sm font-semibold text-white">{selected.alertType.replace(/_/g, ' ')}</div>
                <div className="text-[11px] text-slate-500 mt-0.5 font-mono">{selected.vehicleRegNo}</div>
              </div>
              <button type="button" onClick={() => setSelected(null)} className="text-slate-600 hover:text-slate-300 text-lg leading-none mt-0.5">x</button>
            </div>

            <div className="p-4 space-y-4 flex-1">
              <div className="flex gap-2 flex-wrap">
                <span className={clsx('px-2 py-0.5 rounded text-[10px] font-bold border', SEV[selected.severity] ?? 'bg-slate-800 text-slate-400 border-slate-700')}>{selected.severity}</span>
                <span className={clsx('px-2 py-0.5 rounded text-[10px] font-semibold', STATUS_STYLE[selected.status] ?? 'bg-slate-800 text-slate-400')}>{selected.status}</span>
                {selected.escalationState && (
                  <span className={clsx('px-2 py-0.5 rounded text-[10px] font-semibold', ESC_STYLE[selected.escalationState] ?? 'bg-slate-800 text-slate-400')}>
                    {selected.escalationState}
                  </span>
                )}
              </div>

              <div>
                <div className="text-xs font-semibold text-slate-300 mb-1">{selected.title}</div>
                <div className="text-[11px] text-slate-500 leading-relaxed">{selected.description}</div>
              </div>

              <div className="space-y-1">
                <Row label="Owner" value={selected.ownerDisplayName ?? selected.ownerUserId ?? '-'} />
                <Row label="SLA due" value={fmtDate(selected.slaDueTs)} />
                <Row label="Escalation" value={selected.escalationState ?? '-'} />
                <Row label="Esc. level" value={selected.escalationLevel != null ? String(selected.escalationLevel) : '-'} />
                <Row label="Created" value={fmtDate(selected.createdTs)} />
                <Row label="Closed" value={fmtDate(selected.closedTs)} />
                <Row label="Closure reason" value={selected.closureReason ?? '-'} />
                <Row label="Ack by" value={selected.acknowledgedBy ?? '-'} />
              </div>

              <div className="space-y-2 border-t border-slate-800/60 pt-3">
                <div className="text-[10px] uppercase tracking-wider text-slate-500">Assignment</div>
                <input
                  value={singleOwnerUserId}
                  onChange={(e) => setSingleOwnerUserId(e.target.value)}
                  placeholder="owner user id"
                  className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-[11px] text-slate-200"
                />
                <input
                  value={singleOwnerDisplayName}
                  onChange={(e) => setSingleOwnerDisplayName(e.target.value)}
                  placeholder="owner display name"
                  className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-[11px] text-slate-200"
                />
                <input
                  value={singleSlaMinutes}
                  onChange={(e) => setSingleSlaMinutes(e.target.value)}
                  placeholder="SLA minutes"
                  className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-[11px] text-slate-200"
                />
                <button
                  type="button"
                  onClick={() => assignSingle(selected.id)}
                  disabled={actionLoading || !singleOwnerUserId.trim() || selected.status === 'CLOSED'}
                  className="w-full py-1.5 bg-blue-700/80 hover:bg-blue-700 disabled:bg-slate-700 text-white rounded text-xs"
                >
                  Assign Owner
                </button>
              </div>

              <div className="space-y-2 border-t border-slate-800/60 pt-3">
                <div className="text-[10px] uppercase tracking-wider text-slate-500">Lifecycle</div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => ackSingle(selected.id)}
                    disabled={actionLoading || selected.status === 'CLOSED'}
                    className="py-1.5 bg-amber-700/80 hover:bg-amber-700 disabled:bg-slate-700 text-white rounded text-xs"
                  >
                    Acknowledge
                  </button>
                  <button
                    type="button"
                    onClick={() => closeSingle(selected.id)}
                    disabled={actionLoading || selected.status === 'CLOSED'}
                    className="py-1.5 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-700 text-white rounded text-xs"
                  >
                    Close
                  </button>
                </div>

                <select
                  value={singleClosureReason}
                  onChange={(e) => setSingleClosureReason(e.target.value as AlertClosureReason)}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-[11px] text-slate-200"
                >
                  {CLOSURE_REASON_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                <input
                  value={singleResolution}
                  onChange={(e) => setSingleResolution(e.target.value)}
                  placeholder="closure note (optional)"
                  className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-[11px] text-slate-200"
                />
              </div>

              <div className="pt-1 border-t border-slate-800/60">
                <button
                  type="button"
                  onClick={() => explain(selected.id)}
                  disabled={aiLoading}
                  className="w-full py-1.5 bg-blue-600/80 hover:bg-blue-600 disabled:opacity-50 text-white rounded text-xs font-medium"
                >
                  {aiLoading ? 'Analyzing...' : 'AI Explain'}
                </button>
                {aiText && (
                  <div className="mt-3 p-3 bg-slate-900/60 rounded max-h-[260px] overflow-y-auto">
                    <MarkdownContent content={aiText} />
                  </div>
                )}
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
