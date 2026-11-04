/** Axial hex coordinates (pointy-top in the XZ plane). Pure math, no three.js. */
export interface Hex {
  q: number;
  r: number;
}

export const HEX_SIZE = 1;
const SQRT3 = Math.sqrt(3);
const DIRS: Hex[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];

export const key = (h: Hex) => `${h.q},${h.r}`;
export const add = (a: Hex, b: Hex): Hex => ({ q: a.q + b.q, r: a.r + b.r });
const scale = (a: Hex, k: number): Hex => ({ q: a.q * k, r: a.r * k });

export function distance(a: Hex, b: Hex): number {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  return (Math.abs(dq) + Math.abs(dq + dr) + Math.abs(dr)) / 2;
}

/** All hexes exactly `radius` steps from center (6*radius of them). */
export function ring(center: Hex, radius: number): Hex[] {
  if (radius === 0) return [center];
  const out: Hex[] = [];
  let h = add(center, scale(DIRS[4], radius));
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < radius; j++) {
      out.push(h);
      h = add(h, DIRS[i]);
    }
  }
  return out;
}

/** Center, then ring 1, ring 2 … up to radius. */
export function spiral(center: Hex, radius: number): Hex[] {
  const out: Hex[] = [center];
  for (let k = 1; k <= radius; k++) out.push(...ring(center, k));
  return out;
}

function cubeRound(q: number, r: number): Hex {
  const s = -q - r;
  let rq = Math.round(q);
  let rr = Math.round(r);
  const rs = Math.round(s);
  const dq = Math.abs(rq - q);
  const dr = Math.abs(rr - r);
  const ds = Math.abs(rs - s);
  if (dq > dr && dq > ds) rq = -rr - rs;
  else if (dr > ds) rr = -rq - rs;
  return { q: rq + 0, r: rr + 0 }; // +0 turns -0 into 0
}

/** Hexes on the straight line from a to b, inclusive. */
export function line(a: Hex, b: Hex): Hex[] {
  const n = distance(a, b);
  const out: Hex[] = [];
  for (let i = 0; i <= n; i++) {
    const t = n === 0 ? 0 : i / n;
    // tiny nudge avoids ambiguous rounding exactly on hex edges
    out.push(cubeRound(a.q + (b.q - a.q) * t + 1e-6, a.r + (b.r - a.r) * t + 1e-6));
  }
  return out;
}

export function toWorld(h: Hex, size = HEX_SIZE): { x: number; z: number } {
  return { x: size * SQRT3 * (h.q + h.r / 2), z: size * 1.5 * h.r };
}
