/**
 * Pure helpers to add/remove Bot Crossing hooks in a Claude Code settings object.
 * Never touches anything that isn't ours; idempotent (installing twice = installing once).
 */
export const HOOK_EVENTS = [
  'SessionStart',
  'SessionEnd',
  'UserPromptSubmit',
  'PreToolUse',
  'PostToolUse',
  'PostToolUseFailure',
  'PermissionRequest',
  'PermissionDenied',
  'Notification',
  'Elicitation',
  'ElicitationResult',
  'Stop',
  'StopFailure',
  'SubagentStart',
  'SubagentStop',
] as const;

export type HookMode = 'quiet' | 'http';

export interface HookEntry {
  type: 'command' | 'http';
  command?: string;
  url?: string;
  timeout: number;
}

/** Forward slashes work for Node on every OS and avoid backslash-escaping trouble in shells. */
const slash = (p: string) => p.replace(/\\/g, '/');
const q = (p: string) => `"${slash(p).replace(/"/g, '\\"')}"`;

export function buildEntry(mode: HookMode, opts: { port: number; nodePath: string; scriptPath: string }): HookEntry {
  if (mode === 'http') return { type: 'http', url: `http://127.0.0.1:${opts.port}/hook`, timeout: 2 };
  return { type: 'command', command: `${q(opts.nodePath)} ${q(opts.scriptPath)} ${opts.port}`, timeout: 3 };
}

/** Is this hook one of ours (any mode, any port)? */
export function isOurs(h: unknown): boolean {
  if (!h || typeof h !== 'object') return false;
  const x = h as Record<string, unknown>;
  const url = typeof x.url === 'string' ? x.url : '';
  const cmd = typeof x.command === 'string' ? x.command : '';
  return /^http:\/\/(127\.0\.0\.1|localhost):\d+\/hook$/.test(url) || cmd.includes('send-event.mjs');
}

type Settings = Record<string, any>;

/** Returns a copy of settings without any Bot Crossing hooks. Other hooks stay exactly as they were. */
export function removeOurHooks(settings: Settings): { settings: Settings; removed: number } {
  const out: Settings = structuredClone(settings);
  let removed = 0;
  const hooks = out.hooks;
  if (!hooks || typeof hooks !== 'object') return { settings: out, removed };
  for (const event of Object.keys(hooks)) {
    const groups = hooks[event];
    if (!Array.isArray(groups)) continue;
    const kept = [];
    for (const g of groups) {
      if (!g || !Array.isArray(g.hooks)) {
        kept.push(g);
        continue;
      }
      const before = g.hooks.length;
      const rest = g.hooks.filter((h: unknown) => !isOurs(h));
      removed += before - rest.length;
      if (rest.length > 0) kept.push({ ...g, hooks: rest });
      else if (before === 0) kept.push(g); // an empty group that wasn't ours: leave it alone
    }
    if (kept.length > 0) hooks[event] = kept;
    else delete hooks[event];
  }
  if (Object.keys(hooks).length === 0) delete out.hooks;
  return { settings: out, removed };
}

/** Returns a copy of settings with Bot Crossing hooks for every event (replacing any older ones of ours). */
export function addOurHooks(settings: Settings, entry: HookEntry): Settings {
  const { settings: out } = removeOurHooks(settings);
  if (!out.hooks || typeof out.hooks !== 'object') out.hooks = {};
  for (const event of HOOK_EVENTS) {
    const list = Array.isArray(out.hooks[event]) ? out.hooks[event] : [];
    list.push({ matcher: '', hooks: [{ ...entry }] });
    out.hooks[event] = list;
  }
  return out;
}

/** Which of our events are present, and in which mode. */
export function inspect(settings: Settings): { event: string; mode: HookMode | null; target: string }[] {
  return HOOK_EVENTS.map((event) => {
    const groups = Array.isArray(settings?.hooks?.[event]) ? settings.hooks[event] : [];
    for (const g of groups) {
      for (const h of Array.isArray(g?.hooks) ? g.hooks : []) {
        if (isOurs(h)) return { event, mode: h.type === 'http' ? 'http' : 'quiet', target: String(h.url ?? h.command) };
      }
    }
    return { event, mode: null, target: '' };
  });
}
