import type { SessionSummary } from '../api.ts';
import { crewCount } from '../format.ts';

export type View = '3d' | 'list';

export function TopBar({ sessions, view, onView, live }: { sessions: SessionSummary[]; view: View; onView: (v: View) => void; live: boolean }) {
  const n = (s: SessionSummary['status']) => sessions.filter((x) => x.status === s).length;
  const counters = [
    { key: 'working', icon: '🔨', label: 'staví se', value: n('working') },
    { key: 'needs_you', icon: '🙋', label: 'potřebuje tě', value: n('needs_you') },
    { key: 'blocked', icon: '🔥', label: 'zablokováno', value: n('blocked') },
    { key: 'shipped', icon: '🏁', label: 'hotovo', value: n('shipped') },
    { key: 'crew', icon: '👷', label: 'posádka', value: crewCount(sessions) },
  ];
  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand__logo" aria-hidden>🛖</span>
        <span className="brand__name">Bot Crossing</span>
        <span className={`live-dot ${live ? 'is-live' : ''}`} title={live ? 'Živé spojení (WebSocket)' : 'Bez živého spojení — obnovuji každé 2 s'} />
      </div>
      <ul className="counters">
        {counters.map((c) => (
          <li key={c.key} className={`counter counter--${c.key} ${c.value > 0 ? 'is-on' : ''}`}>
            <span aria-hidden>{c.icon}</span>
            <strong>{c.value}</strong>
            <span>{c.label}</span>
          </li>
        ))}
      </ul>
      <div className="view-toggle" role="group" aria-label="Zobrazení">
        <button className={view === '3d' ? 'is-on' : ''} onClick={() => onView('3d')}>Kolonie</button>
        <button className={view === 'list' ? 'is-on' : ''} onClick={() => onView('list')}>Seznam</button>
      </div>
    </header>
  );
}
