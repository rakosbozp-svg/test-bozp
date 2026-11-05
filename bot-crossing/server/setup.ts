/**
 * First-run setup (`npm run setup`), started automatically by the double-click launchers.
 * Asks once whether to set up hooks; remembers that setup is done in .data/setup.json.
 */
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.ts';
import { install, installedMode } from './hooks-cli.ts';

console.log(`
  ───────────────────────────────────────────────
   Bot Crossing — první spuštění
  ───────────────────────────────────────────────
   Dashboard čte tvoje relace Claude Code jen pro čtení.
   Aby okamžitě viděl, když na tebe agent čeká („Potřebuje tě“),
   potřebuje v Claude Code nastavené hooky.
`);

const mode = installedMode();
if (mode === 'quiet' || mode === 'http') {
  console.log(`  ✓ Hooky už máš nastavené (${mode === 'quiet' ? 'tichý režim' : 'http režim'}).\n`);
} else {
  console.log('   Doporučuji tichý režim: když dashboard neběží, Claude Code nic nehlásí.');
  await install('quiet', false, true);
  console.log('   (Kdykoli později: npm run hooks:install  /  odebrání: npm run hooks:uninstall)\n');
}

fs.mkdirSync(config.dataDir, { recursive: true });
fs.writeFileSync(path.join(config.dataDir, 'setup.json'), JSON.stringify({ done: true, at: new Date().toISOString() }, null, 2));
