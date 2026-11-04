/** `npm run list` — print the session table in the terminal (no server needed). */
import { SessionService } from './sessions.ts';
import { config } from './config.ts';

const ICON = { needs_you: '🟡 NEEDS YOU', blocked: '🔴 blocked', working: '🟢 working', idle: '⚪ idle', shipped: '🏁 shipped' } as const;

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
console.log(`\nReading (read-only): ${config.projectsDir}  —  ${list.length} session(s), last ${config.lookbackDays} day(s)\n`);
for (const e of service.transcripts.lastErrors) console.log(`! ${e}`);
for (const s of list) {
  console.log(`${ICON[s.status].padEnd(13)} ${ago(s.lastActivityAgoSec).padStart(7)} ago  [${s.projectName}]  ${s.title}`);
  console.log(`${''.padEnd(28)}${s.statusReason} · ${s.model ?? 'model ?'} · ${s.counts.prompts} prompts, ${s.counts.tools} tools, ${s.counts.errors} errors`);
}
console.log();
