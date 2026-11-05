import type { SessionStatus } from '../api.ts';
import { STATUS_LABEL } from '../format.ts';

export function StatusBadge({ status, idleKind }: { status: SessionStatus; idleKind?: 'your_move' | 'quiet' }) {
  const label = status === 'idle' && idleKind === 'your_move' ? 'Jsi na tahu' : STATUS_LABEL[status];
  return (
    <span className={`badge badge--${status}`}>
      <span className="dot" aria-hidden />
      {label}
    </span>
  );
}
