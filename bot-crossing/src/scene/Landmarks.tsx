import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Cluster } from './layout.ts';
import { toWorld } from './hex.ts';
import { METAL, PANEL, POD, POD_TRIM } from './palette.ts';

const Y = 0.3; // flat tile height

/** Bot Crossing HQ at the centre of the map. */
export function Hub({ night }: { night: number }) {
  const light = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    if (light.current) light.current.emissiveIntensity = Math.sin(clock.elapsedTime * 2) > 0.6 ? 2 : 0.2;
  });
  const pad = toWorld({ q: 1, r: 0 });
  const dish = toWorld({ q: -1, r: 1 });
  const solar = toWorld({ q: 0, r: -1 });
  return (
    <group position-y={Y}>
      {/* big dome */}
      <mesh position-y={0.12} castShadow receiveShadow>
        <cylinderGeometry args={[1.05, 1.12, 0.24, 6]} />
        <meshStandardMaterial color={POD_TRIM} flatShading />
      </mesh>
      <mesh position-y={0.24} castShadow>
        <sphereGeometry args={[0.85, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={POD} flatShading roughness={0.6} />
      </mesh>
      <mesh position-y={0.42}>
        <torusGeometry args={[0.72, 0.035, 6, 24]} />
        <meshStandardMaterial color="#a4593a" flatShading />
      </mesh>
      {/* window band: glows at night */}
      <mesh position-y={0.33}>
        <cylinderGeometry args={[0.86, 0.86, 0.06, 24, 1, true]} />
        <meshStandardMaterial color="#ffd479" emissive="#ffd479" emissiveIntensity={0.15 + night * 1.6} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
      {/* mast */}
      <mesh position-y={1.45}>
        <cylinderGeometry args={[0.025, 0.04, 1.0, 6]} />
        <meshStandardMaterial color={METAL} metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position-y={1.98}>
        <sphereGeometry args={[0.07, 10, 8]} />
        <meshStandardMaterial ref={light} color="#ff6a3d" emissive="#ff6a3d" toneMapped={false} />
      </mesh>

      {/* landing pad */}
      <group position={[pad.x, 0, pad.z]}>
        <mesh position-y={0.025} receiveShadow>
          <cylinderGeometry args={[0.62, 0.62, 0.05, 16]} />
          <meshStandardMaterial color="#d8c3a0" />
        </mesh>
        <mesh position-y={0.052} rotation-x={-Math.PI / 2}>
          <ringGeometry args={[0.42, 0.5, 16]} />
          <meshStandardMaterial color="#f4f1ea" />
        </mesh>
      </group>

      {/* radio dish */}
      <group position={[dish.x, 0, dish.z]} rotation-y={0.6}>
        <mesh position-y={0.2}>
          <cylinderGeometry args={[0.04, 0.06, 0.4, 6]} />
          <meshStandardMaterial color={METAL} metalness={0.6} />
        </mesh>
        <mesh position-y={0.48} rotation-x={-0.9} castShadow>
          <sphereGeometry args={[0.38, 14, 6, 0, Math.PI * 2, 0, Math.PI / 3.2]} />
          <meshStandardMaterial color="#f2ece2" side={THREE.DoubleSide} flatShading />
        </mesh>
      </group>

      {/* solar field */}
      <group position={[solar.x, 0, solar.z]}>
        {[-0.3, 0.3].map((dx) => (
          <mesh key={dx} position={[dx, 0.2, 0]} rotation-x={-0.5} castShadow>
            <boxGeometry args={[0.5, 0.025, 0.36]} />
            <meshStandardMaterial color={PANEL} metalness={0.5} roughness={0.25} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/** Wooden signpost on each project's plaza. */
export function ProjectSign({ c, accent, night }: { c: Cluster; accent: string; night: number }) {
  return (
    <group position={[c.x, Y, c.z]}>
      <mesh position-y={0.3} castShadow>
        <cylinderGeometry args={[0.035, 0.04, 0.6, 6]} />
        <meshStandardMaterial color="#8a5a3b" flatShading />
      </mesh>
      <mesh position-y={0.55} castShadow>
        <boxGeometry args={[0.5, 0.2, 0.04]} />
        <meshStandardMaterial color={accent} flatShading />
      </mesh>
      {/* lantern on top of the post: lights up after dusk */}
      <mesh position-y={0.69}>
        <sphereGeometry args={[0.05, 10, 8]} />
        <meshStandardMaterial color="#ffe0a0" emissive="#ffc861" emissiveIntensity={night * 2.2} toneMapped={night < 0.05} />
      </mesh>
      <mesh position-y={0.012} receiveShadow>
        <cylinderGeometry args={[0.32, 0.36, 0.025, 6]} />
        <meshStandardMaterial color="#e2cfaf" flatShading />
      </mesh>
    </group>
  );
}
