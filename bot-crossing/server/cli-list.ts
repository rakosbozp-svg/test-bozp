/** `npm run list` — print the session table in the terminal (no server needed). */
import { SessionService } from './sessions.ts';
import { config } from './config.ts';

const ICON = { needs_you: '🟡 POTŘEBUJE TĚ', blocked: '🔴 zablokováno', working: '🟢 pracuje', idle: '⚪ nečinné', shipped: '🏁 hotovo' } as const;

function ago(sec?: number): string {
  if (sec === undefined) return '?';
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.round(sec / 60)} min`;
  if (sec < 86400) return `${Math.round(sec / 3600)} h`;
  return `${Math.round(sec / 86400)} d`;
}

const service = new SessionService();
await service.refresh();
const list = service.list();
console.log(`\nČtu (jen pro čtení): ${config.projectsDir}  —  ${list.length} relací za posledních ${config.lookbackDays} dní\n`);
for (const e of service.transcripts.lastErrors) console.log(`! ${e}`);
for (const s of list) {
  console.log(`${ICON[s.status].padEnd(15)} ${ago(s.lastActivityAgoSec).padStart(7)}   [${s.projectName}]  ${s.title}`);
  console.log(`${''.padEnd(28)}${s.statusReason} · ${s.model ?? 'model ?'} · zadání ${s.counts.prompts}, nástrojů ${s.counts.tools}, chyb ${s.counts.errors}`);
}
console.log();
