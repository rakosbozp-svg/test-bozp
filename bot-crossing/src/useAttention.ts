import { useEffect, useRef, useState } from 'react';
import type { SessionSummary } from './api.ts';

const BASE_TITLE = 'Bot Crossing';
const icon = (emoji: string) =>
  `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>${emoji}</text></svg>`;

function readPref(): boolean {
  try {
    return localStorage.getItem('bc.notify') === '1';
  } catch {
    return false;
  }
}

/**
 * Makes "needs you" visible even when this tab isn't in front:
 * - tab title "(2) 🙋 Bot Crossing" and a 🙋 favicon,
 * - optional desktop notification when a session starts waiting (browser's local Notification API).
 */
export function useAttention(sessions: SessionSummary[] | null, onOpen: (id: string) => void) {
  const [notify, setNotifyState] = useState(readPref);
  const seen = useRef<Set<string> | null>(null);
  const supported = typeof Notification !== 'undefined';

  useEffect(() => {
    if (!sessions) return;
    const waiting = sessions.filter((s) => s.status === 'needs_you');
    document.title = waiting.length ? `(${waiting.length}) 🙋 ${BASE_TITLE}` : BASE_TITLE;
    const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (link) link.href = icon(waiting.length ? '🙋' : '🛖');

    const now = new Set(waiting.map((s) => s.id));
    if (seen.current && notify && supported && Notification.permission === 'granted') {
      for (const s of waiting) {
        if (seen.current.has(s.id)) continue;
        const n = new Notification(`🙋 ${s.projectName} na tebe čeká`, { body: `${s.title}\n${s.statusReason}`, tag: `bc-${s.id}` });
        n.onclick = () => {
          window.focus();
          onOpen(s.id);
          n.close();
        };
      }
    }
    seen.current = now; // first load only records; it doesn't notify about old requests
  }, [sessions, notify, supported, onOpen]);

  const setNotify = async (on: boolean) => {
    if (on && supported && Notification.permission !== 'granted') {
      const p = await Notification.requestPermission();
      if (p !== 'granted') on = false;
    }
    setNotifyState(on);
    try {
      localStorage.setItem('bc.notify', on ? '1' : '0');
    } catch {
      /* not remembered */
    }
  };

  return { notify, setNotify, supported };
}
