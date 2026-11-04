import { test } from 'node:test';
import assert from 'node:assert/strict';
import { distance, key, line, ring, spiral, toWorld } from './hex.ts';
import { clusterRadius, computeLayout, type LayoutSession } from './layout.ts';

test('hex basics', () => {
  assert.equal(ring({ q: 0, r: 0 }, 1).length, 6);
  assert.equal(ring({ q: 0, r: 0 }, 3).length, 18);
  assert.equal(spiral({ q: 0, r: 0 }, 2).length, 19);
  assert.ok(ring({ q: 2, r: -1 }, 2).every((h) => distance(h, { q: 2, r: -1 }) === 2));
  const l = line({ q: 0, r: 0 }, { q: 4, r: -2 });
  assert.equal(l.length, 5);
  for (let i = 1; i < l.length; i++) assert.equal(distance(l[i - 1], l[i]), 1, 'line is contiguous');
  // neighbours are exactly sqrt(3) apart in world space
  const a = toWorld({ q: 0, r: 0 });
  const b = toWorld({ q: 0, r: 1 });
  assert.ok(Math.abs(Math.hypot(b.x - a.x, b.z - a.z) - Math.sqrt(3)) < 1e-9);
});

test('cluster radius grows with session count', () => {
  assert.deepEqual([1, 6, 7, 18, 19, 36, 37].map(clusterRadius), [1, 1, 2, 2, 3, 3, 4]);
});

const s = (id: string, project: string, startedAt: string): LayoutSession => ({
  id,
  projectPath: '/code/' + project,
  projectName: project,
  startedAt,
});

test('every session gets its own pad; same project shares a cluster', () => {
  const list = [
    s('a1', 'shop', '2026-01-01T10:00:00Z'),
    s('a2', 'shop', '2026-01-01T11:00:00Z'),
    s('b1', 'blog', '2026-01-02T10:00:00Z'),
    ...Array.from({ length: 9 }, (_, i) => s('c' + i, 'infra', `2026-01-03T10:0${i}:00Z`)),
  ];
  const L = computeLayout(list);
  assert.equal(L.buildings.length, list.length);
  assert.equal(new Set(L.buildings.map((b) => key(b))).size, list.length, 'no two buildings share a tile');
  assert.equal(L.clusters.length, 3);
  for (const b of L.buildings) {
    const c = L.clusters[b.clusterIndex];
    assert.ok(distance(b, c.center) <= c.radius, 'building sits inside its cluster');
  }
  // clusters keep a gap of at least 2 empty tiles between their buildings
  for (const b1 of L.buildings)
    for (const b2 of L.buildings)
      if (b1.clusterIndex !== b2.clusterIndex) assert.ok(distance(b1, b2) >= 3);
  // every pad and plaza is a tile on the map
  const tileKinds = new Map(L.tiles.map((t) => [key(t), t.kind]));
  for (const b of L.buildings) assert.equal(tileKinds.get(key(b)), 'pad');
  for (const c of L.clusters) assert.equal(tileKinds.get(key(c.center)), 'plaza');
  assert.ok(L.tiles.some((t) => t.kind === 'path'));
});

test('adding a newer session or project does not move existing buildings', () => {
  const base = [s('a1', 'shop', '2026-01-01T10:00:00Z'), s('b1', 'blog', '2026-01-02T10:00:00Z')];
  const before = computeLayout(base);
  const after = computeLayout([...base, s('a2', 'shop', '2026-01-05T10:00:00Z'), s('z1', 'zeta', '2026-01-06T10:00:00Z')]);
  for (const b of before.buildings) {
    const same = after.buildings.find((x) => x.sessionId === b.sessionId)!;
    assert.equal(key(same), key(b), `${b.sessionId} stayed put`);
  }
});

test('empty colony still has a hub and terrain', () => {
  const L = computeLayout([]);
  assert.equal(L.buildings.length, 0);
  assert.ok(L.tiles.some((t) => t.kind === 'hub'));
  assert.ok(L.extent >= 6);
});
