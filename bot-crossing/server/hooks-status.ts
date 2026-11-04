/**
 * `npm run hooks:status` — READ-ONLY check of which Bot Crossing hooks are in your Claude Code
 * settings. Never writes anything.
 */
import fs from 'node:fs';
import path from 'node:path';
import { claudeDir, config } from './config.ts';

const wanted = Object.keys(JSON.parse(fs.readFileSync(path.join(config.appRoot, 'hooks', 'bot-crossing-hooks.json'), 'utf8')).hooks);
const files = [path.join(claudeDir, 'settings.json'), path.join(claudeDir, 'settings.local.json')];

const found = new Map<string, string[]>();
for (const f of files) {
  let j: any;
  try {
    j = JSON.parse(fs.readFileSync(f, 'utf8'));
  } catch {
    continue;
  }
  for (const [event, groups] of Object.entries<any>(j.hooks ?? {})) {
    for (const g of Array.isArray(groups) ? groups : []) {
      for (const h of Array.isArray(g?.hooks) ? g.hooks : []) {
        const target = String(h?.url ?? h?.command ?? '');
        if (target.includes('/hook') && (target.includes('127.0.0.1') || target.includes('localhost')) || target.includes('send-event.mjs')) {
          found.set(event, [...(found.get(event) ?? []), `${path.basename(f)}: ${target}`]);
        }
      }
    }
  }
}

console.log(`\nKontroluji (jen čtu): ${files.join(', ')}\n`);
let missing = 0;
for (const e of wanted) {
  const where = found.get(e);
  if (!where) missing++;
  console.log(`${where ? '✓' : '✗'} ${e.padEnd(20)} ${where ? where.join('; ') : 'chybí'}`);
}
console.log(missing === 0 ? '\nVšechny hooky jsou nastavené.\n' : `\nChybí ${missing} z ${wanted.length}. Návod: README.md → „Hooky“.\n`);
