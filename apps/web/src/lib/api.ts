export const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001/ws';

const ACTIVE_USER_KEY = 'fleet.activeUserId';
const DEFAULT_USER_ID = 'ops-admin';

export function getActiveUserId(): string {
  if (typeof window === 'undefined') return DEFAULT_USER_ID;
  const stored = window.localStorage.getItem(ACTIVE_USER_KEY)?.trim();
  return stored && stored.length > 0 ? stored : DEFAULT_USER_ID;
}

export function setActiveUserId(userId: string): void {
  if (typeof window === 'undefined') return;
  const trimmed = userId.trim();
  if (!trimmed) {
    window.localStorage.removeItem(ACTIVE_USER_KEY);
    return;
  }
  window.localStorage.setItem(ACTIVE_USER_KEY, trimmed);
}

function buildHeaders(base?: HeadersInit): Headers {
  const headers = new Headers(base);
  const userId = getActiveUserId();
  if (userId) headers.set('x-user-id', userId);
  return headers;
}

export const fetcher = (url: string) => fetch(url, { headers: buildHeaders() }).then((r) => r.json());

export async function apiPost<T = unknown>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: buildHeaders({ 'Content-Type': 'application/json' }),
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}
