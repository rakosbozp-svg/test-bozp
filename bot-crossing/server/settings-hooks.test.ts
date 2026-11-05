import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HOOK_EVENTS, addOurHooks, buildEntry, inspect, isOurs, removeOurHooks } from './settings-hooks.ts';

const opts = { port: 4545, nodePath: 'C:\\Program Files\\nodejs\\node.exe', scriptPath: 'C:\\Users\\Šimon Rákoš\\bot-crossing\\hooks\\send-event.mjs' };
const quiet = buildEntry('quiet', opts);
const http = buildEntry('http', opts);

// A realistic user settings file with their own hooks and other keys.
const userSettings = () => ({
  model: 'opus',
  permissions: { allow: ['Bash(npm test)'] },
  hooks: {
    Stop: [{ matcher: '', hooks: [{ type: 'command', command: '~/.claude/my-stop-hook.sh' }] }],
    PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'my-guard.sh' }] }],
  },
});

test('quiet entry: absolute node + script path, forward slashes, quoted, port as argument', () => {
  assert.equal(quiet.type, 'command');
  assert.equal(quiet.command, '"C:/Program Files/nodejs/node.exe" "C:/Users/Šimon Rákoš/bot-crossing/hooks/send-event.mjs" 4545');
  assert.equal(http.url, 'http://127.0.0.1:4545/hook');
  assert.ok(isOurs(quiet) && isOurs(http));
  assert.ok(!isOurs({ type: 'command', command: 'my-guard.sh' }));
  assert.ok(!isOurs({ type: 'http', url: 'https://example.com/hook' }));
});

test('install adds every event and keeps the user’s own hooks and settings untouched', () => {
  const before = userSettings();
  const after = addOurHooks(before, quiet);
  assert.deepEqual(before, userSettings(), 'input not mutated');
  assert.equal(after.model, 'opus');
  assert.deepEqual(after.permissions, before.permissions);
  for (const e of HOOK_EVENTS) assert.ok(after.hooks[e].some((g: any) => g.hooks.some(isOurs)), e);
  assert.equal(after.hooks.Stop[0].hooks[0].command, '~/.claude/my-stop-hook.sh', 'user Stop hook still first');
  assert.equal(after.hooks.PreToolUse[0].matcher, 'Bash', 'user matcher kept');
  assert.ok(inspect(after).every((x) => x.mode === 'quiet'));
});

test('installing twice = once; switching mode replaces ours only', () => {
  const once = addOurHooks(userSettings(), quiet);
  const twice = addOurHooks(once, quiet);
  assert.deepEqual(twice, once);
  const switched = addOurHooks(once, http);
  assert.ok(inspect(switched).every((x) => x.mode === 'http'));
  assert.equal(switched.hooks.Stop.length, 2, 'user hook + one of ours, not two of ours');
});

test('uninstall restores the original settings exactly', () => {
  const original = userSettings();
  const { settings, removed } = removeOurHooks(addOurHooks(original, quiet));
  assert.equal(removed, HOOK_EVENTS.length);
  assert.deepEqual(settings, original);
});

test('uninstall on settings that had no hooks leaves no empty "hooks" key', () => {
  const { settings } = removeOurHooks(addOurHooks({ theme: 'dark' }, http));
  assert.deepEqual(settings, { theme: 'dark' });
});

test('a group mixing ours with the user’s keeps the user’s hook', () => {
  const mixed = { hooks: { Stop: [{ matcher: '', hooks: [{ type: 'command', command: 'mine.sh' }, http] }] } };
  const { settings, removed } = removeOurHooks(mixed);
  assert.equal(removed, 1);
  assert.deepEqual(settings, { hooks: { Stop: [{ matcher: '', hooks: [{ type: 'command', command: 'mine.sh' }] }] } });
});
