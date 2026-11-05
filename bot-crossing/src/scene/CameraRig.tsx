import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';

const FOCUS_DISTANCE = 9;
const FOCUS_ELEVATION = THREE.MathUtils.degToRad(46);

/** Camera pose that frames everything within `radius` (world units) of `center`. */
export function overviewPose(center: { x: number; z: number }, radius: number) {
  const d = radius * 1.85 + 4;
  return { target: new THREE.Vector3(center.x, 0, center.z), position: new THREE.Vector3(center.x, d * 0.72, center.z + d * 0.7) };
}

/**
 * Smoothly flies the camera to the focused building (or back to the overview when focus is null).
 * Any user drag/zoom cancels the flight immediately.
 */
export function CameraRig({ focus, center, radius }: { focus: { x: number; z: number; y: number } | null; center: { x: number; z: number }; radius: number }) {
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;
  const camera = useThree((s) => s.camera);
  const flight = useRef<{ target: THREE.Vector3; position: THREE.Vector3 } | null>(null);
  const focusKey = focus ? `${focus.x.toFixed(2)},${focus.z.toFixed(2)}` : 'overview';

  useEffect(() => {
    if (!controls) return;
    if (!focus) {
      flight.current = overviewPose(center, radius);
      return;
    }
    const target = new THREE.Vector3(focus.x, focus.y + 0.35, focus.z);
    // keep the current compass direction, but settle at a pleasant height
    const horiz = camera.position.clone().sub(controls.target).setY(0);
    if (horiz.lengthSq() < 1e-6) horiz.set(0, 0, 1);
    horiz.normalize();
    const position = target
      .clone()
      .addScaledVector(horiz, Math.cos(FOCUS_ELEVATION) * FOCUS_DISTANCE)
      .add(new THREE.Vector3(0, Math.sin(FOCUS_ELEVATION) * FOCUS_DISTANCE, 0));
    flight.current = { target, position };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusKey, controls]);

  useEffect(() => {
    if (!controls) return;
    const cancel = () => (flight.current = null);
    controls.addEventListener('start', cancel);
    return () => controls.removeEventListener('start', cancel);
  }, [controls]);

  useFrame((_, dt) => {
    const f = flight.current;
    if (!f || !controls) return;
    const k = 1 - Math.exp(-dt * 3.2);
    controls.target.lerp(f.target, k);
    camera.position.lerp(f.position, k);
    controls.update();
    if (camera.position.distanceTo(f.position) < 0.01 && controls.target.distanceTo(f.target) < 0.01) flight.current = null;
  });

  return null;
}
