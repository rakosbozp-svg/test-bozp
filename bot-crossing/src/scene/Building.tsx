import { useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import type { SessionSummary } from '../api.ts';
import type { PlacedBuilding } from './layout.ts';
import { hash, rng } from './random.ts';
import { Worker } from './Worker.tsx';
import { crewFor } from './crew.ts';
import { METAL, PANEL, POD, POD_TRIM, STATUS_COLOR, WINDOW_DARK, WINDOW_LIT } from './palette.ts';

interface Props {
  b: PlacedBuilding;
  s: SessionSummary;
  accent: string;
  selected: boolean;
  hovered: boolean;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
  /** 0 = day, 1 = night. */
  night: number;
}

const DOME = new THREE.SphereGeometry(1, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2);

/** Deterministic "personality" of a building, from its session id. */
function shapeOf(s: SessionSummary) {
  const r = rng(hash(s.id));
  const tools = s.counts.tools;
  return {
    podR: 0.34 + r() * 0.08,
    podH: 0.26 + r() * 0.1,
    rotation: Math.floor(r() * 6) * (Math.PI / 3),
    panels: 1 + Math.floor(r() * 2),
    // Buildings grow with the amount of work done.
    modules: 1 + (tools >= 40 ? 1 : 0) + (tools >= 200 ? 1 : 0),
  };
}

export function Building({ b, s, accent, selected, hovered, onSelect, onHover, night }: Props) {
  const shape = useMemo(() => shapeOf(s), [s.id, s.counts.tools >= 40, s.counts.tools >= 200]);
  const body = useRef<THREE.Group>(null);
  const beacon = useRef<THREE.MeshStandardMaterial>(null);
  const status = s.status;
  const closed = s.live?.closed === true;
  const busy = (status === 'working' || status === 'needs_you') && !closed;
  // At night every open session keeps a cozy lamp on; working ones glow brighter.
  const glow = closed || status === 'shipped' ? 0 : busy ? 0.9 + night * 0.9 : night * 0.7;
  const lit = glow > 0.05;
  const crew = useMemo(() => crewFor(s), [s.status, s.live?.subagents, s.live?.closed, s.lastActivityAt]);
  const statusColor = STATUS_COLOR[status];
  const phase = useMemo(() => (hash(s.id) % 1000) / 160, [s.id]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime + phase;
    if (beacon.current) {
      beacon.current.emissiveIntensity =
        status === 'needs_you' ? 1.2 + Math.sin(t * 6) * 1.1 : status === 'working' ? 1.1 + Math.sin(t * 2.5) * 0.4 : status === 'blocked' ? 0.9 + Math.sin(t * 9) * 0.6 : closed ? 0.05 : 0.35;
    }
    if (body.current) {
      const k = status === 'needs_you' ? 1 + Math.max(0, Math.sin(t * 4)) * 0.06 : 1;
      body.current.scale.setScalar(k);
    }
  });

  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta > 6) return; // it was a drag (orbiting), not a click
    onSelect(s.id);
  };

  const { podR, podH } = shape;
  const domeY = 0.06 + podH;

  return (
    <group position={[b.x, b.y, b.z]}>
      <group
        rotation-y={shape.rotation}
        onClick={click}
        onPointerOver={(e) => {
          e.stopPropagation();
          onHover(s.id);
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          onHover(null);
          document.body.style.cursor = '';
        }}
      >
        {/* foundation */}
        <mesh position-y={0.03} receiveShadow castShadow>
          <cylinderGeometry args={[0.8, 0.84, 0.06, 6]} />
          <meshStandardMaterial color={POD_TRIM} flatShading roughness={0.9} />
        </mesh>

        <group ref={body}>
          {/* main pod */}
          <mesh position-y={0.06 + podH / 2} castShadow receiveShadow>
            <cylinderGeometry args={[podR, podR * 1.04, podH, 12]} />
            <meshStandardMaterial color={POD} flatShading roughness={0.7} />
          </mesh>
          <mesh position-y={domeY} scale={[podR, podR * 0.85, podR]} geometry={DOME} castShadow>
            <meshStandardMaterial color={POD} flatShading roughness={0.6} />
          </mesh>
          {/* accent stripe in the project's colour */}
          <mesh position-y={domeY - 0.02}>
            <cylinderGeometry args={[podR * 1.02, podR * 1.02, 0.045, 12]} />
            <meshStandardMaterial color={accent} flatShading roughness={0.6} />
          </mesh>
          {/* door */}
          <mesh position={[0, 0.06 + 0.11, podR * 0.97]} castShadow>
            <boxGeometry args={[0.16, 0.22, 0.06]} />
            <meshStandardMaterial color={accent} flatShading />
          </mesh>
          {/* windows: lit while the agent works */}
          {[0.9, -0.9, Math.PI].map((a) => (
            <mesh key={a} position={[Math.sin(a) * podR * 0.98, 0.06 + podH * 0.6, Math.cos(a) * podR * 0.98]} rotation-y={a}>
              <boxGeometry args={[0.11, 0.08, 0.03]} />
              <meshStandardMaterial color={lit ? WINDOW_LIT : WINDOW_DARK} emissive={lit ? WINDOW_LIT : '#000'} emissiveIntensity={glow} toneMapped={!lit} />
            </mesh>
          ))}

          {/* extra modules for busy sessions */}
          {shape.modules >= 2 && (
            <group position={[podR + 0.2, 0, -0.08]}>
              <mesh position={[-0.12, 0.13, 0]} rotation-z={Math.PI / 2} castShadow>
                <cylinderGeometry args={[0.05, 0.05, 0.2, 8]} />
                <meshStandardMaterial color={POD_TRIM} />
              </mesh>
              <mesh position-y={0.06 + 0.1} castShadow>
                <cylinderGeometry args={[0.17, 0.18, 0.2, 10]} />
                <meshStandardMaterial color={POD} flatShading />
              </mesh>
              <mesh position-y={0.26} scale={[0.17, 0.14, 0.17]} geometry={DOME} castShadow>
                <meshStandardMaterial color={accent} flatShading />
              </mesh>
            </group>
          )}
          {shape.modules >= 3 && (
            <group position={[0.05, 0, -podR - 0.18]}>
              <mesh position-y={0.06 + 0.16} castShadow>
                <boxGeometry args={[0.3, 0.32, 0.22]} />
                <meshStandardMaterial color={POD} flatShading />
              </mesh>
              <mesh position-y={0.4} castShadow>
                <boxGeometry args={[0.34, 0.04, 0.26]} />
                <meshStandardMaterial color={accent} flatShading />
              </mesh>
            </group>
          )}

          {/* antenna + status beacon */}
          <mesh position-y={domeY + podR * 0.85 + 0.12}>
            <cylinderGeometry args={[0.012, 0.012, 0.26, 5]} />
            <meshStandardMaterial color={METAL} metalness={0.6} roughness={0.4} />
          </mesh>
          <mesh position-y={domeY + podR * 0.85 + 0.27}>
            <sphereGeometry args={[0.065, 12, 8]} />
            <meshStandardMaterial ref={beacon} color={statusColor} emissive={statusColor} emissiveIntensity={0.8} toneMapped={false} />
          </mesh>
        </group>

        {/* solar panels */}
        {Array.from({ length: shape.panels }, (_, i) => (
          <group key={i} position={[-0.52, 0, -0.18 + i * 0.4]}>
            <mesh position-y={0.14}>
              <cylinderGeometry args={[0.018, 0.018, 0.2, 5]} />
              <meshStandardMaterial color={METAL} metalness={0.6} roughness={0.4} />
            </mesh>
            <mesh position-y={0.25} rotation={[0, Math.PI / 2, -0.55]} castShadow>
              <boxGeometry args={[0.34, 0.02, 0.24]} />
              <meshStandardMaterial color={PANEL} metalness={0.5} roughness={0.25} />
            </mesh>
          </group>
        ))}

        {status === 'shipped' && <Flag color={accent} />}

        {/* workers that face the building (hammering / puzzled / sitting) */}
        {crew.pose !== 'wave' &&
          crew.slots.map((a, i) => {
            const R = crew.pose === 'sit' ? 0.74 : podR + 0.24;
            return (
              <Worker
                key={i}
                pose={crew.pose}
                color={accent}
                seed={phase + i}
                position={[Math.sin(a) * R, 0.06, Math.cos(a) * R]}
                rotation={crew.pose === 'sit' ? a : a + Math.PI}
              />
            );
          })}
      </group>

      {/* waving workers face the default camera direction (+Z), not the building */}
      {crew.pose === 'wave' &&
        crew.slots.map((a, i) => (
          <Worker key={i} pose="wave" color={accent} seed={phase + i} position={[Math.sin(a) * 0.78, 0.06, Math.cos(a) * 0.78]} rotation={0} />
        ))}

      {/* warm pool of light on the pad at night (fake light: no real lamps, cheap) */}
      {glow > 0.05 && night > 0.05 && (
        <mesh rotation-x={-Math.PI / 2} position-y={0.066}>
          <circleGeometry args={[0.78, 6, Math.PI / 6]} />
          <meshBasicMaterial color="#ffb257" transparent opacity={night * (busy ? 0.32 : 0.2)} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
      )}
      {status === 'blocked' && <Smoke y={domeY + podR} seed={phase} />}
      {status === 'needs_you' && <AlertRing />}

      {(selected || hovered) && (
        <mesh rotation-x={-Math.PI / 2} position-y={0.075}>
          <ringGeometry args={[0.86, 0.96, 6, 1, Math.PI / 6]} />
          <meshBasicMaterial color={selected ? '#a4593a' : '#fff6e6'} toneMapped={false} />
        </mesh>
      )}

    </group>
  );
}

/** Victory flag for shipped (archived) sessions. */
function Flag({ color }: { color: string }) {
  const cloth = useRef<THREE.Mesh>(null);
  const geom = useMemo(() => {
    const sh = new THREE.Shape();
    sh.moveTo(0, 0);
    sh.lineTo(0.3, -0.09);
    sh.lineTo(0, -0.18);
    sh.closePath();
    return new THREE.ShapeGeometry(sh);
  }, []);
  useFrame(({ clock }) => {
    if (cloth.current) cloth.current.rotation.y = Math.sin(clock.elapsedTime * 3) * 0.35;
  });
  return (
    <group position={[0.5, 0.06, 0.38]}>
      <mesh position-y={0.4} castShadow>
        <cylinderGeometry args={[0.014, 0.014, 0.8, 5]} />
        <meshStandardMaterial color={METAL} metalness={0.5} />
      </mesh>
      <mesh ref={cloth} position-y={0.78} geometry={geom} castShadow>
        <meshStandardMaterial color={color} side={THREE.DoubleSide} flatShading />
      </mesh>
    </group>
  );
}

/** Grey puffs rising from a blocked building. */
function Smoke({ y, seed }: { y: number; seed: number }) {
  const puffs = useRef<(THREE.Mesh | null)[]>([]);
  useFrame(({ clock }) => {
    puffs.current.forEach((m, i) => {
      if (!m) return;
      const t = (clock.elapsedTime * 0.32 + i / 4 + seed) % 1;
      m.position.set(Math.sin(t * 5 + i) * 0.08, y + t * 1.3, Math.cos(t * 4 + i) * 0.06);
      m.scale.setScalar(0.1 + t * 0.22);
      (m.material as THREE.MeshStandardMaterial).opacity = 0.7 * (1 - t);
    });
  });
  return (
    <group>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} ref={(m) => void (puffs.current[i] = m)}>
          <icosahedronGeometry args={[1, 0]} />
          <meshStandardMaterial color="#6f6660" transparent depthWrite={false} flatShading />
        </mesh>
      ))}
    </group>
  );
}

/** Expanding yellow ring on the ground: "come here". */
function AlertRing() {
  const ring = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const m = ring.current;
    if (!m) return;
    const t = (clock.elapsedTime * 0.8) % 1;
    m.scale.setScalar(0.9 + t * 0.9);
    (m.material as THREE.MeshBasicMaterial).opacity = 0.85 * (1 - t);
  });
  return (
    <mesh ref={ring} rotation-x={-Math.PI / 2} position-y={0.08}>
      <ringGeometry args={[0.8, 0.95, 6, 1, Math.PI / 6]} />
      <meshBasicMaterial color={STATUS_COLOR.needs_you} transparent toneMapped={false} depthWrite={false} />
    </mesh>
  );
}
