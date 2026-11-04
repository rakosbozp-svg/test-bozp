import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { TranscriptStore, promptTitle, summarizeToolInput, projectNameOf } from './transcripts.ts';
import { titleOf, resumeCommand } from './sessions.ts';
import { advance, attachment, encodeProjectDir, fakeSession, prompt, say, tool, toolResult, toolUse, toJsonl } from './fake-transcripts.ts';

let root: string;
let projects: string;

function writeSession(cwd: string, id: string, body: string) {
  const dir = path.join(projects, encodeProjectDir(cwd));
  fs.mkdirSync(dir, { recursive: true });
  const f = path.join(dir, id + '.jsonl');
  fs.writeFileSync(f, body);
  return f;
}

before(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'bc-test-'));
  projects = path.join(root, 'projects');
});
after(() => fs.rmSync(root, { recursive: true, force: true }));

test('parses a full session: title, model, tools, outcomes, turn end', async () => {
  const c = fakeSession('s-full', '/Users/alice/code/shop', Date.now() - 600_000, 'claude-opus-5-5');
  prompt(c, '  Fix the   checkout bug\nwhere totals are wrong ');
  attachment(c);
  advance(c, 2000);
  say(c, 'Looking into it.');
  tool(c, 'Read', { file_path: '/Users/alice/code/shop/src/cart.ts' });
  tool(c, 'Bash', { command: 'npm test', description: 'Run tests' }, 'error', 'Exit code 1\n2 failing');
  tool(c, 'Edit', { file_path: '/Users/alice/code/shop/src/cart.ts' }, 'rejected');
  tool(c, 'Bash', { command: 'rm -rf dist' }, 'interrupted');
  say(c, 'Fixed.', true);
  const f = writeSession(c.cwd, 's-full', toJsonl(c));
  const before = fs.statSync(f);

  const store = new TranscriptStore(projects, 7);
  await store.refresh();
  const s = store.get('s-full')!;
  assert.ok(s);
  assert.equal(s.cwd, '/Users/alice/code/shop');
  assert.equal(projectNameOf(s), 'shop');
  assert.equal(s.model, 'claude-opus-5-5');
  assert.equal(titleOf(s), 'Fix the checkout bug where totals are wrong');
  assert.deepEqual(s.counts, { prompts: 1, tools: 4, errors: 1 });
  assert.deepEqual(s.recentTools.map((t) => [t.name, t.outcome]), [
    ['Read', 'ok'],
    ['Bash', 'error'],
    ['Edit', 'rejected'],
    ['Bash', 'interrupted'],
  ]);
  assert.equal(s.recentTools[0].summary, 'cart.ts');
  assert.equal(s.recentTools[1].summary, 'Run tests');
  assert.match(s.recentTools[1].errorText!, /Exit code 1/);
  assert.equal(s.pending.size, 0);
  assert.ok(s.lastTurnEndAt! >= s.lastPromptAt!);
  assert.equal(s.messages.at(-1)!.text, 'Fixed.');

  // read-only: file untouched
  const afterStat = fs.statSync(f);
  assert.equal(afterStat.size, before.size);
  assert.equal(afterStat.mtimeMs, before.mtimeMs);
});

test('incremental: a half-written line is held back, then completed', async () => {
  const c = fakeSession('s-inc', '/tmp/inc', Date.now() - 60_000);
  prompt(c, 'First prompt');
  const id = toolUse(c, 'Bash', { command: 'sleep 100' });
  const f = writeSession(c.cwd, 's-inc', toJsonl(c));

  const store = new TranscriptStore(projects, 7);
  await store.refresh();
  assert.equal(store.get('s-inc')!.pending.size, 1, 'tool is open');

  const c2 = { ...c, lines: [] as object[] };
  toolResult(c2, id, 'ok');
  const line = JSON.stringify(c2.lines[0]);
  fs.appendFileSync(f, line.slice(0, 40)); // partial write
  await store.refresh();
  assert.equal(store.get('s-inc')!.pending.size, 1, 'partial line ignored');

  fs.appendFileSync(f, line.slice(40) + '\n');
  await store.refresh();
  const s = store.get('s-inc')!;
  assert.equal(s.pending.size, 0);
  assert.equal(s.lastFinishedTool!.outcome, 'ok');
});

test('multi-byte characters across the 1 MiB chunk boundary survive', async () => {
  const c = fakeSession('s-utf8', '/tmp/utf8', Date.now() - 60_000);
  prompt(c, 'Žluťoučký kůň úpěl ďábelské ódy');
  for (let i = 0; i < 1200; i++) say(c, 'čřžýáíé'.repeat(60) + i);
  writeSession(c.cwd, 's-utf8', toJsonl(c));
  const store = new TranscriptStore(projects, 7);
  await store.refresh();
  const s = store.get('s-utf8')!;
  assert.equal(titleOf(s), 'Žluťoučký kůň úpěl ďábelské ódy');
  assert.ok(s.messages.every((m) => !m.text.includes('\uFFFD')), 'no replacement chars');
  assert.ok(s.messages.at(-1)!.text.endsWith('1199'));
});

test('corrupt lines, sidechain records and system prompts are skipped', async () => {
  const c = fakeSession('s-noise', '/tmp/noise', Date.now() - 60_000);
  const body =
    'not json at all\n' +
    JSON.stringify({ type: 'user', isSidechain: true, sessionId: 's-noise', cwd: '/tmp/noise', timestamp: new Date().toISOString(), message: { role: 'user', content: 'subagent task' } }) +
    '\n' +
    JSON.stringify({ type: 'user', isMeta: true, sessionId: 's-noise', cwd: '/tmp/noise', timestamp: new Date().toISOString(), message: { role: 'user', content: 'meta' } }) +
    '\n' +
    JSON.stringify({ type: 'something-new', foo: 1 }) +
    '\n';
  prompt(c, '<local-command-stdout>hi</local-command-stdout>');
  prompt(c, 'The real prompt');
  writeSession(c.cwd, 's-noise', body + toJsonl(c));
  const store = new TranscriptStore(projects, 7);
  await store.refresh();
  const s = store.get('s-noise')!;
  assert.equal(titleOf(s), 'The real prompt');
  assert.equal(s.counts.prompts, 1);
});

test('custom title wins; old files are outside the lookback window', async () => {
  const c = fakeSession('s-title', '/tmp/title', Date.now() - 60_000);
  prompt(c, 'something long');
  c.lines.push({ type: 'custom-title', customTitle: 'My renamed session', sessionId: 's-title' });
  writeSession(c.cwd, 's-title', toJsonl(c));

  const old = fakeSession('s-old', '/tmp/old', Date.now() - 30 * 86_400_000);
  prompt(old, 'ancient');
  const f = writeSession(old.cwd, 's-old', toJsonl(old));
  const t = (Date.now() - 30 * 86_400_000) / 1000;
  fs.utimesSync(f, t, t);

  const store = new TranscriptStore(projects, 7);
  await store.refresh();
  assert.equal(titleOf(store.get('s-title')!), 'My renamed session');
  assert.equal(store.get('s-old'), undefined);
});

test('Windows paths: project name and resume command', async () => {
  const c = fakeSession('s-win', 'C:\\Users\\bob\\projects\\api', Date.now() - 60_000);
  prompt(c, 'hello');
  writeSession(c.cwd, 's-win', toJsonl(c));
  const store = new TranscriptStore(projects, 7);
  await store.refresh();
  const s = store.get('s-win')!;
  assert.equal(projectNameOf(s), 'api');
  assert.equal(resumeCommand(s, 'win32'), 'cd "C:\\Users\\bob\\projects\\api"; claude --resume s-win');
  assert.equal(resumeCommand(s, 'darwin'), 'cd "C:\\Users\\bob\\projects\\api" && claude --resume s-win');
});

test('helpers: prompt titles and tool summaries', () => {
  assert.equal(promptTitle('<command-name>/review</command-name><command-args>PR 12</command-args>'), '/review PR 12');
  assert.equal(promptTitle('<system-reminder>x</system-reminder>'), undefined);
  assert.equal(promptTitle('[Request interrupted by user]'), undefined);
  assert.equal(summarizeToolInput('Grep', { pattern: 'TODO' }), 'TODO');
  assert.equal(summarizeToolInput('Write', { file_path: 'C:\\a\\b\\c.txt' }), 'c.txt');
  assert.equal(summarizeToolInput('mcp__x__y', { query: 'q' }), 'q');
});
