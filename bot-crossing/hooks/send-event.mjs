#!/usr/bin/env node
/**
 * Fallback hook for Claude Code versions without native "http" hooks.
 * Reads the hook input from stdin, keeps only a few fields, POSTs them to Bot Crossing on
 * localhost and ALWAYS exits 0 with no output — so it can never block or change what Claude does.
 */
const KEEP = ['session_id', 'hook_event_name', 'cwd', 'tool_name', 'tool_use_id', 'notification_type', 'is_interrupt', 'agent_id'];
// Port comes as the first argument (written by `npm run hooks:install`), else env, else 4545.
const port = Number(process.argv[2]) || Number(process.env.BOT_CROSSING_PORT) || 4545;

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => (raw += c));
process.stdin.on('end', async () => {
  try {
    const input = JSON.parse(raw);
    const small = Object.fromEntries(KEEP.filter((k) => k in input).map((k) => [k, input[k]]));
    await fetch(`http://127.0.0.1:${port}/hook`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(small),
      signal: AbortSignal.timeout(1500),
    });
  } catch {
    // Bot Crossing not running, or bad input: ignore silently.
  }
  process.exit(0);
});
