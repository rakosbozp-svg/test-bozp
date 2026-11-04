import { useState } from 'react';
import { copyText, setArchived, type SessionSummary } from '../api.ts';

export function SessionActions({ s, onChanged }: { s: SessionSummary; onChanged: () => void }) {
  const [msg, setMsg] = useState<string | null>(null);
  const flash = (m: string) => {
    setMsg(m);
    setTimeout(() => setMsg(null), 2500);
  };

  const open = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await copyText(s.resumeCommand);
    flash('Příkaz zkopírován — vlož ho do terminálu');
  };
  const archive = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await setArchived(s.id, !s.archived);
      onChanged();
    } catch (err) {
      flash(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="actions">
      <button className="btn" onClick={open} title={s.resumeCommand}>
        Otevřít
      </button>
      <button
        className="btn btn--ghost"
        onClick={archive}
        disabled={!s.archived && s.status === 'working'}
        title={!s.archived && s.status === 'working' ? 'Pracující relaci nejde archivovat' : undefined}
      >
        {s.archived ? 'Obnovit' : 'Archivovat'}
      </button>
      {msg && <span className="actions__msg">{msg}</span>}
    </div>
  );
}
