import type { SessionStatus } from './api.ts';

export const STATUS_LABEL: Record<SessionStatus, string> = {
  needs_you: 'Potřebuje tě',
  blocked: 'Zablokováno',
  working: 'Pracuje',
  idle: 'Nečinné',
  shipped: 'Hotovo',
};

/** "před 12 s", "před 3 min", "před 2 h", "před 1 dnem", "před 4 dny" */
export function ago(iso: string | undefined, now: number): string {
  if (!iso) return '—';
  const sec = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (sec < 5) return 'právě teď';
  if (sec < 60) return `před ${sec} s`;
  const min = Math.round(sec / 60);
  if (min < 60) return `před ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `před ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? 'před 1 dnem' : `před ${d} dny`;
}

export function clock(iso: string): string {
  const d = new Date(iso);
  const today = new Date().toDateString() === d.toDateString();
  return today
    ? d.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : d.toLocaleString('cs-CZ', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** Crew = workers on screen: 2 per working session (subagents add more in phase 4). */
export function crewCount(statuses: SessionStatus[]): number {
  return statuses.filter((s) => s === 'working').length * 2;
}

/** Czech plural: plural(1,'nástroj','nástroje','nástrojů') → "1 nástroj", 3 → "3 nástroje", 5 → "5 nástrojů". */
export function plural(n: number, one: string, few: string, many: string): string {
  return `${n} ${n === 1 ? one : n >= 2 && n <= 4 ? few : many}`;
}
