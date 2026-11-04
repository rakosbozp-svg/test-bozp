import { useState } from 'react';
import { useSessionDetail, useSessions } from './api.ts';
import { useNow } from './useNow.ts';
import { TopBar } from './components/TopBar.tsx';
import { NeedsYouBanner } from './components/NeedsYouBanner.tsx';
import { SessionList } from './components/SessionList.tsx';
import { SessionDetailPanel } from './components/SessionDetailPanel.tsx';

export function App() {
  const { sessions, error, reload } = useSessions();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const detail = useSessionDetail(selectedId);
  const now = useNow();

  return (
    <div className="app">
      <TopBar sessions={sessions ?? []} />
      {error && <div className="offline">Backend neodpovídá ({error}). Běží <code>npm run dev</code>?</div>}
      <NeedsYouBanner sessions={sessions ?? []} onSelect={setSelectedId} />
      <main className="layout">
        <section className="list-pane">
          {sessions === null ? <div className="empty">Načítám relace…</div> : (
            <SessionList sessions={sessions} selectedId={selectedId} now={now} onSelect={setSelectedId} onChanged={reload} />
          )}
        </section>
        {selectedId && detail && (
          <SessionDetailPanel d={detail} now={now} onChanged={reload} onClose={() => setSelectedId(null)} />
        )}
      </main>
    </div>
  );
}
