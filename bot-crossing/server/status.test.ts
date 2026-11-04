import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeStatus } from './status.ts';
import type { StatusSignals } from './types.ts';

const cfg = { workingWindowMs: 30_000, openToolMaxMs: 600_000, blockedStrict: false };
const NOW = 1_800_000_000_000;
const ago = (s: number) => NOW - s * 1000;
const st = (sig: Partial<StatusSignals>, c = cfg) => computeStatus({ archived: false, ...sig }, NOW, c);

test('archived wins over everything', () => {
  assert.equal(st({ archived: true, lastActivityAt: ago(1), needsYouSince: ago(1) }).status, 'shipped');
});

test('needs you beats blocked and working', () => {
  const r = st({ needsYouSince: ago(5), lastActivityAt: ago(1), lastFinishedTool: { outcome: 'error', endedAt: ago(2), name: 'Bash' } });
  assert.equal(r.status, 'needs_you');
});

test('activity within 30 s = working; 31 s = idle', () => {
  assert.equal(st({ lastActivityAt: ago(29) }).status, 'working');
  assert.equal(st({ lastActivityAt: ago(31) }).status, 'idle');
});

test('a long-running tool keeps it working, but not forever', () => {
  assert.equal(st({ lastActivityAt: ago(120), openToolSince: ago(120) }).status, 'working');
  assert.equal(st({ lastActivityAt: ago(700), openToolSince: ago(700) }).status, 'idle');
});

test('last tool failed and nothing since = blocked', () => {
  const r = st({ lastActivityAt: ago(60), lastToolStartAt: ago(62), lastFinishedTool: { outcome: 'error', endedAt: ago(60), name: 'Bash', errorText: 'exit 1' } });
  assert.equal(r.status, 'blocked');
  assert.match(r.reason, /Bash failed: exit 1/);
});

test('failure followed by another tool call is NOT blocked', () => {
  const r = st({ lastActivityAt: ago(50), lastToolStartAt: ago(50), lastFinishedTool: { outcome: 'error', endedAt: ago(55), name: 'Grep' } });
  assert.notEqual(r.status, 'blocked');
});

test('failure followed by a new prompt is NOT blocked', () => {
  const r = st({ lastActivityAt: ago(100), lastPromptAt: ago(100), lastFinishedTool: { outcome: 'error', endedAt: ago(200), name: 'Bash' } });
  assert.notEqual(r.status, 'blocked');
});

test('denied permission or Esc is not a failure', () => {
  assert.equal(st({ lastActivityAt: ago(60), lastFinishedTool: { outcome: 'rejected', endedAt: ago(60), name: 'Bash' } }).status, 'idle');
  assert.equal(st({ lastActivityAt: ago(60), lastFinishedTool: { outcome: 'interrupted', endedAt: ago(60), name: 'Bash' } }).status, 'idle');
});

test('strict mode: blocked only if the turn ended after the failure', () => {
  const strict = { ...cfg, blockedStrict: true };
  const fail = { outcome: 'error' as const, endedAt: ago(60), name: 'Bash' };
  assert.notEqual(st({ lastActivityAt: ago(60), lastFinishedTool: fail }, strict).status, 'blocked');
  assert.equal(st({ lastActivityAt: ago(58), lastTurnEndAt: ago(58), lastFinishedTool: fail }, strict).status, 'blocked');
});

test('stop failure = blocked until a new prompt', () => {
  assert.equal(st({ lastActivityAt: ago(60), stopFailureAt: ago(60) }).status, 'blocked');
  assert.notEqual(st({ lastActivityAt: ago(10), stopFailureAt: ago(60), lastPromptAt: ago(10) }).status, 'blocked');
});

test('idle kinds: your move vs quiet', () => {
  assert.equal(st({ lastActivityAt: ago(90), lastPromptAt: ago(200), lastTurnEndAt: ago(90) }).idleKind, 'your_move');
  assert.equal(st({ lastActivityAt: ago(90), lastPromptAt: ago(90) }).idleKind, 'quiet');
});
