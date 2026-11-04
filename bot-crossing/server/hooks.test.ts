import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HookStore, sanitizeHook } from './hooks.ts';
import { computeStatus, mergeSignals } from './status.ts';
import type { LiveProcess, StatusSignals } from './types.ts';

const cfg = { workingWindowMs: 30_000, openToolMaxMs: 600_000, blockedStrict: false };
const SID = 'c0ffee00-1111-2222-3333-444455556666';
const base = { session_id: SID, transcript_path: '/x.jsonl', cwd: '/proj', permission_mode: 'default' };

/** Feed events at increasing times (1 s apart), like the real sequence. */
function feed(store: HookStore, t0: number, events: Record<string, unknown>[]) {
  events.forEach((e, i) => store.ingestRaw({ ...base, ...e }, t0 + i * 1000));
}
const status = (store: HookStore, now: number, proc?: LiveProcess, t: Partial<StatusSignals> = {}) =>
  computeStatus(mergeSignals({ archived: false, ...t }, store.get(SID), proc, now, cfg), now, cfg);

test('sanitize keeps only the small fields and drops prompts/inputs/messages', () => {
  const ev = sanitizeHook({ ...base, hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'rm -rf /' }, tool_use_id: 'toolu_1', prompt: 'secret' }, 5)!;
  assert.deepEqual(Object.keys(ev).filter((k) => (ev as any)[k] !== undefined).sort(), ['at', 'cwd', 'event', 'sessionId', 'toolName', 'toolUseId']);
  assert.equal(JSON.stringify(ev).includes('rm -rf'), false);
  assert.equal(sanitizeHook({ ...base, hook_event_name: 'MadeUp' }), null);
  assert.equal(sanitizeHook({ hook_event_name: 'Stop' }), null);
  assert.equal(sanitizeHook({ ...base, session_id: '../../etc', hook_event_name: 'Stop' }), null);
  assert.equal(sanitizeHook('nope'), null);
});

test('verified real sequence (2.1.318): parallel tools + permission request', () => {
  // Order observed from a real `claude -p` run: echo was allowed, ls needed permission.
  const s = new HookStore();
  const t0 = 1_000_000;
  feed(s, t0, [
    { hook_event_name: 'UserPromptSubmit', prompt: 'x' },
    { hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_use_id: 'echo' },
    { hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_use_id: 'ls' },
    { hook_event_name: 'PermissionRequest', tool_name: 'Bash' }, // no tool_use_id in the real payload
  ]);
  assert.equal(status(s, t0 + 4000).status, 'needs_you');

  // echo finishing must NOT clear the request, because ls is still waiting
  s.ingestRaw({ ...base, hook_event_name: 'PostToolUse', tool_name: 'Bash', tool_use_id: 'echo' }, t0 + 5000);
  assert.equal(status(s, t0 + 5500).status, 'needs_you');

  // you approve, ls runs and finishes → cleared, still working (turn open)
  s.ingestRaw({ ...base, hook_event_name: 'PostToolUse', tool_name: 'Bash', tool_use_id: 'ls' }, t0 + 9000);
  assert.equal(status(s, t0 + 9500).status, 'working');

  s.ingestRaw({ ...base, hook_event_name: 'Stop' }, t0 + 10_000);
  s.ingestRaw({ ...base, hook_event_name: 'SessionEnd', reason: 'other' }, t0 + 10_500);
  const r = status(s, t0 + 60_000);
  assert.equal(r.status, 'idle');
  assert.equal(r.idleKind, 'your_move');
  assert.ok(s.get(SID)!.sessionEndAt);
});

test('a request with no matching open tool is cleared by the next tool result', () => {
  const s = new HookStore();
  feed(s, 0, [{ hook_event_name: 'UserPromptSubmit' }, { hook_event_name: 'PermissionRequest', tool_name: 'Edit' }]);
  assert.equal(status(s, 2000).status, 'needs_you');
  s.ingestRaw({ ...base, hook_event_name: 'PostToolUse', tool_name: 'Edit', tool_use_id: 'e1' }, 3000);
  assert.equal(status(s, 3500).status, 'working');
});

test('Stop clears a pending request (e.g. denied in -p mode, which sends no failure event)', () => {
  const s = new HookStore();
  feed(s, 0, [
    { hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_use_id: 'a' },
    { hook_event_name: 'PermissionRequest', tool_name: 'Bash' },
    { hook_event_name: 'Stop' },
  ]);
  assert.notEqual(status(s, 100_000).status, 'needs_you');
});

test('idle_prompt notification is NOT needs you; permission_prompt is', () => {
  const s = new HookStore();
  feed(s, 0, [{ hook_event_name: 'Stop' }, { hook_event_name: 'Notification', notification_type: 'idle_prompt' }]);
  assert.equal(status(s, 120_000).status, 'idle');
  s.ingestRaw({ ...base, hook_event_name: 'Notification', notification_type: 'permission_prompt' }, 121_000);
  assert.equal(status(s, 122_000).status, 'needs_you');
});

test('registry: "busy" after the request means you answered it (no hook for "granted")', () => {
  const s = new HookStore();
  feed(s, 0, [
    { hook_event_name: 'UserPromptSubmit' },
    { hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_use_id: 'build' },
    { hook_event_name: 'PermissionRequest', tool_name: 'Bash' },
  ]);
  const waiting: LiveProcess = { pid: 1, alive: true, status: 'waiting', waitingFor: 'permission', statusUpdatedAt: 2100 };
  assert.equal(status(s, 3000, waiting).status, 'needs_you');
  // long build approved and running for 5 minutes: registry says busy since 2500
  const busy: LiveProcess = { pid: 1, alive: true, status: 'busy', statusUpdatedAt: 2500 };
  const r = status(s, 300_000, busy);
  assert.equal(r.status, 'working');
});

test('registry alone (no hooks): waiting = needs you, busy = working, idle = idle', () => {
  const s = new HookStore();
  const now = 1_000_000;
  const t = { lastActivityAt: now - 120_000 };
  assert.equal(status(s, now, { pid: 1, alive: true, status: 'waiting', waitingFor: 'input needed', statusUpdatedAt: now - 5000 }, t).status, 'needs_you');
  assert.equal(status(s, now, { pid: 1, alive: true, status: 'busy', statusUpdatedAt: now - 90_000 }, t).status, 'working');
  assert.equal(status(s, now, { pid: 1, alive: true, status: 'idle' }, { ...t, openToolSince: now - 60_000 }).status, 'idle');
  // a dead process is ignored
  assert.equal(status(s, now, { pid: 1, alive: false, status: 'busy' }, t).status, 'idle');
});

test('a tool failure while the turn is still running is not Blocked yet', () => {
  const s = new HookStore();
  feed(s, 0, [
    { hook_event_name: 'UserPromptSubmit' },
    { hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_use_id: 'a' },
    { hook_event_name: 'PostToolUseFailure', tool_name: 'Bash', tool_use_id: 'a', error: 'exit 1' },
  ]);
  assert.equal(status(s, 2500).status, 'working');
  s.ingestRaw({ ...base, hook_event_name: 'Stop' }, 3000);
  assert.equal(status(s, 60_000).status, 'blocked');
  // an interrupt (Esc) is never a failure
  const s2 = new HookStore();
  feed(s2, 0, [
    { hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_use_id: 'a' },
    { hook_event_name: 'PostToolUseFailure', tool_name: 'Bash', tool_use_id: 'a', is_interrupt: true },
    { hook_event_name: 'Stop' },
  ]);
  assert.equal(status(s2, 60_000).status, 'idle');
});

test('StopFailure = blocked until the next prompt; subagents are counted', () => {
  const s = new HookStore();
  feed(s, 0, [
    { hook_event_name: 'SubagentStart', agent_id: 'a1' },
    { hook_event_name: 'SubagentStart', agent_id: 'a2' },
    { hook_event_name: 'SubagentStop', agent_id: 'a1' },
    { hook_event_name: 'StopFailure' },
  ]);
  assert.equal(s.get(SID)!.subagents.size, 1);
  assert.equal(status(s, 60_000).status, 'blocked');
  s.ingestRaw({ ...base, hook_event_name: 'UserPromptSubmit' }, 61_000);
  assert.equal(status(s, 62_000).status, 'working');
});
