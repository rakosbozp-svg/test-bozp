import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { Tile } from './layout.ts';
import { BASE_PLATE, ROCK, TERRAIN } from './palette.ts';

const TILE_RADIUS = 0.97; // tiny gaps make the board read as hex tiles

/** All hex tiles in a single instanced mesh (one draw call). */
export function Terrain({ tiles, extent }: { tiles: Tile[]; extent: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(() => {
    const g = new THREE.CylinderGeometry(TILE_RADIUS, TILE_RADIUS, 1, 6);
    g.translate(0, 0.5, 0); // base at y=0, so scale.y = height
    return g;
  }, []);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const c = new THREE.Color();
    tiles.forEach((t, i) => {
      m.compose(new THREE.Vector3(t.x, 0, t.z), new THREE.Quaternion(), new THREE.Vector3(1, t.height, 1));
      mesh.setMatrixAt(i, m);
      const shades = TERRAIN[t.kind];
      c.set(shades[Math.floor(t.noise * shades.length)]);
      mesh.setColorAt(i, c);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [tiles]);

  return (
    <group>
      <instancedMesh ref={ref} args={[geometry, undefined, tiles.length]} receiveShadow castShadow>
        <meshStandardMaterial flatShading roughness={0.95} />
      </instancedMesh>
      {/* the dark plate the tiles sit on, visible through the gaps */}
      <mesh rotation-x={-Math.PI / 2} position-y={0.01} receiveShadow>
        <circleGeometry args={[(extent + 1.5) * 1.75, 6]} />
        <meshStandardMaterial color={BASE_PLATE} roughness={1} />
      </mesh>
    </group>
  );
}

/** Scattered rocks on empty ground, also instanced. */
export function Rocks({ tiles }: { tiles: Tile[] }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const spots = useMemo(() => tiles.filter((t) => t.kind === 'ground' && t.noise > 0.86), [tiles]);
  const geometry = useMemo(() => new THREE.DodecahedronGeometry(0.22, 0), []);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const c = new THREE.Color();
    spots.forEach((t, i) => {
      const k = (t.noise - 0.86) / 0.14; // 0..1
      const s = 0.6 + k * 1.1;
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(k * 2, k * 7, k * 3));
      m.compose(new THREE.Vector3(t.x + (k - 0.5) * 0.6, t.height + 0.08 * s, t.z + (0.5 - k) * 0.5), q, new THREE.Vector3(s, s * 0.75, s));
      mesh.setMatrixAt(i, m);
      c.set(ROCK[i % ROCK.length]);
      mesh.setColorAt(i, c);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [spots]);

  if (spots.length === 0) return null;
  return (
    <instancedMesh ref={ref} args={[geometry, undefined, spots.length]} castShadow receiveShadow>
      <meshStandardMaterial flatShading roughness={1} />
    </instancedMesh>
  );
}

/** Little lamp posts along the paths; bulbs light up after dusk. Two instanced meshes. */
export function PathLamps({ tiles, night }: { tiles: Tile[]; night: number }) {
  const posts = useRef<THREE.InstancedMesh>(null);
  const bulbs = useRef<THREE.InstancedMesh>(null);
  const spots = useMemo(() => tiles.filter((t) => t.kind === 'path' && t.noise < 0.55), [tiles]);
  const postGeo = useMemo(() => new THREE.CylinderGeometry(0.018, 0.024, 0.42, 5).translate(0, 0.21, 0), []);
  const bulbGeo = useMemo(() => new THREE.SphereGeometry(0.05, 8, 6), []);

  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    spots.forEach((t, i) => {
      // stand near a tile corner so lamps don't sit in the middle of the path
      const a = Math.floor(t.noise * 6) * (Math.PI / 3) + Math.PI / 6;
      const x = t.x + Math.sin(a) * 0.62;
      const z = t.z + Math.cos(a) * 0.62;
      m.makeTranslation(x, t.height, z);
      posts.current?.setMatrixAt(i, m);
      m.makeTranslation(x, t.height + 0.46, z);
      bulbs.current?.setMatrixAt(i, m);
    });
    for (const mesh of [posts.current, bulbs.current]) {
      if (!mesh) continue;
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
  }, [spots]);

  if (spots.length === 0) return null;
  return (
    <group>
      <instancedMesh ref={posts} args={[postGeo, undefined, spots.length]} castShadow>
        <meshStandardMaterial color="#6d5244" flatShading />
      </instancedMesh>
      <instancedMesh ref={bulbs} args={[bulbGeo, undefined, spots.length]}>
        <meshStandardMaterial color="#fff1cf" emissive="#ffc45e" emissiveIntensity={0.05 + night * 2.6} toneMapped={night < 0.05} />
      </instancedMesh>
    </group>
  );
}
