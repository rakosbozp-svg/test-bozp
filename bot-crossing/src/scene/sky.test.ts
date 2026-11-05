import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatHour, hourOf, phaseOf, skyAt } from './sky.ts';

test('phases follow the clock: dawn / day / dusk / night', () => {
  assert.deepEqual([0, 4.9, 5, 7.9, 8, 12, 17.9, 18, 20.9, 21, 23.5].map(phaseOf), [
    'night', 'night', 'dawn', 'dawn', 'day', 'day', 'day', 'dusk', 'dusk', 'night', 'night',
  ]);
  assert.equal(phaseOf(24), 'night');
  assert.equal(phaseOf(-1), 'night');
});

test('noon is bright, midnight is dark; values stay in range all day', () => {
  const noon = skyAt(12);
  const midnight = skyAt(0);
  assert.ok(noon.sunIntensity > 2 && midnight.sunIntensity < noon.sunIntensity / 3, "moonlight is much dimmer than noon sun");
  assert.equal(noon.night, 0);
  assert.equal(midnight.night, 1);
  for (let h = 0; h < 24; h += 0.25) {
    const s = skyAt(h);
    assert.match(s.background, /^#[0-9a-f]{6}$/);
    assert.ok(s.night >= 0 && s.night <= 1, `night in range at ${h}`);
    assert.ok(s.sunDir[1] > 0, `light comes from above at ${h}`);
    assert.ok(Math.abs(Math.hypot(...s.sunDir) - 1) < 1e-9, 'unit vector');
  }
});

test('lighting changes smoothly (no jumps between minutes)', () => {
  for (let h = 0; h < 24; h += 1 / 60) {
    const a = skyAt(h);
    const b = skyAt(h + 1 / 60);
    assert.ok(Math.abs(a.sunIntensity - b.sunIntensity) < 0.05, `sun jump at ${formatHour(h)}`);
    assert.ok(Math.abs(a.night - b.night) < 0.03, `night jump at ${formatHour(h)}`);
    const turn = Math.hypot(...a.sunDir.map((v, i) => v - b.sunDir[i]));
    assert.ok(turn < 0.02, `light direction jumps at ${formatHour(h)}`);
  }
});

test('the sun rises in the east (−x) and sets in the west (+x)', () => {
  assert.ok(skyAt(7).sunDir[0] < 0);
  assert.ok(skyAt(17).sunDir[0] > 0);
});

test('clock helpers', () => {
  assert.equal(formatHour(17.75), '17:45');
  assert.equal(formatHour(0), '00:00');
  assert.equal(formatHour(23.999), '23:59');
  assert.equal(hourOf(new Date(2026, 0, 1, 6, 30, 0)), 6.5);
});
