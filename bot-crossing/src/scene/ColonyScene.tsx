import { useMemo, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { SessionSummary } from '../api.ts';
import { computeLayout } from './layout.ts';
import { Terrain, Rocks, PathLamps } from './Terrain.tsx';
import { Building } from './Building.tsx';
import { Hub, ProjectSign } from './Landmarks.tsx';
import { CameraRig, overviewPose } from './CameraRig.tsx';
import { PROJECT_ACCENTS } from './palette.ts';
import { DayNight } from './DayNight.tsx';
import { skyAt } from './sky.ts';
import { LabelProjector, type Anchor } from './Labels.tsx';
import { STATUS_LABEL } from '../format.ts';

interface Props {
  sessions: SessionSummary[];
  selectedId: string | null;
  hoveredId: string | null;
  /** Hour of day (0–24) for lighting. */
  hour: number;
  onSelect: (id: string | null) => void;
  onHover: (id: string | null) => void;
}

export default function ColonyScene({ sessions, selectedId, hoveredId, hour, onSelect, onHover }: Props) {
  const sky = useMemo(() => skyAt(hour), [hour]);
  // Re-layout only when the set of sessions/projects changes, not on every status poll.
  const layoutKey = sessions.map((s) => `${s.id}|${s.projectPath}|${s.startedAt ?? ''}`).sort().join('\n');
  const layout = useMemo(
    () => computeLayout(sessions.map((s) => ({ id: s.id, projectPath: s.projectPath, projectName: s.projectName, startedAt: s.startedAt }))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [layoutKey],
  );
  const byId = useMemo(() => new Map(sessions.map((s) => [s.id, s])), [sessions]);
  const accentOf = (colorIndex: number) => PROJECT_ACCENTS[colorIndex % PROJECT_ACCENTS.length];
  const focus = layout.buildings.find((b) => b.sessionId === selectedId) ?? null;
  const pose = useMemo(() => overviewPose(layout.contentCenter, layout.contentRadius), [layout]);
  const activeProject = selectedId ? byId.get(selectedId)?.projectPath : undefined;

  const labelEls = useRef(new Map<string, HTMLElement>()).current;
  const register = (id: string) => (el: HTMLElement | null) => {
    if (el) labelEls.set(id, el);
    else labelEls.delete(id);
  };
  const anchors = useMemo<Anchor[]>(
    () => [
      ...layout.clusters.map((c) => ({ id: 'p:' + c.projectPath, x: c.x, y: 1.3, z: c.z })),
      ...layout.buildings.map((b) => ({ id: 'b:' + b.sessionId, x: b.x, y: b.y + 1.08, z: b.z })),
    ],
    [layout],
  );

  return (
    <div className="stage-wrap">
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: pose.position.toArray(), fov: 38, near: 0.1, far: 500 }}
        onPointerMissed={() => onSelect(null)}
      >
        <DayNight sky={sky} extent={layout.extent} />

        <Terrain tiles={layout.tiles} extent={layout.extent} />
        <Rocks tiles={layout.tiles} />
        <Hub night={sky.night} />
        <PathLamps tiles={layout.tiles} night={sky.night} />

        {layout.clusters.map((c) => (
          <ProjectSign key={c.projectPath} c={c} accent={accentOf(c.colorIndex)} night={sky.night} />
        ))}

        {layout.buildings.map((b) => {
          const s = byId.get(b.sessionId);
          if (!s) return null;
          return (
            <Building
              key={b.sessionId}
              b={b}
              s={s}
              accent={accentOf(layout.clusters[b.clusterIndex].colorIndex)}
              selected={b.sessionId === selectedId}
              hovered={b.sessionId === hoveredId}
              onSelect={onSelect}
              onHover={onHover}
              night={sky.night}
            />
          );
        })}

        <OrbitControls
          makeDefault
          enableDamping
          dampingFactor={0.08}
          maxPolarAngle={Math.PI * 0.43}
          minDistance={3}
          maxDistance={layout.extent * 4 + 25}
          screenSpacePanning={false}
        target={pose.target}
        />
        <CameraRig focus={focus} center={layout.contentCenter} radius={layout.contentRadius} />
        <LabelProjector anchors={anchors} elements={labelEls} />
      </Canvas>

      <div className="labels" aria-hidden>
        {layout.clusters.map((c) => (
          <div
            key={c.projectPath}
            ref={register('p:' + c.projectPath)}
            className={`label sign ${c.projectPath === activeProject ? 'is-active' : ''}`}
            style={{ borderColor: accentOf(c.colorIndex) }}
          >
            {c.projectName}
          </div>
        ))}
        {layout.buildings.map((b) => {
          const s = byId.get(b.sessionId);
          if (!s) return null;
          const shown = b.sessionId === hoveredId || b.sessionId === selectedId || s.status === 'needs_you';
          return (
            <div
              key={b.sessionId}
              ref={register('b:' + b.sessionId)}
              className={`label bubble bubble--${s.status} ${b.sessionId === selectedId ? 'is-selected' : ''} ${shown ? '' : 'is-hidden'}`}
            >
              {s.status === 'needs_you' && <strong>🙋 Potřebuje tě · </strong>}
              <span>{s.title}</span>
              {s.status !== 'needs_you' && <em>{STATUS_LABEL[s.status]}</em>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
