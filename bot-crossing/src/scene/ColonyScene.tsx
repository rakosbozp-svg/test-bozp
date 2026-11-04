import { useMemo, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { SessionSummary } from '../api.ts';
import { computeLayout } from './layout.ts';
import { Terrain, Rocks } from './Terrain.tsx';
import { Building } from './Building.tsx';
import { Hub, ProjectSign } from './Landmarks.tsx';
import { CameraRig, overviewPose } from './CameraRig.tsx';
import { PROJECT_ACCENTS, SKY } from './palette.ts';
import { LabelProjector, type Anchor } from './Labels.tsx';
import { STATUS_LABEL } from '../format.ts';

interface Props {
  sessions: SessionSummary[];
  selectedId: string | null;
  hoveredId: string | null;
  onSelect: (id: string | null) => void;
  onHover: (id: string | null) => void;
}

export default function ColonyScene({ sessions, selectedId, hoveredId, onSelect, onHover }: Props) {
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
  const shadowSpan = layout.extent * 1.9 + 4;
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
        <color attach="background" args={[SKY]} />
        <fog attach="fog" args={[SKY, layout.extent * 2.6 + 10, layout.extent * 6 + 30]} />

        <hemisphereLight args={['#fff3df', '#c98c5e', 1.1]} />
        <ambientLight intensity={0.25} />
        <directionalLight
          position={[layout.extent * 0.8 + 6, layout.extent * 1.3 + 10, layout.extent * 0.6 + 4]}
          intensity={2.3}
          color="#ffdcb0"
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-bias={-0.0004}
          shadow-camera-left={-shadowSpan}
          shadow-camera-right={shadowSpan}
          shadow-camera-top={shadowSpan}
          shadow-camera-bottom={-shadowSpan}
          shadow-camera-far={layout.extent * 6 + 60}
        />

        <Terrain tiles={layout.tiles} extent={layout.extent} />
        <Rocks tiles={layout.tiles} />
        <Hub />

        {layout.clusters.map((c) => (
          <ProjectSign key={c.projectPath} c={c} accent={accentOf(c.colorIndex)} />
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
