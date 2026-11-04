/**
 * Optional, read-only: ~/.claude/sessions/<pid>.json is Claude Code's (undocumented) list of
 * running CLI processes. If it's missing or its format changes, we simply return nothing.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { LiveProcess } from './types.ts';

function pidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0); // signal 0 = existence check only, works on Windows and macOS
    return true;
  } catch (e: any) {
    return e?.code === 'EPERM'; // exists but owned by someone else
  }
}

export async function readLiveRegistry(dir: string): Promise<Map<string, LiveProcess>> {
  const out = new Map<string, LiveProcess>();
  let names: string[];
  try {
    names = await fs.promises.readdir(dir);
  } catch {
    return out;
  }
  for (const name of names) {
    if (!/^\d+\.json$/.test(name)) continue; // skip *.key and anything else
    try {
      const j = JSON.parse(await fs.promises.readFile(path.join(dir, name), 'utf8'));
      if (typeof j.sessionId !== 'string' || typeof j.pid !== 'number') continue;
      out.set(j.sessionId, {
        pid: j.pid,
        status: typeof j.status === 'string' ? j.status : undefined,
        waitingFor: typeof j.waitingFor === 'string' ? j.waitingFor.slice(0, 80) : undefined,
        statusUpdatedAt: typeof j.statusUpdatedAt === 'number' ? j.statusUpdatedAt : undefined,
        updatedAt: typeof j.updatedAt === 'number' ? j.updatedAt : undefined,
        alive: pidAlive(j.pid),
      });
    } catch {
      // half-written or unexpected file: ignore
    }
  }
  return out;
}
