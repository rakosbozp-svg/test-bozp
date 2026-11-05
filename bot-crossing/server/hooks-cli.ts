/**
 * Hook setup for Claude Code, run by YOU (Bot Crossing never runs this on its own):
 *
 *   npm run hooks:install            quiet mode (recommended): no error messages when the dashboard is off
 *   npm run hooks:install -- --http  native http hooks: faster, but Claude Code prints
 *                                    "hook failed" while Bot Crossing isn't running
 *   npm run hooks:uninstall          removes only Bot Crossing's hooks
 *   npm run hooks:status             read-only check
 *
 * Install/uninstall show what will change, ask for confirmation, and back up settings.json first.
 */
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { claudeDir, config } from './config.ts';
import { addOurHooks, buildEntry, HOOK_EVENTS, inspect, removeOurHooks, type HookMode } from './settings-hooks.ts';

const settingsFile = path.join(claudeDir, 'settings.json');
const scriptPath = path.join(config.appRoot, 'hooks', 'send-event.mjs');

function readSettings(file: string): Record<string, any> | null {
  if (!fs.existsSync(file)) return {};
  const raw = fs.readFileSync(file, 'utf8');
  if (!raw.trim()) return {};
  try {
    const j = JSON.parse(raw);
    return j && typeof j === 'object' && !Array.isArray(j) ? j : null;
  } catch {
    return null;
  }
}

function stamp() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function writeWithBackup(next: Record<string, any>): string | null {
  let backup: string | null = null;
  if (fs.existsSync(settingsFile)) {
    backup = `${settingsFile}.bot-crossing-backup-${stamp()}`;
    fs.copyFileSync(settingsFile, backup);
  } else {
    fs.mkdirSync(path.dirname(settingsFile), { recursive: true });
  }
  const tmp = settingsFile + '.bot-crossing-tmp';
  fs.writeFileSync(tmp, JSON.stringify(next, null, 2) + '\n');
  fs.renameSync(tmp, settingsFile);
  return backup;
}

async function confirm(question: string, yes: boolean, defaultYes = false): Promise<boolean> {
  if (yes) return true;
  if (!process.stdin.isTTY) {
    console.log('(Není interaktivní terminál; pro potvrzení přidej --yes.)');
    return false;
  }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const a = (await rl.question(`${question} ${defaultYes ? '[A/n]' : '[a/N]'} `)).trim().toLowerCase();
  rl.close();
  return a === '' ? defaultYes : ['a', 'ano', 'y', 'yes'].includes(a);
}

function badJson() {
  console.log(`\n✗ ${settingsFile} není platný JSON. Nic jsem neměnil. Oprav ho, nebo nastav hooky ručně (README → Hooky).\n`);
  process.exitCode = 1;
}

export async function install(mode: HookMode, yes = false, askDefaultYes = false): Promise<boolean> {
  const current = readSettings(settingsFile);
  if (!current) return badJson(), false;
  const entry = buildEntry(mode, { port: config.port, nodePath: process.execPath, scriptPath });
  const next = addOurHooks(current, entry);
  const already = JSON.stringify(next) === JSON.stringify(current);

  console.log(`\nSoubor: ${settingsFile}`);
  if (already) {
    console.log('✓ Bot Crossing hooky už jsou nastavené přesně takhle. Není co měnit.\n');
    return true;
  }
  console.log(`Přidám Bot Crossing hooky pro ${HOOK_EVENTS.length} událostí (${mode === 'quiet' ? 'tichý režim' : 'http režim'}):`);
  console.log(`  ${entry.command ?? entry.url}`);
  console.log('Tvoje ostatní nastavení a hooky zůstanou beze změny. Před změnou udělám zálohu.');
  if (!(await confirm('Pokračovat?', yes, askDefaultYes))) {
    console.log('Nic jsem neměnil.\n');
    return false;
  }
  const backup = writeWithBackup(next);
  console.log(`✓ Hotovo.${backup ? ` Záloha: ${backup}` : ''}`);
  console.log('  Běžící relace Claude Code restartuj, aby hooky načetly.\n');
  return true;
}

export async function uninstall(yes = false): Promise<void> {
  const current = readSettings(settingsFile);
  if (!current) return badJson();
  const { settings: next, removed } = removeOurHooks(current);
  if (removed === 0) {
    console.log(`\n✓ V ${settingsFile} nejsou žádné Bot Crossing hooky. Není co odebírat.\n`);
    return;
  }
  console.log(`\nOdeberu ${removed} Bot Crossing hooků ze ${settingsFile}. Nic jiného se nezmění.`);
  if (!(await confirm('Pokračovat?', yes))) return void console.log('Nic jsem neměnil.\n');
  const backup = writeWithBackup(next);
  console.log(`✓ Odebráno.${backup ? ` Záloha: ${backup}` : ''}\n`);
}

export function installedMode(): HookMode | 'mixed' | null {
  const s = readSettings(settingsFile);
  if (!s) return null;
  const modes = new Set(inspect(s).map((x) => x.mode));
  return modes.size === 1 ? [...modes][0] : 'mixed';
}

async function status(): Promise<void> {
  console.log(`\nKontroluji (jen čtu): ${settingsFile}\n`);
  const s = readSettings(settingsFile);
  if (!s) return badJson();
  const rows = inspect(s);
  for (const r of rows) console.log(`${r.mode ? '✓' : '✗'} ${r.event.padEnd(20)} ${r.mode ? (r.mode === 'quiet' ? 'tichý' : 'http') : 'chybí'}`);
  const missing = rows.filter((r) => !r.mode).length;

  // In quiet mode, check that the node binary and script it points to still exist.
  const cmd = rows.find((r) => r.mode === 'quiet')?.target;
  if (cmd) {
    const paths = [...cmd.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    for (const p of paths) if (!fs.existsSync(p)) console.log(`\n! Cesta v hooku neexistuje: ${p}\n  Spusť znovu: npm run hooks:install`);
  }
  let running = false;
  try {
    running = (await fetch(`http://127.0.0.1:${config.port}/api/health`, { signal: AbortSignal.timeout(800) })).ok;
  } catch {
    /* not running */
  }
  console.log(missing === 0 ? '\nVšechny hooky jsou nastavené.' : `\nChybí ${missing} z ${rows.length}. Nastavíš je: npm run hooks:install`);
  console.log(running ? `Bot Crossing běží na http://127.0.0.1:${config.port}\n` : `Bot Crossing teď neběží (port ${config.port}).\n`);
}

// CLI entry (only when run directly, not when imported by setup.ts)
if (process.argv[1] && /hooks-cli\.ts$/.test(process.argv[1])) {
  const [cmd, ...flags] = process.argv.slice(2);
  const yes = flags.includes('--yes') || flags.includes('-y');
  if (cmd === 'install') await install(flags.includes('--http') ? 'http' : 'quiet', yes);
  else if (cmd === 'uninstall') await uninstall(yes);
  else await status();
}
