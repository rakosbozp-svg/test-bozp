import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export type Pose = 'hammer' | 'wave' | 'scratch' | 'sit';

/** Workers are drawn larger than "real" scale, cozy-game style, so they read at a glance. */
const SCALE = 2.2;

// Shared geometry/materials: created once, reused by every worker.
const G = {
  body: new THREE.CylinderGeometry(0.055, 0.065, 0.13, 8),
  helmet: new THREE.SphereGeometry(0.06, 10, 8),
  visor: new THREE.SphereGeometry(0.045, 10, 6, -0.9, 1.8, 0.9, 0.9),
  pack: new THREE.BoxGeometry(0.07, 0.08, 0.04),
  limb: new THREE.CylinderGeometry(0.017, 0.017, 0.09, 6),
  leg: new THREE.CylinderGeometry(0.022, 0.022, 0.08, 6),
  handle: new THREE.CylinderGeometry(0.007, 0.007, 0.1, 5),
  head: new THREE.BoxGeometry(0.045, 0.025, 0.025),
  spark: new THREE.OctahedronGeometry(0.02, 0),
};
const M = {
  // A faint self-glow keeps the white helmets readable at night, from the overview camera.
  helmet: new THREE.MeshStandardMaterial({ color: '#fbf6ee', flatShading: true, roughness: 0.5, emissive: '#fff1d6', emissiveIntensity: 0.45 }),
  visor: new THREE.MeshStandardMaterial({ color: '#2b3f5c', metalness: 0.6, roughness: 0.2, emissive: '#5fb4ff', emissiveIntensity: 0.35 }),
  dark: new THREE.MeshStandardMaterial({ color: '#5b4a40', flatShading: true }),
  wood: new THREE.MeshStandardMaterial({ color: '#9a6a43', flatShading: true }),
  metal: new THREE.MeshStandardMaterial({ color: '#8d96a0', metalness: 0.7, roughness: 0.3 }),
  spark: new THREE.MeshBasicMaterial({ color: '#ffd35a', toneMapped: false }),
};
const suitCache = new Map<string, THREE.MeshStandardMaterial>();
const suit = (color: string) => {
  let m = suitCache.get(color);
  if (!m) suitCache.set(color, (m = new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.8 })));
  return m;
};

/**
 * A tiny low-poly astronaut. Positioned with its local +Z facing `rotation`.
 * Arms pivot at the shoulder; the right hand may hold a hammer.
 */
export function Worker({ pose, color, position, rotation, seed }: { pose: Pose; color: string; position: [number, number, number]; rotation: number; seed: number }) {
  const root = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const spark = useRef<THREE.Mesh>(null);
  const suitMat = useMemo(() => suit(color), [color]);
  const sitting = pose === 'sit';

  useFrame(({ clock }) => {
    const t = clock.elapsedTime + seed * 1.7;
    const r = root.current;
    if (!r || !armR.current || !armL.current || !head.current) return;
    head.current.rotation.set(0, 0, 0);
    armL.current.rotation.set(0.15, 0, 0.25);
    if (spark.current) spark.current.visible = false;

    switch (pose) {
      case 'hammer': {
        // fast down-stroke, slower lift: phase in [0,1)
        const p = (t * 1.6) % 1;
        const swing = p < 0.25 ? 1 - p / 0.25 : (p - 0.25) / 0.75; // 1 = raised, 0 = impact
        armR.current.rotation.set(-0.3 - swing * 2.2, 0, -0.15);
        r.position.y = position[1] + (p < 0.08 ? 0.01 : 0);
        armL.current.rotation.set(-0.9, 0, 0.35);
        if (spark.current) {
          spark.current.visible = p < 0.06;
          spark.current.rotation.y = t * 9;
        }
        break;
      }
      case 'wave': {
        armR.current.rotation.set(0, 0, -2.5 + Math.sin(t * 7) * 0.45);
        r.position.y = position[1] + Math.abs(Math.sin(t * 3.5)) * 0.04; // little hops
        head.current.rotation.x = -0.25;
        break;
      }
      case 'scratch': {
        armR.current.rotation.set(-0.4, 0, -2.6 + Math.sin(t * 9) * 0.12);
        head.current.rotation.z = Math.sin(t * 1.6) * 0.2;
        r.position.y = position[1];
        break;
      }
      case 'sit': {
        armR.current.rotation.set(-0.6, 0, -0.2);
        armL.current.rotation.set(-0.6, 0, 0.2);
        r.scale.setScalar(SCALE * (1 + Math.sin(t * 1.4) * 0.012)); // breathing
        r.position.y = position[1] - 0.045 * SCALE;
        head.current.rotation.x = 0.1 + Math.sin(t * 0.5) * 0.08;
        break;
      }
    }
  });

  return (
    <group ref={root} position={position} rotation-y={rotation} scale={SCALE}>
      {/* legs */}
      {[-0.028, 0.028].map((x) => (
        <mesh key={x} geometry={G.leg} material={M.dark} position={sitting ? [x, 0.055, 0.04] : [x, 0.04, 0]} rotation-x={sitting ? Math.PI / 2 : 0} castShadow />
      ))}
      <mesh geometry={G.body} material={suitMat} position-y={0.145} castShadow />
      <mesh geometry={G.pack} material={M.dark} position={[0, 0.15, -0.065]} castShadow />
      <group ref={head} position-y={0.235}>
        <mesh geometry={G.helmet} material={M.helmet} castShadow />
        <mesh geometry={G.visor} material={M.visor} position-z={0.022} />
      </group>
      {/* arms pivot at the shoulders */}
      <group ref={armL} position={[0.07, 0.195, 0]}>
        <mesh geometry={G.limb} material={suitMat} position-y={-0.045} castShadow />
      </group>
      <group ref={armR} position={[-0.07, 0.195, 0]}>
        <mesh geometry={G.limb} material={suitMat} position-y={-0.045} castShadow />
        {pose === 'hammer' && (
          <group position={[0, -0.09, 0.02]} rotation-x={Math.PI / 2}>
            <mesh geometry={G.handle} material={M.wood} position-y={0.04} />
            <mesh geometry={G.head} material={M.metal} position-y={0.09} />
            <mesh ref={spark} geometry={G.spark} material={M.spark} position={[0, 0.11, 0.03]} />
          </group>
        )}
      </group>
    </group>
  );
}
