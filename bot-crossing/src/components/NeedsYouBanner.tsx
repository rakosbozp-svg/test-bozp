import type { SessionSummary } from '../api.ts';

/** The loudest thing in the UI: every session waiting for you, one click away. */
export function NeedsYouBanner({ sessions, onSelect }: { sessions: SessionSummary[]; onSelect: (id: string) => void }) {
  const waiting = sessions.filter((s) => s.status === 'needs_you');
  if (waiting.length === 0) return null;
  return (
    <section className="needs-you" role="alert">
      <div className="needs-you__title">
        🙋 {waiting.length === 1 ? 'Jedna relace na tebe čeká' : `${waiting.length} ${waiting.length <= 4 ? 'relace na tebe čekají' : 'relací na tebe čeká'}`}
      </div>
      <div className="needs-you__items">
        {waiting.map((s) => (
          <button key={s.id} className="needs-you__item" onClick={() => onSelect(s.id)}>
            <strong>{s.projectName}</strong> · {s.title}
            <span className="needs-you__reason">{s.statusReason}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
