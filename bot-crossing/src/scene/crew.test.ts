import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crewFor } from './crew.ts';

const now = Date.parse('2026-11-06T12:00:00Z');
const base = { status: 'idle' as const, lastActivityAt: '2026-11-06T11:00:00Z', live: { hooks: false, subagents: 0, closed: false } };
const hoursAgo = (h: number) => new Date(now - h * 3600_000).toISOString();

test('every session still in the colony has at least one bot', () => {
  for (const status of ['working', 'needs_you', 'blocked', 'idle'] as const) {
    for (const lastActivityAt of [hoursAgo(0.1), hoursAgo(30), undefined]) {
      for (const closed of [false, true]) {
        const c = crewFor({ ...base, status, lastActivityAt, live: { ...base.live, closed } }, now);
        assert.ok(c.slots.length >= 1, `${status} closed=${closed} last=${lastActivityAt}`);
      }
    }
  }
});

test('idle: two bots while recent, one dozing bot after 6 h or when the terminal is closed', () => {
  assert.equal(crewFor({ ...base, lastActivityAt: hoursAgo(1) }, now).slots.length, 2);
  assert.equal(crewFor({ ...base, lastActivityAt: hoursAgo(30) }, now).slots.length, 1);
  assert.equal(crewFor({ ...base, live: { ...base.live, closed: true } }, now).slots.length, 1);
  assert.equal(crewFor({ ...base, live: { ...base.live, closed: true } }, now).pose, 'sit');
});

test('working adds one bot per subagent (max 3); shipped has none (flag instead)', () => {
  assert.equal(crewFor({ ...base, status: 'working', live: { ...base.live, subagents: 5 } }, now).slots.length, 5);
  assert.equal(crewFor({ ...base, status: 'working' }, now).pose, 'hammer');
  assert.equal(crewFor({ ...base, status: 'shipped' }, now).slots.length, 0);
});
