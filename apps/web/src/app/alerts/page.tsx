'use client';

import { useState, useCallback } from 'react';
import useSWR, { mutate } from 'swr';
import clsx from 'clsx';
import type { Alert } from '../../lib/types';
import { API, fetcher, apiPost } from '../../lib/api';

export default function AlertsPage() {
  const [statusFilter, setStatusFilter] = useState<string>('OPEN');
  const [severityFilter, setSeverityFilter] = useState<string>('');
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [ackLoading, setAckLoading] = useState(false);
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const params = new URLSearchParams();
  if (statusFilter) params.set('status', statusFilter);
  if (severityFilter) params.set('severity', severityFilter);
  params.set('limit', '50');

  const alertsUrl = `${API}/api/alerts?${params.toString()}`;
  const { data: alertsResp, isLoading } = useSWR<{ data: Alert[]; total: number }>(
    alertsUrl,
    fetcher,
    { refreshInterval: 5000 },
  );

  const alerts = alertsResp?.data ?? [];

  const handleAck = useCallback(
    async (alertId: string) => {
      setAckLoading(true);
      try {
        await apiPost(`/api/alerts/${alertId}/ack`, {
          actorId: 'ops-user-01',
          note: 'Acknowledged via dashboard',
        });
        void mutate(alertsUrl);
        setSelectedAlert(null);
      } finally {
        setAckLoading(false);
      }
    },
    [alertsUrl],
  );

  const handleClose = useCallback(
    async (alertId: string) => {
      await apiPost(`/api/alerts/${alertId}/close`, {
        resolution: 'Resolved via dashboard',
      });
      void mutate(alertsUrl);
      setSelectedAlert(null);
    },
    [alertsUrl],
  );

  const handleExplain = useCallback(async (alertId: string) => {
    setAiLoading(true);
    setAiExplanation(null);
    try {
      const result = await apiPost<{ answer?: string; explanation?: string; error?: string }>(
        '/api/ai/explain-alert',
        { alertId },
      );
      setAiExplanation(result.answer ?? result.explanation ?? result.error ?? 'No explanation available');
    } catch {
      setAiExplanation('AI provider unavailable — is Ollama running?');
    } finally {
      setAiLoading(false);
    }
  }, []);

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-white">Alerts</h1>
        <p className="text-sm text-slate-400 mt-0.5">Monitor and manage fleet alerts</p>
      </header>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <FilterGroup
          label="Status"
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: '', label: 'All' },
            { value: 'OPEN', label: 'Open' },
            { value: 'ACK', label: 'Acknowledged' },
            { value: 'CLOSED', label: 'Closed' },
          ]}
        />
        <FilterGroup
          label="Severity"
          value={severityFilter}
          onChange={setSeverityFilter}
          options={[
            { value: '', label: 'All' },
            { value: 'HIGH', label: 'High' },
            { value: 'MEDIUM', label: 'Medium' },
            { value: 'LOW', label: 'Low' },
          ]}
        />
        <span className="text-sm text-slate-500 ml-auto">
          {alerts.length} alert{alerts.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Alert List */}
        <section className="lg:col-span-2 bg-slate-800 rounded-xl p-4">
          {isLoading ? (
            <p className="text-slate-500 text-sm">Loading…</p>
          ) : alerts.length === 0 ? (
            <p className="text-slate-500 text-sm">No alerts match the current filters</p>
          ) : (
            <div className="space-y-2">
              {alerts.map((a) => (
                <button
                  key={a.id}
                  onClick={() => {
                    setSelectedAlert(a);
                    setAiExplanation(null);
                  }}
                  className={clsx(
                    'w-full text-left p-3 rounded-lg transition-colors border',
                    selectedAlert?.id === a.id
                      ? 'bg-slate-700 border-blue-500'
                      : 'bg-slate-800 border-slate-700 hover:bg-slate-700/50',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white">{a.alertType}</span>
                        <SeverityBadge severity={a.severity} />
                        <StatusBadge status={a.status} />
                      </div>
                      <p className="text-sm text-slate-300 mt-1 truncate">{a.title}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                        <span className="font-mono">{a.vehicleRegNo}</span>
                        <span>{new Date(a.createdTs).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Alert Detail Panel */}
        <section className="bg-slate-800 rounded-xl p-4">
          {selectedAlert ? (
            <div className="space-y-4">
              <h2 className="font-semibold text-white">Alert Detail</h2>

              <div className="space-y-2 text-sm">
                <DetailRow label="Type" value={selectedAlert.alertType} />
                <DetailRow label="Title" value={selectedAlert.title} />
                <DetailRow label="Description" value={selectedAlert.description} />
                <DetailRow label="Vehicle" value={selectedAlert.vehicleRegNo} mono />
                <DetailRow label="Severity" value={selectedAlert.severity} />
                <DetailRow label="Status" value={selectedAlert.status} />
                <DetailRow
                  label="Created"
                  value={new Date(selectedAlert.createdTs).toLocaleString()}
                />
                {selectedAlert.acknowledgedBy && (
                  <DetailRow label="Acked by" value={selectedAlert.acknowledgedBy} />
                )}
                {selectedAlert.note && (
                  <DetailRow label="Note" value={selectedAlert.note} />
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-700">
                {selectedAlert.status === 'OPEN' && (
                  <button
                    onClick={() => handleAck(selectedAlert.id)}
                    disabled={ackLoading}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600 text-white rounded-lg text-sm transition-colors"
                  >
                    {ackLoading ? 'Acking…' : '✓ Acknowledge'}
                  </button>
                )}
                {selectedAlert.status !== 'CLOSED' && (
                  <button
                    onClick={() => handleClose(selectedAlert.id)}
                    className="px-3 py-1.5 bg-slate-600 hover:bg-slate-500 text-white rounded-lg text-sm transition-colors"
                  >
                    ✕ Close
                  </button>
                )}
                <button
                  onClick={() => handleExplain(selectedAlert.id)}
                  disabled={aiLoading}
                  className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-600 text-white rounded-lg text-sm transition-colors"
                >
                  {aiLoading ? 'Analyzing…' : '🤖 AI Explain'}
                </button>
              </div>

              {/* AI Explanation */}
              {aiExplanation && (
                <div className="bg-purple-900/20 border border-purple-800 rounded-lg p-3 mt-3">
                  <h3 className="text-xs font-semibold text-purple-300 mb-1">AI Analysis</h3>
                  <p className="text-sm text-slate-300 whitespace-pre-wrap">
                    {aiExplanation}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12 text-slate-500 text-sm">
              Select an alert to view details
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

/* ── Sub-components ── */

function FilterGroup({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-slate-500">{label}:</span>
      <div className="flex rounded-lg overflow-hidden border border-slate-700">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={clsx(
              'px-3 py-1 text-xs transition-colors',
              value === opt.value
                ? 'bg-blue-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700',
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function DetailRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-slate-400 flex-shrink-0">{label}</span>
      <span className={clsx('text-slate-200 text-right truncate', mono && 'font-mono')}>
        {value}
      </span>
    </div>
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
        'px-1.5 py-0.5 rounded text-xs font-medium',
        config[s] ?? 'bg-slate-700 text-slate-400',
      )}
    >
      {severity}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, string> = {
    OPEN: 'bg-red-900/50 text-red-300',
    ACK: 'bg-yellow-900/50 text-yellow-300',
    CLOSED: 'bg-slate-700 text-slate-400',
  };
  return (
    <span
      className={clsx(
        'px-1.5 py-0.5 rounded text-xs font-medium',
        config[status] ?? 'bg-slate-700 text-slate-400',
      )}
    >
      {status}
    </span>
  );
}
