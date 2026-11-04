import type { SessionSummary } from '../api.ts';
import { ago, plural } from '../format.ts';
import { StatusBadge } from './StatusBadge.tsx';
import { SessionActions } from './SessionActions.tsx';

interface Props {
  sessions: SessionSummary[];
  selectedId: string | null;
  now: number;
  onSelect: (id: string) => void;
  onChanged: () => void;
}

export function SessionList({ sessions, selectedId, now, onSelect, onChanged }: Props) {
  if (sessions.length === 0) {
    return (
      <div className="empty">
        Žádné relace za poslední dny. Spusť Claude Code v nějakém projektu a za pár sekund se tu objeví.
      </div>
    );
  }
  return (
    <ul className="session-list">
      {sessions.map((s) => (
        <li
          key={s.id}
          className={`session session--${s.status} ${s.id === selectedId ? 'is-selected' : ''}`}
          onClick={() => onSelect(s.id)}
        >
          <div className="session__row">
            <StatusBadge status={s.status} idleKind={s.idleKind} />
            <span className="session__ago" title={s.lastActivityAt}>{ago(s.lastActivityAt, now)}</span>
          </div>
          <div className="session__title">{s.title}</div>
          <div className="session__meta">
            <span className="chip">{s.projectName}</span>
            {s.model && <span>{s.model}</span>}
            <span>
              {s.counts.prompts} zadání · {plural(s.counts.tools, 'nástroj', 'nástroje', 'nástrojů')}
              {s.counts.errors ? ` · ${plural(s.counts.errors, 'chyba', 'chyby', 'chyb')}` : ''}
            </span>
          </div>
          <div className="session__reason">{s.statusReason}</div>
          <SessionActions s={s} onChanged={onChanged} />
        </li>
      ))}
    </ul>
  );
}
