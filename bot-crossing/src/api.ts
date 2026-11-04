import { useCallback, useEffect, useRef, useState } from 'react';
import type { SessionDetail, SessionSummary } from '../server/types.ts';

export type { SessionDetail, SessionSummary, SessionStatus } from '../server/types.ts';

const POLL_MS = 2000;

async function getJson<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json();
}

/** Polls the session list. (Phase 4 replaces polling with WebSocket pushes.) */
export function useSessions() {
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setSessions(await getJson<SessionSummary[]>('/api/sessions'));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    reload();
    const t = setInterval(reload, POLL_MS);
    return () => clearInterval(t);
  }, [reload]);

  return { sessions, error, reload };
}

export function useSessionDetail(id: string | null) {
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const current = useRef(id);
  current.current = id;

  useEffect(() => {
    setDetail(null);
    if (!id) return;
    const load = async () => {
      try {
        const d = await getJson<SessionDetail>(`/api/sessions/${encodeURIComponent(id)}`);
        if (current.current === id) setDetail(d);
      } catch {
        /* keep last good detail */
      }
    };
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [id]);

  return detail;
}

export async function setArchived(id: string, archived: boolean): Promise<void> {
  const r = await fetch(`/api/sessions/${encodeURIComponent(id)}/${archived ? 'archive' : 'unarchive'}`, { method: 'POST' });
  if (!r.ok) {
    const body = await r.json().catch(() => ({}));
    throw new Error(body.error ?? `${r.status}`);
  }
}

export async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
}
