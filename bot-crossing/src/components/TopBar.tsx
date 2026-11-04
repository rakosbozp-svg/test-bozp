import type { SessionSummary } from '../api.ts';
import { crewCount } from '../format.ts';

export function TopBar({ sessions }: { sessions: SessionSummary[] }) {
  const n = (s: SessionSummary['status']) => sessions.filter((x) => x.status === s).length;
  const counters = [
    { key: 'working', icon: '🔨', label: 'staví se', value: n('working') },
    { key: 'needs_you', icon: '🙋', label: 'potřebuje tě', value: n('needs_you') },
    { key: 'blocked', icon: '🔥', label: 'zablokováno', value: n('blocked') },
    { key: 'shipped', icon: '🏁', label: 'hotovo', value: n('shipped') },
    { key: 'crew', icon: '👷', label: 'posádka', value: crewCount(sessions.map((s) => s.status)) },
  ];
  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand__logo" aria-hidden>🛖</span>
        <span className="brand__name">Bot Crossing</span>
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
    </header>
  );
}
