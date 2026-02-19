'use client';

import { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import { apiPost } from '../lib/api';
import type { AiChatResponse, AiDailySummaryResponse, AiEvidenceReference } from '../lib/types';

type CopilotMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  model?: string;
  refs: AiEvidenceReference[];
  ts: string;
  source: 'chat' | 'daily-summary';
};

type PageContext = {
  page: string;
  entityType?: 'vehicle' | 'alert' | 'trip' | 'driver' | 'depot';
  entityId?: string;
};

function moduleLabel(pathname: string): string {
  if (pathname.startsWith('/alerts')) return 'Alert Ops';
  if (pathname.startsWith('/dispatch')) return 'Dispatch';
  if (pathname.startsWith('/drivers')) return 'Driver Ops';
  if (pathname.startsWith('/maintenance')) return 'Maintenance';
  if (pathname.startsWith('/fuel')) return 'Fuel Ops';
  if (pathname.startsWith('/costs')) return 'Cost Ops';
  if (pathname.startsWith('/vehicles')) return 'Vehicle Detail';
  if (pathname.startsWith('/scenarios')) return 'Scenarios';
  return 'Fleet Dashboard';
}

function contextAwarePrompts(pathname: string): string[] {
  if (pathname.startsWith('/alerts')) {
    return [
      'Which open alerts should we prioritize in the next 30 minutes?',
      'Give an SLA rescue plan for overdue alerts.',
      'What closure reasons look suspicious today?',
    ];
  }
  if (pathname.startsWith('/dispatch')) {
    return [
      'Which trips are at risk of delay and why?',
      'Recommend dispatch actions for the next hour.',
      'Summarize active exceptions and mitigation steps.',
    ];
  }
  if (pathname.startsWith('/drivers')) {
    return [
      'Which drivers are not assignment-ready and why?',
      'Highlight risk trends we should address this shift.',
      'Suggest assignment-safe driver rotations.',
    ];
  }
  if (pathname.startsWith('/maintenance')) {
    return [
      'What work orders are most urgent right now?',
      'Which vehicles create highest downtime risk?',
      'Give a closeout plan for open maintenance items.',
    ];
  }
  if (pathname.startsWith('/fuel')) {
    return [
      'Which fuel anomalies need immediate review?',
      'How should we disposition current anomaly backlog?',
      'Identify repeated anomaly patterns by vehicle.',
    ];
  }
  if (pathname.startsWith('/costs')) {
    return [
      'Which vehicles have the worst cost-per-km today?',
      'How can we reduce idle-cost ratio this week?',
      'Summarize top cost drivers by category.',
    ];
  }
  return [
    'Give me an operations pulse for the fleet right now.',
    'What should operations focus on in the next hour?',
    'List the top risks and immediate actions.',
  ];
}

function buildContext(pathname: string): PageContext {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0) return { page: pathname || '/' };

  if (segments[0] === 'vehicles' && segments[1]) {
    return { page: pathname, entityType: 'vehicle', entityId: segments[1] };
  }
  if (segments[0] === 'dispatch' && segments[1] === 'trips' && segments[2]) {
    return { page: pathname, entityType: 'trip', entityId: segments[2] };
  }
  if (segments[0] === 'drivers' && segments[1]) {
    return { page: pathname, entityType: 'driver', entityId: segments[1] };
  }
  return { page: pathname };
}

function formatRef(ref: AiEvidenceReference): string {
  const idPart = ref.refId ? `${ref.refId} ` : '';
  const valuePart = ref.value != null ? ` (${String(ref.value)})` : '';
  return `${idPart}${ref.label}${valuePart}`.trim();
}

function randomId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function CopilotDrawer() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const module = useMemo(() => moduleLabel(pathname), [pathname]);
  const prompts = useMemo(() => contextAwarePrompts(pathname), [pathname]);
  const context = useMemo(() => buildContext(pathname), [pathname]);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, open]);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    setError(null);
    const userMessage: CopilotMessage = {
      id: randomId('user'),
      role: 'user',
      content: trimmed,
      refs: [],
      ts: new Date().toISOString(),
      source: 'chat',
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setSending(true);

    try {
      const history = messages
        .filter((msg) => msg.source === 'chat')
        .slice(-10)
        .map((msg) => ({ role: msg.role, content: msg.content }));

      const response = await apiPost<AiChatResponse>('/api/ai/chat', {
        message: trimmed,
        history,
        context,
      });

      const refs = response.evidence?.references ?? response.references ?? [];
      const assistantMessage: CopilotMessage = {
        id: randomId('assistant'),
        role: 'assistant',
        content: response.reply,
        model: response.model,
        refs,
        ts: new Date().toISOString(),
        source: 'chat',
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Copilot request failed';
      setError(msg);
    } finally {
      setSending(false);
    }
  }, [context, messages, sending]);

  const runDailySummary = useCallback(async () => {
    if (sending) return;
    setError(null);
    setSending(true);

    try {
      const response = await apiPost<AiDailySummaryResponse>('/api/ai/daily-summary', {
        date: new Date().toISOString().slice(0, 10),
      });

      const refs = response.evidence?.references ?? response.references ?? [];
      const assistantMessage: CopilotMessage = {
        id: randomId('daily'),
        role: 'assistant',
        content: response.summary,
        model: response.model,
        refs,
        ts: new Date().toISOString(),
        source: 'daily-summary',
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Daily summary failed';
      setError(msg);
    } finally {
      setSending(false);
    }
  }, [sending]);

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-[2001] rounded-full bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 text-[12px] font-semibold shadow-lg"
        >
          Copilot
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-[2000]">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/40"
            aria-label="Close copilot"
          />

          <aside className="absolute right-0 top-0 h-full w-full max-w-[430px] bg-[#1f1a17] border-l border-slate-800/70 shadow-2xl flex flex-col">
            <header className="px-4 py-3 border-b border-slate-800/70 bg-[#292524]">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold text-white">Fleet Copilot</div>
                  <div className="text-[11px] text-slate-500">Context: {module}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="text-slate-500 hover:text-slate-300 text-lg leading-none"
                >
                  x
                </button>
              </div>

              <div className="mt-2 flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={runDailySummary}
                  disabled={sending}
                  className="px-2 py-1 rounded bg-emerald-700/80 hover:bg-emerald-700 disabled:bg-slate-700 text-[11px] text-white"
                >
                  Daily Summary
                </button>
                {prompts.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => void sendMessage(prompt)}
                    disabled={sending}
                    className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:bg-slate-700 text-[11px] text-slate-200"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </header>

            <div ref={listRef} className="flex-1 overflow-auto p-4 space-y-3">
              {messages.length === 0 && (
                <div className="rounded border border-slate-800 bg-slate-900/50 p-3 text-[12px] text-slate-400">
                  Ask operational questions from any page. Copilot will include evidence references when available.
                </div>
              )}

              {messages.map((message) => (
                <div
                  key={message.id}
                  className={clsx(
                    'rounded border px-3 py-2 text-[12px] leading-relaxed',
                    message.role === 'user'
                      ? 'border-emerald-900/70 bg-emerald-950/30 text-emerald-100'
                      : 'border-slate-800 bg-slate-900/60 text-slate-100',
                  )}
                >
                  <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">
                    {message.role === 'user' ? 'You' : 'Copilot'}
                    {message.model ? ` | ${message.model}` : ''}
                  </div>
                  <div className="whitespace-pre-wrap">{message.content}</div>

                  {message.refs.length > 0 && (
                    <div className="mt-2 border-t border-slate-800/60 pt-2 space-y-1">
                      <div className="text-[10px] uppercase tracking-wide text-slate-600">Evidence</div>
                      {message.refs.slice(0, 8).map((ref, idx) => (
                        <div key={`${message.id}-ref-${idx}`} className="text-[11px] text-slate-400">
                          [{ref.refType}] {formatRef(ref)}
                          {ref.ts ? ` @ ${new Date(ref.ts).toLocaleString('en-IN')}` : ''}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {sending && (
                <div className="rounded border border-slate-800 bg-slate-900/60 px-3 py-2 text-[12px] text-slate-400">
                  Copilot is thinking...
                </div>
              )}

              {error && (
                <div className="rounded border border-rose-800/70 bg-rose-950/30 px-3 py-2 text-[12px] text-rose-300">
                  {error}
                </div>
              )}
            </div>

            <footer className="p-3 border-t border-slate-800/70 bg-[#292524]">
              <div className="flex items-end gap-2">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask fleet copilot..."
                  rows={3}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void sendMessage(input);
                    }
                  }}
                  className="flex-1 resize-none rounded border border-slate-700 bg-slate-900/70 px-2 py-2 text-[12px] text-slate-200"
                />
                <button
                  type="button"
                  onClick={() => void sendMessage(input)}
                  disabled={sending || !input.trim()}
                  className="h-10 px-3 rounded bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white text-[12px] font-semibold"
                >
                  Send
                </button>
              </div>
            </footer>
          </aside>
        </div>
      )}
    </>
  );
}
