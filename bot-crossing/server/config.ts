import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function num(name: string, fallback: number): number {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

/** Claude Code's data dir. Honours CLAUDE_CONFIG_DIR like Claude Code itself does. */
export const claudeDir = process.env.CLAUDE_CONFIG_DIR
  ? path.resolve(process.env.CLAUDE_CONFIG_DIR)
  : path.join(os.homedir(), '.claude');

export const config = {
  appRoot,
  claudeDir,
  projectsDir: path.join(claudeDir, 'projects'),
  liveRegistryDir: path.join(claudeDir, 'sessions'),
  /** Bot Crossing's own writable state (archive flags). Never inside ~/.claude. */
  dataDir: process.env.BC_DATA_DIR ? path.resolve(process.env.BC_DATA_DIR) : path.join(appRoot, '.data'),
  host: '127.0.0.1',
  port: num('PORT', 4545),
  /** Only sessions whose transcript changed in the last N days are loaded. */
  lookbackDays: num('BC_DAYS', 7),
  /** How often transcripts are re-checked for changes (ms). */
  pollMs: num('BC_POLL_MS', 2000),
  status: {
    /** Activity within this window counts as Working. */
    workingWindowMs: num('BC_WORKING_SEC', 30) * 1000,
    /** A tool call without a result counts as Working for at most this long (transcript-only). */
    openToolMaxMs: num('BC_OPEN_TOOL_MIN', 10) * 60_000,
    /** Strict Blocked: only when the agent ended its turn right after the failure. */
    blockedStrict: process.env.BC_BLOCKED_STRICT === '1',
  },
};

export type StatusConfig = typeof config.status;
