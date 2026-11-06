import { Component, lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { useSessionDetail, useSessions, type LiveMeta } from './api.ts';
import { useNow } from './useNow.ts';
import { TopBar, type View } from './components/TopBar.tsx';
import { NeedsYouBanner } from './components/NeedsYouBanner.tsx';
import { SessionList } from './components/SessionList.tsx';
import { SessionDetailPanel } from './components/SessionDetailPanel.tsx';
import { TimeControl } from './components/TimeControl.tsx';
import { hourOf } from './scene/sky.ts';
import { useAttention } from './useAttention.ts';

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
  const [manualHour, setManualHour] = useState<number | null>(null);
  // Real clock, quantised to the minute so the scene only re-lights once a minute.
  const clockHour = Math.floor(hourOf(new Date(now)) * 60) / 60;
  const hour = manualHour ?? clockHour;
  const attention = useAttention(sessions, setSelectedId);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

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
      <TopBar
        sessions={list}
        view={view}
        onView={setView}
        live={live}
        notify={{ on: attention.notify, supported: attention.supported, set: attention.setNotify }}
      />
      {error && (
        <div className="offline">
          <strong>Bot Crossing neběží</strong> (okno terminálu se zavřelo nebo spadlo). Spusť ho znovu dvojklikem na{' '}
          <code>Bot Crossing.command</code> (Mac) / <code>Bot Crossing.bat</code> (Windows). Stránka se pak sama obnoví.
          Pokud okno terminálu ukazuje chybu, pošli mi ji.
        </div>
      )}
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
                  hour={hour}
                  onSelect={setSelectedId}
                  onHover={setHoveredId}
                />
              </Suspense>
            </SceneBoundary>
            {sessions !== null && list.length === 0 && !error && (
              <div className="stage-empty">
                <EmptyColony meta={meta} />
              </div>
            )}
            <TimeControl hour={hour} manual={manualHour !== null} onChange={setManualHour} />
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

/** Explains an empty colony: where we looked, and the common reason (sessions running in the cloud, not here). */
function EmptyColony({ meta }: { meta: LiveMeta | null }) {
  return (
    <>
      <strong>Na tomhle počítači jsem nenašel žádnou relaci Claude Code</strong>
      {meta?.lookbackDays ? ` za posledních ${meta.lookbackDays} dní` : ''}.
      <span className="stage-empty__more">
        Bot Crossing vidí jen Claude Code spuštěný <b>na tomto počítači</b> (příkaz <code>claude</code> v terminálu).
        Relace z claude.ai/code na webu nebo v mobilu běží v cloudu a sem nedorazí.
        {meta?.projectsDir && (
          <>
            {' '}Hledám v: <code>{meta.projectsDir}</code>
          </>
        )}
      </span>
    </>
  );
}
