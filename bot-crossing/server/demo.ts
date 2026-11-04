/**
 * `npm run demo` — runs Bot Crossing against a FAKE colony in bot-crossing/.data/demo/.
 * Your real ~/.claude is not read and your real archive flags are not touched.
 * One session keeps "working" (new lines every few seconds) so you can watch status change.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { advance, encodeProjectDir, fakeSession, prompt, say, tool, toolUse, toolResult, toJsonl, type FakeCtx } from './fake-transcripts.ts';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const demoRoot = path.join(appRoot, '.data', 'demo');
const claudeDir = path.join(demoRoot, 'claude');
const projects = path.join(claudeDir, 'projects');
fs.rmSync(demoRoot, { recursive: true, force: true });

const now = Date.now();
const min = 60_000;
const home = process.platform === 'win32' ? 'C:\\Users\\demo\\code' : '/Users/demo/code';
const proj = (name: string) => (process.platform === 'win32' ? `${home}\\${name}` : `${home}/${name}`);

function write(c: FakeCtx) {
  const dir = path.join(projects, encodeProjectDir(c.cwd));
  fs.mkdirSync(dir, { recursive: true });
  const f = path.join(dir, c.sessionId + '.jsonl');
  fs.writeFileSync(f, toJsonl(c));
  const t = c.t / 1000;
  fs.utimesSync(f, t, t);
  return f;
}

// 1) Working: will keep receiving tool calls below.
const live = fakeSession('demo-working-0001', proj('webshop'), now - 15_000, 'claude-opus-5-5');
prompt(live, 'Add Apple Pay to the checkout page and make the tests pass');
say(live, "I'll start by looking at the payment module.");
tool(live, 'Read', { file_path: proj('webshop') + '/src/payments/index.ts' });
tool(live, 'Grep', { pattern: 'createPaymentIntent' });
const liveFile = write(live);

// 2) Blocked: last tool failed, nothing after it.
const blocked = fakeSession('demo-blocked-0002', proj('webshop'), now - 25 * min);
prompt(blocked, 'Upgrade the database driver to v5');
tool(blocked, 'Edit', { file_path: proj('webshop') + '/package.json' });
tool(blocked, 'Bash', { command: 'npm run migrate', description: 'Run migrations' }, 'error', 'Error: connect ECONNREFUSED 127.0.0.1:5432');
write(blocked);

// 3) Idle, your move: turn finished.
const done = fakeSession('demo-idle-0003', proj('blog'), now - 50 * min, 'claude-sonnet-5-5');
prompt(done, 'Write a draft post about our hex-map dashboard');
tool(done, 'Write', { file_path: proj('blog') + '/posts/hex-colony.md' });
say(done, 'Draft is in posts/hex-colony.md. Want me to add images?', true);
write(done);

// 4) Idle, quiet: went silent mid-turn long ago.
const quiet = fakeSession('demo-quiet-0004', proj('blog'), now - 3 * 60 * min);
prompt(quiet, 'Investigate why the RSS feed is empty');
tool(quiet, 'WebFetch', { url: 'https://example.com/rss.xml' });
write(quiet);

// 5) To be archived → Shipped.
const ship = fakeSession('demo-shipped-0005', proj('infra'), now - 26 * 60 * min, 'claude-haiku-5-5');
prompt(ship, 'Rotate the staging TLS certificates');
tool(ship, 'Bash', { command: 'certbot renew', description: 'Renew certificates' });
say(ship, 'Certificates renewed and deployed.', true);
write(ship);

// 6) Long-running tool: open tool_use, last line 2 min ago → still Working.
const build = fakeSession('demo-build-0006', proj('infra'), now - 8 * min);
prompt(build, 'Build and push the Docker images');
toolUse(build, 'Bash', { command: 'docker build -t app .', description: 'Build Docker image' });
build.t = now - 2 * min;
write(build);

// 7) A fuller colony: older idle sessions, a busy one (grows extra modules), another project.
const extras: [string, string, string, number, number][] = [
  ['demo-idle-0007', 'webshop', 'Refactor the cart reducer into smaller hooks', 30 * 60 * min, 12],
  ['demo-idle-0008', 'webshop', 'Fix flaky e2e test for coupon codes', 40 * 60 * min, 45],
  ['demo-idle-0009', 'mobile-app', 'Set up push notifications for iOS', 5 * 60 * min, 8],
  ['demo-idle-0010', 'mobile-app', 'Translate onboarding screens to Czech', 20 * 60 * min, 210],
  ['demo-idle-0011', 'blog', 'Generate social preview images for posts', 70 * 60 * min, 3],
];
for (const [id, project, title, agoMs, tools] of extras) {
  const c = fakeSession(id, proj(project), now - agoMs - tools * 2000);
  prompt(c, title);
  for (let k = 0; k < tools; k++) tool(c, k % 3 ? 'Edit' : 'Read', { file_path: proj(project) + `/src/file${k}.ts` });
  say(c, 'Done — summary above.', true);
  write(c);
}

fs.mkdirSync(path.join(demoRoot, 'state'), { recursive: true });
fs.writeFileSync(path.join(demoRoot, 'state', 'state.json'), JSON.stringify({ archived: { 'demo-shipped-0005': new Date(now - 60 * min).toISOString() } }, null, 2));

// Keep the "working" session alive.
const steps: [string, Record<string, unknown>][] = [
  ['Edit', { file_path: proj('webshop') + '/src/payments/applePay.ts' }],
  ['Bash', { command: 'npm test -- payments', description: 'Run payment tests' }],
  ['Read', { file_path: proj('webshop') + '/src/checkout/Checkout.tsx' }],
  ['Edit', { file_path: proj('webshop') + '/src/checkout/Checkout.tsx' }],
];
let i = 0;
setInterval(() => {
  const c: FakeCtx = { ...live, t: Date.now(), lines: [] };
  const [name, input] = steps[i++ % steps.length];
  const id = toolUse(c, name, input);
  advance(c, 1200);
  toolResult(c, id, 'ok');
  live.lastUuid = c.lastUuid;
  fs.appendFileSync(liveFile, toJsonl(c));
}, 6000).unref();

process.env.CLAUDE_CONFIG_DIR = claudeDir;
process.env.BC_DATA_DIR = path.join(demoRoot, 'state');
console.log(`\n  DEMO MODE — fake sessions in ${demoRoot} (your real ~/.claude is not used)`);
await import('./index.ts');
