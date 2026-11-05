import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

export interface Anchor {
  id: string;
  x: number;
  y: number;
  z: number;
}

/**
 * Lightweight HTML labels over the canvas. Labels are ordinary DOM elements rendered next to the
 * <Canvas>; this component (inside the Canvas) moves them every frame by projecting their 3D anchor
 * with the camera. No extra React roots, no re-renders while the camera moves.
 */
export function LabelProjector({ anchors, elements }: { anchors: Anchor[]; elements: Map<string, HTMLElement> }) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const v = new THREE.Vector3();

  useFrame(() => {
    for (const a of anchors) {
      const el = elements.get(a.id);
      if (!el) continue;
      v.set(a.x, a.y, a.z).project(camera);
      const behind = v.z > 1;
      el.style.visibility = behind ? 'hidden' : '';
      if (behind) continue;
      const x = ((v.x + 1) / 2) * size.width;
      const y = ((1 - v.y) / 2) * size.height;
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -100%)`;
    }
  });
  return null;
}
