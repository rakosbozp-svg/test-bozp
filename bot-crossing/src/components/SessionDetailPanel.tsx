import type { SessionDetail } from '../api.ts';
import { ago, clock } from '../format.ts';
import { StatusBadge } from './StatusBadge.tsx';
import { SessionActions } from './SessionActions.tsx';

const OUTCOME: Record<string, string> = {
  pending: '⏳ běží',
  ok: '✓ ok',
  error: '✗ chyba',
  rejected: '⊘ zamítnuto',
  interrupted: '⏹ přerušeno',
};

export function SessionDetailPanel({ d, now, onChanged, onClose }: { d: SessionDetail; now: number; onChanged: () => void; onClose: () => void }) {
  return (
    <aside className="detail">
      <div className="detail__head">
        <StatusBadge status={d.status} idleKind={d.idleKind} />
        <button className="btn btn--ghost btn--small" onClick={onClose} aria-label="Zavřít">✕</button>
      </div>
      <h2 className="detail__title">{d.title}</h2>
      <p className="detail__reason">{d.statusReason}</p>
      <SessionActions s={d} onChanged={onChanged} />

      <dl className="facts">
        <dt>Projekt</dt><dd className="mono">{d.projectPath}</dd>
        <dt>Model</dt><dd>{d.model ?? '—'}</dd>
        <dt>Větev</dt><dd>{d.gitBranch ?? '—'}</dd>
        <dt>Začátek</dt><dd>{d.startedAt ? clock(d.startedAt) : '—'}</dd>
        <dt>Aktivita</dt><dd>{ago(d.lastActivityAt, now)}</dd>
        <dt>Proces</dt>
        <dd>{d.process ? `pid ${d.process.pid} · ${d.process.alive ? 'běží' : 'neběží'}${d.process.status ? ` · „${d.process.status}“` : ''}` : 'není v registru (zavřeno, nebo neznámo)'}</dd>
        <dt>Claude Code</dt><dd>{d.version ?? '—'}</dd>
        <dt>ID</dt><dd className="mono">{d.id}</dd>
      </dl>

      <h3>Poslední nástroje</h3>
      {d.recentTools.length === 0 ? <p className="muted">Zatím žádné.</p> : (
        <ul className="tools">
          {d.recentTools.slice(0, 15).map((t) => (
            <li key={t.id} className={`tool tool--${t.outcome}`}>
              <span className="tool__time">{clock(t.startedAt)}</span>
              <span className="tool__name">{t.name}</span>
              <span className="tool__summary">{t.summary}</span>
              <span className="tool__outcome">{OUTCOME[t.outcome]}</span>
              {t.errorText && <div className="tool__error">{t.errorText}</div>}
            </li>
          ))}
        </ul>
      )}

      <h3>Poslední zprávy</h3>
      <ul className="messages">
        {d.messages.slice(0, 6).map((m, i) => (
          <li key={i} className={`msg msg--${m.role}`}>
            <span className="msg__who">{m.role === 'user' ? 'Ty' : 'Claude'} · {clock(m.at)}</span>
            <p>{m.text}</p>
          </li>
        ))}
      </ul>

      <h3>Časová osa</h3>
      <ol className="timeline">
        {d.timeline.slice(0, 40).map((e, i) => (
          <li key={i} className={`tl tl--${e.kind}`}>
            <span className="tl__time">{clock(e.at)}</span>
            <span className="tl__label">{e.label}</span>
          </li>
        ))}
      </ol>

      <details className="raw">
        <summary>Surová data (pro kontrolu)</summary>
        <pre>{JSON.stringify(d, null, 2)}</pre>
      </details>
    </aside>
  );
}
