import { useCallback, useEffect, useRef, useState } from 'react';
import type { SessionDetail, SessionSummary } from '../server/types.ts';

export type { SessionDetail, SessionSummary, SessionStatus } from '../server/types.ts';

const POLL_MS = 2000;

export interface LiveMeta {
  received: number;
  ignored: number;
  lastHookAt: string | null;
}

async function getJson<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json();
}

/**
 * Live session list. The server pushes changes over a WebSocket the moment they happen;
 * if the socket drops, we poll every 2 s and keep trying to reconnect.
 */
export function useSessions() {
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null);
  const [meta, setMeta] = useState<LiveMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  /** Increments on every update, so detail views know when to refetch. */
  const [version, setVersion] = useState(0);

  const reload = useCallback(async () => {
    try {
      setSessions(await getJson<SessionSummary[]>('/api/sessions'));
      setVersion((v) => v + 1);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let poll: ReturnType<typeof setInterval> | undefined;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let backoff = 1000;
    let stopped = false;

    const startPolling = () => {
      if (poll) return;
      reload();
      poll = setInterval(reload, POLL_MS);
    };
    const stopPolling = () => {
      if (poll) clearInterval(poll);
      poll = undefined;
    };
    const connect = () => {
      if (stopped) return;
      ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`);
      ws.onopen = () => {
        backoff = 1000;
        setLive(true);
        setError(null);
        stopPolling();
      };
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === 'sessions') {
            setSessions(msg.sessions);
            setMeta(msg.meta);
            setVersion((v) => v + 1);
          }
        } catch {
          /* ignore malformed */
        }
      };
      ws.onclose = () => {
        setLive(false);
        startPolling();
        if (!stopped) retry = setTimeout(connect, (backoff = Math.min(backoff * 2, 10_000)));
      };
    };

    startPolling(); // show data immediately, even before the socket opens
    connect();
    return () => {
      stopped = true;
      stopPolling();
      if (retry) clearTimeout(retry);
      ws?.close();
    };
  }, [reload]);

  return { sessions, meta, error, live, version, reload };
}

/** Detail of one session; refetched whenever the live list changes (at most ~once a second). */
export function useSessionDetail(id: string | null, version: number) {
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const current = useRef(id);
  const lastFetch = useRef(0);
  current.current = id;

  const load = useCallback(async (forId: string) => {
    lastFetch.current = Date.now();
    try {
      const d = await getJson<SessionDetail>(`/api/sessions/${encodeURIComponent(forId)}`);
      if (current.current === forId) setDetail(d);
    } catch {
      /* keep last good detail */
    }
  }, []);

  useEffect(() => {
    setDetail(null);
    if (id) load(id);
  }, [id, load]);

  useEffect(() => {
    if (!id) return;
    const wait = Math.max(0, 1000 - (Date.now() - lastFetch.current));
    const t = setTimeout(() => load(id), wait);
    return () => clearTimeout(t);
  }, [version, id, load]);

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
