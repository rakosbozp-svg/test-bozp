import test from 'node:test';
import assert from 'node:assert/strict';
import { vzdalenostM, textVzdalenosti, ctiGps } from '../js/geo.js';

test('vzdálenost z GPS (haversine)', () => {
  // 1 úhlová minuta šířky ≈ 1 853 m (R = 6 371 km)
  assert.ok(Math.abs(vzdalenostM({ sirka: 50, delka: 14 }, { sirka: 50 + 1 / 60, delka: 14 }) - 1853.25) < 1);
  // Praha (Staroměstské nám.) – Brno (nám. Svobody) vzdušnou čarou cca 186 km
  const d = vzdalenostM({ sirka: 50.0875, delka: 14.4214 }, { sirka: 49.1951, delka: 16.6068 });
  assert.ok(d > 184000 && d < 188000, String(d));
  assert.equal(vzdalenostM({ sirka: null, delka: 14 }, { sirka: 50, delka: 14 }), null);
  assert.equal(textVzdalenosti({ sirka: 50.1452539, delka: 14.0968236 }, { sirka: 50.1452539 + 0.00124, delka: 14.0968236 }), 'Vzdušnou čarou od objektu cca 140 m (z GPS; skutečná trasa hadic bývá delší).');
});

test('čtení GPS vloženého z map', () => {
  assert.deepEqual(ctiGps('50.1452539N, 14.0968236E'), { sirka: 50.1452539, delka: 14.0968236 });
  assert.deepEqual(ctiGps('50.1452539, 14.0968236'), { sirka: 50.1452539, delka: 14.0968236 });
  assert.deepEqual(ctiGps('50,1452539N 14,0968236E'), { sirka: 50.1452539, delka: 14.0968236 });
  const dms = ctiGps('50°8\'42.914"N, 14°5\'48.565"E');
  assert.ok(Math.abs(dms.sirka - 50.1452539) < 1e-6 && Math.abs(dms.delka - 14.0968236) < 1e-6);
  const dm = ctiGps("N 50°8.71523', E 14°5.80941'");
  assert.ok(Math.abs(dm.sirka - 50.1452538) < 1e-6 && Math.abs(dm.delka - 14.0968235) < 1e-6);
  assert.deepEqual(ctiGps('E 14.0968236, N 50.1452539'), { sirka: 50.1452539, delka: 14.0968236 });
  assert.equal(ctiGps('50.1452539'), null);
  assert.equal(ctiGps('ul. Polní 12'), null);
});
