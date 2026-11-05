/**
 * Day/night lighting as a pure function of the hour (0–24, fractional). No three.js here.
 * Phases: night (21–5), dawn (5–8), day (8–18), dusk (18–21).
 */
export type DayPhase = 'night' | 'dawn' | 'day' | 'dusk';

export interface SkyState {
  hour: number;
  phase: DayPhase;
  background: string;
  hemiSky: string;
  hemiGround: string;
  hemiIntensity: number;
  sunColor: string;
  sunIntensity: number;
  /** Unit vector pointing from the scene towards the sun (or the moon at night). */
  sunDir: [number, number, number];
  ambient: number;
  /** 0 = full day, 1 = full night. Drives window glow, stars, lanterns. */
  night: number;
}

interface Key {
  h: number;
  bg: string;
  sky: string;
  ground: string;
  hemi: number;
  sun: string;
  sunI: number;
  amb: number;
  night: number;
}

// Warm Mars-desert palette through the day. Evenly interpolated between keys.
const KEYS: Key[] = [
  { h: 0, bg: '#151b33', sky: '#4a5a96', ground: '#3a2c3a', hemi: 0.62, sun: '#a9bcff', sunI: 0.6, amb: 0.14, night: 1 },
  { h: 4.5, bg: '#1d2140', sky: '#4f5a92', ground: '#3c2d3c', hemi: 0.6, sun: '#aebcff', sunI: 0.55, amb: 0.14, night: 1 },
  { h: 6, bg: '#7d5f7f', sky: '#c99a9a', ground: '#6b4438', hemi: 0.7, sun: '#ff9f6e', sunI: 0.9, amb: 0.18, night: 0.55 },
  { h: 7.5, bg: '#efc09a', sky: '#ffe2c4', ground: '#b9805a', hemi: 0.95, sun: '#ffc48e', sunI: 1.7, amb: 0.22, night: 0.1 },
  { h: 9, bg: '#f3d6b3', sky: '#fff3df', ground: '#c98c5e', hemi: 1.1, sun: '#ffdcb0', sunI: 2.3, amb: 0.25, night: 0 },
  { h: 13, bg: '#f6dcbc', sky: '#fff6e8', ground: '#cf9465', hemi: 1.15, sun: '#fff0d6', sunI: 2.5, amb: 0.25, night: 0 },
  { h: 17, bg: '#f2cba0', sky: '#ffe8cc', ground: '#c4855a', hemi: 1.05, sun: '#ffcf95', sunI: 2.1, amb: 0.24, night: 0 },
  { h: 18.75, bg: '#d9837a', sky: '#f0a59a', ground: '#8e5048', hemi: 0.85, sun: '#ff8a5c', sunI: 1.3, amb: 0.2, night: 0.25 },
  { h: 20, bg: '#5a3f66', sky: '#8a6a8c', ground: '#4a3036', hemi: 0.6, sun: '#d68ab0', sunI: 0.6, amb: 0.15, night: 0.7 },
  { h: 21.5, bg: '#1e2240', sky: '#4a5890', ground: '#3a2c3a', hemi: 0.62, sun: '#a9bcff', sunI: 0.6, amb: 0.14, night: 1 },
  { h: 24, bg: '#151b33', sky: '#4a5a96', ground: '#3a2c3a', hemi: 0.62, sun: '#a9bcff', sunI: 0.6, amb: 0.14, night: 1 },
];

export const PHASE_LABEL: Record<DayPhase, string> = { night: 'Noc', dawn: 'Úsvit', day: 'Den', dusk: 'Soumrak' };
export const PHASE_ICON: Record<DayPhase, string> = { night: '🌙', dawn: '🌅', day: '☀️', dusk: '🌇' };

export function phaseOf(hour: number): DayPhase {
  const h = ((hour % 24) + 24) % 24;
  if (h >= 5 && h < 8) return 'dawn';
  if (h >= 8 && h < 18) return 'day';
  if (h >= 18 && h < 21) return 'dusk';
  return 'night';
}

const hex = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const toHex = (rgb: number[]) => '#' + rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
const mix = (a: string, b: string, t: number) => {
  const A = hex(a);
  const B = hex(b);
  return toHex(A.map((v, i) => v + (B[i] - v) * t));
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (t: number) => t * t * (3 - 2 * t);

export function skyAt(hour: number): SkyState {
  const h = ((hour % 24) + 24) % 24;
  let i = 0;
  while (i < KEYS.length - 2 && KEYS[i + 1].h <= h) i++;
  const a = KEYS[i];
  const b = KEYS[i + 1];
  const t = smooth((h - a.h) / (b.h - a.h));

  // One continuous arc over 24 h: the sun goes east → west from 6:00 to 18:00, then the
  // (dim, bluish) night light carries on and drifts back east, so shadows never jump.
  const az = (Math.PI * (h - 6)) / 12;
  const el = Math.max(0.18, Math.abs(Math.sin(az)));
  const dir: [number, number, number] = [-Math.cos(az) * Math.cos(Math.asin(el)), el, 0.45];
  const len = Math.hypot(...dir);

  return {
    hour: h,
    phase: phaseOf(h),
    background: mix(a.bg, b.bg, t),
    hemiSky: mix(a.sky, b.sky, t),
    hemiGround: mix(a.ground, b.ground, t),
    hemiIntensity: lerp(a.hemi, b.hemi, t),
    sunColor: mix(a.sun, b.sun, t),
    sunIntensity: lerp(a.sunI, b.sunI, t),
    sunDir: [dir[0] / len, dir[1] / len, dir[2] / len],
    ambient: lerp(a.amb, b.amb, t),
    night: lerp(a.night, b.night, t),
  };
}

/** Local clock time as a fractional hour, e.g. 17:45 → 17.75. */
export function hourOf(d: Date): number {
  return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
}

export function formatHour(hour: number): string {
  const h = ((hour % 24) + 24) % 24;
  const hh = Math.floor(h);
  const mm = Math.floor((h - hh) * 60);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}
