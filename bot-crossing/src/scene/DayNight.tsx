import { useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { SkyState } from './sky.ts';

/** Sky colour, fog, sun/moon and stars for the current hour. */
export function DayNight({ sky, extent }: { sky: SkyState; extent: number }) {
  const scene = useThree((s) => s.scene);
  const fogNear = extent * 2.6 + 10;
  const fogFar = extent * 6 + 30;

  useEffect(() => {
    const c = new THREE.Color(sky.background);
    if (scene.background instanceof THREE.Color) scene.background.copy(c);
    else scene.background = c;
    if (scene.fog instanceof THREE.Fog) {
      scene.fog.color.copy(c);
      scene.fog.near = fogNear;
      scene.fog.far = fogFar;
    } else scene.fog = new THREE.Fog(c, fogNear, fogFar);
  }, [scene, sky.background, fogNear, fogFar]);

  const dist = extent * 1.6 + 14;
  const span = extent * 1.9 + 4;
  const [dx, dy, dz] = sky.sunDir;

  return (
    <>
      <hemisphereLight color={sky.hemiSky} groundColor={sky.hemiGround} intensity={sky.hemiIntensity} />
      <ambientLight intensity={sky.ambient} />
      <directionalLight
        position={[dx * dist, dy * dist, dz * dist]}
        intensity={sky.sunIntensity}
        color={sky.sunColor}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-camera-left={-span}
        shadow-camera-right={span}
        shadow-camera-top={span}
        shadow-camera-bottom={-span}
        shadow-camera-far={dist * 3}
      />
      <Stars radius={extent * 5 + 60} opacity={Math.max(0, (sky.night - 0.35) / 0.65)} />
    </>
  );
}

/** A dome of tiny points; fades in after dusk. Procedural, nothing downloaded. */
function Stars({ radius, opacity }: { radius: number; opacity: number }) {
  const geometry = useMemo(() => {
    const n = 700;
    const pos = new Float32Array(n * 3);
    let seed = 7;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < n; i++) {
      const theta = rand() * Math.PI * 2;
      const y = 0.08 + rand() * 0.92; // upper hemisphere only
      const r = Math.sqrt(1 - y * y);
      pos.set([Math.cos(theta) * r * radius, y * radius, Math.sin(theta) * r * radius], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return g;
  }, [radius]);
  if (opacity <= 0.01) return null;
  return (
    <points geometry={geometry}>
      <pointsMaterial color="#fff6e0" size={2.2} sizeAttenuation={false} transparent opacity={opacity} fog={false} depthWrite={false} />
    </points>
  );
}
