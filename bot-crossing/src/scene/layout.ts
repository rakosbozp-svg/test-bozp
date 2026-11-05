/**
 * Colony layout: where every building, path and terrain tile goes. Pure function, no three.js.
 *
 * - Hub (Bot Crossing base) sits at the origin.
 * - Each project is a cluster: a plaza tile in the middle, its sessions on the rings around it.
 * - Projects are placed oldest-first on the first free spot spiralling out from the hub, so a
 *   new project or session never moves the buildings that already exist (unless a cluster
 *   outgrows its ring).
 * - Paths run in straight hex lines from the hub to each plaza.
 */
import { distance, key, line, spiral, toWorld, type Hex } from './hex.ts';
import { hash, tileNoise } from './random.ts';

export interface LayoutSession {
  id: string;
  projectPath: string;
  projectName: string;
  startedAt?: string;
}

export type TileKind = 'ground' | 'path' | 'pad' | 'plaza' | 'hub';

export interface Tile extends Hex {
  kind: TileKind;
  x: number;
  z: number;
  /** Top surface height. */
  height: number;
  /** 0..1 stable noise, used for colour variation and decor. */
  noise: number;
}

export interface PlacedBuilding extends Hex {
  sessionId: string;
  x: number;
  z: number;
  y: number;
  clusterIndex: number;
}

export interface Cluster {
  projectPath: string;
  projectName: string;
  center: Hex;
  x: number;
  z: number;
  radius: number;
  colorIndex: number;
}

export interface Layout {
  tiles: Tile[];
  buildings: PlacedBuilding[];
  clusters: Cluster[];
  /** Radius (in tiles) of the whole map. */
  extent: number;
  /** Centre and radius (world units) of the area holding the hub and every building, for camera framing. */
  contentCenter: { x: number; z: number };
  contentRadius: number;
}

const HUB_RADIUS = 1;
const FLAT_HEIGHT = 0.3;
const MIN_EXTENT = 6;

/** Smallest ring radius whose rings (excluding the center) hold n buildings: 6, 18, 36, … */
export function clusterRadius(n: number): number {
  let r = 1;
  while (3 * r * (r + 1) < n) r++;
  return r;
}

const byStart = (a: LayoutSession, b: LayoutSession) =>
  (a.startedAt ?? '').localeCompare(b.startedAt ?? '') || a.id.localeCompare(b.id);

export function computeLayout(sessions: LayoutSession[]): Layout {
  // Group by project, sessions oldest first.
  const groups = new Map<string, LayoutSession[]>();
  for (const s of sessions) {
    const g = groups.get(s.projectPath) ?? [];
    g.push(s);
    groups.set(s.projectPath, g);
  }
  for (const g of groups.values()) g.sort(byStart);
  // Projects oldest first (by their first session).
  const projects = [...groups.entries()].sort(([pa, a], [pb, b]) => byStart(a[0], b[0]) || pa.localeCompare(pb));

  const kinds = new Map<string, TileKind>();
  const blocked = new Set<string>(); // tiles a new cluster may not overlap (clusters + their margin ring)
  const origin: Hex = { q: 0, r: 0 };
  for (const h of spiral(origin, HUB_RADIUS)) kinds.set(key(h), 'hub');
  for (const h of spiral(origin, HUB_RADIUS + 2)) blocked.add(key(h));

  const clusters: Cluster[] = [];
  const buildings: PlacedBuilding[] = [];
  let searchRadius = 4;

  projects.forEach(([projectPath, list], clusterIndex) => {
    const radius = clusterRadius(list.length);
    const fits = (c: Hex) => spiral(c, radius + 1).every((h) => !blocked.has(key(h)));
    let center: Hex | undefined;
    while (!center) {
      center = spiral(origin, searchRadius).find(fits);
      if (!center) searchRadius += 3;
    }
    for (const h of spiral(center, radius + 1)) blocked.add(key(h));
    kinds.set(key(center), 'plaza');

    const slots = spiral(center, radius).slice(1);
    list.forEach((s, i) => {
      const h = slots[i];
      kinds.set(key(h), 'pad');
      const w = toWorld(h);
      buildings.push({ ...h, ...w, y: FLAT_HEIGHT, sessionId: s.id, clusterIndex });
    });
    const w = toWorld(center);
    clusters.push({
      projectPath,
      projectName: list[0].projectName,
      center,
      ...w,
      radius,
      colorIndex: hash(projectPath),
    });
  });

  // Paths: hub → each plaza, never over pads.
  for (const c of clusters) {
    for (const h of line(origin, c.center)) {
      const k = key(h);
      if (!kinds.has(k)) kinds.set(k, 'path');
    }
  }

  let extent = MIN_EXTENT;
  for (const k of kinds.keys()) {
    const [q, r] = k.split(',').map(Number);
    extent = Math.max(extent, distance(origin, { q, r }) + 2);
  }

  const tiles: Tile[] = spiral(origin, extent).map((h) => {
    const kind = kinds.get(key(h)) ?? 'ground';
    const noise = tileNoise(h.q, h.r);
    // Ground undulates gently and rises toward the map edge, like a shallow crater.
    const edge = Math.max(0, distance(origin, h) - extent + 3) * 0.18;
    const height = kind === 'ground' ? FLAT_HEIGHT + 0.06 + noise * 0.22 + edge : FLAT_HEIGHT;
    return { ...h, ...toWorld(h), kind, height, noise };
  });

  const pts = [{ x: 0, z: 0 }, ...buildings, ...clusters];
  const xs = pts.map((p) => p.x);
  const zs = pts.map((p) => p.z);
  const contentCenter = { x: (Math.min(...xs) + Math.max(...xs)) / 2, z: (Math.min(...zs) + Math.max(...zs)) / 2 };
  const contentRadius = Math.max(3, ...pts.map((p) => Math.hypot(p.x - contentCenter.x, p.z - contentCenter.z))) + 1.5;
  return { tiles, buildings, clusters, extent, contentCenter, contentRadius };
}

