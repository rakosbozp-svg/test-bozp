import { Component, lazy, Suspense, useState, type ReactNode } from 'react';
import { useSessionDetail, useSessions } from './api.ts';
import { useNow } from './useNow.ts';
import { TopBar, type View } from './components/TopBar.tsx';
import { NeedsYouBanner } from './components/NeedsYouBanner.tsx';
import { SessionList } from './components/SessionList.tsx';
import { SessionDetailPanel } from './components/SessionDetailPanel.tsx';

// three.js is big: load it after the list is already on screen.
const ColonyScene = lazy(() => import('./scene/ColonyScene.tsx'));

function readView(): View {
  try {
    return localStorage.getItem('bc.view') === 'list' ? 'list' : '3d';
  } catch {
    return '3d';
  }
}

/** If WebGL is unavailable or the scene crashes, keep the rest of the app usable. */
class SceneBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null as string | null };
  static getDerivedStateFromError(e: unknown) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="stage-fallback">
          3D scénu se nepodařilo spustit ({this.state.error}). Seznam vlevo funguje dál, nebo přepni na „Seznam“.
        </div>
      );
    }
    return this.props.children;
  }
}

function HooksHint() {
  return (
    <div className="hooks-hint">
      <strong>Hooky zatím nic neposlaly.</strong> Stav „Potřebuje tě“ a okamžité změny fungují nejlépe s hooky
      (návod v README → Hooky). Bez nich se stav odhaduje ze souborů relací.
    </div>
  );
}

export function App() {
  const { sessions, meta, error, live, version, reload } = useSessions();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [view, setViewState] = useState<View>(readView);
  const detail = useSessionDetail(selectedId, version);
  const now = useNow();

  const setView = (v: View) => {
    setViewState(v);
    try {
      localStorage.setItem('bc.view', v);
    } catch {
      /* private mode: just don't remember */
    }
  };

  const list = sessions ?? [];
  const listEl =
    sessions === null ? (
      <div className="empty">Načítám relace…</div>
    ) : (
      <SessionList
        sessions={list}
        selectedId={selectedId}
        hoveredId={hoveredId}
        now={now}
        compact={view === '3d'}
        onSelect={setSelectedId}
        onHover={setHoveredId}
        onChanged={reload}
      />
    );
  const detailEl = selectedId && detail && (
    <SessionDetailPanel d={detail} now={now} onChanged={reload} onClose={() => setSelectedId(null)} />
  );

  return (
    <div className={`app app--${view}`}>
      <TopBar sessions={list} view={view} onView={setView} live={live} />
      {error && <div className="offline">Backend neodpovídá ({error}). Běží <code>npm run dev</code>?</div>}
      <NeedsYouBanner sessions={list} onSelect={setSelectedId} />
      {view === 'list' ? (
        <main className="layout">
          <section className="list-pane">{listEl}</section>
          {detailEl}
        </main>
      ) : (
        <main className={`layout3d ${detailEl ? 'has-detail' : ''}`}>
          <aside className="sidebar">
            {meta && meta.received === 0 && <HooksHint />}
            {listEl}
          </aside>
          <section className="stage">
            <SceneBoundary>
              <Suspense fallback={<div className="stage-fallback">Stavím kolonii…</div>}>
                <ColonyScene
                  sessions={list}
                  selectedId={selectedId}
                  hoveredId={hoveredId}
                  onSelect={setSelectedId}
                  onHover={setHoveredId}
                />
              </Suspense>
            </SceneBoundary>
            {selectedId && (
              <button className="btn btn--overview" onClick={() => setSelectedId(null)}>
                🗺 Celá kolonie
              </button>
            )}
          </section>
          {detailEl}
        </main>
      )}
    </div>
  );
}
