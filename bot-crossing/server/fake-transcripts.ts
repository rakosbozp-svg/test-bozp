/**
 * Builds synthetic transcript records in the format verified on Claude Code 2.1.318 (PLAN.md §1.2).
 * Used by tests and by the demo data generator. Never touches a real ~/.claude.
 */
import { randomUUID } from 'node:crypto';

export interface FakeCtx {
  sessionId: string;
  cwd: string;
  model?: string;
  version?: string;
  t: number; // current fake clock (ms)
  lines: object[];
  lastUuid?: string;
}

export function fakeSession(sessionId: string, cwd: string, startAt: number, model = 'claude-sonnet-5-5'): FakeCtx {
  return { sessionId, cwd, model, version: '2.1.318', t: startAt, lines: [] };
}

function base(c: FakeCtx, type: string) {
  const uuid = randomUUID();
  const rec = {
    parentUuid: c.lastUuid ?? null,
    isSidechain: false,
    type,
    uuid,
    timestamp: new Date(c.t).toISOString(),
    userType: 'external',
    entrypoint: 'cli',
    cwd: c.cwd,
    sessionId: c.sessionId,
    version: c.version,
    gitBranch: 'main',
  };
  c.lastUuid = uuid;
  return rec;
}

export function advance(c: FakeCtx, ms: number) {
  c.t += ms;
  return c;
}

export function prompt(c: FakeCtx, text: string) {
  c.lines.push({ type: 'queue-operation', operation: 'enqueue', timestamp: new Date(c.t).toISOString(), sessionId: c.sessionId, content: text });
  c.lines.push({ ...base(c, 'user'), promptId: randomUUID(), message: { role: 'user', content: text }, origin: { kind: 'human' }, permissionMode: 'default' });
  c.lines.push({ type: 'last-prompt', lastPrompt: text, leafUuid: c.lastUuid, sessionId: c.sessionId });
  return c;
}

function assistant(c: FakeCtx, block: object, stop_reason: string | null) {
  c.lines.push({
    ...base(c, 'assistant'),
    requestId: 'req_' + randomUUID().slice(0, 8),
    message: { model: c.model, id: 'msg_' + randomUUID().slice(0, 8), type: 'message', role: 'assistant', content: [block], stop_reason, usage: { input_tokens: 1, output_tokens: 1 } },
  });
}

export function say(c: FakeCtx, text: string, endTurn = false) {
  assistant(c, { type: 'text', text }, endTurn ? 'end_turn' : null);
  return c;
}

/** Emits a tool_use; returns its id so a result can be attached later (or never, for "pending"). */
export function toolUse(c: FakeCtx, name: string, input: Record<string, unknown>): string {
  const id = 'toolu_' + randomUUID().replace(/-/g, '').slice(0, 20);
  assistant(c, { type: 'tool_use', id, name, input, caller: { type: 'direct' } }, 'tool_use');
  return id;
}

export function toolResult(c: FakeCtx, id: string, kind: 'ok' | 'error' | 'rejected' | 'interrupted', text = 'done') {
  const content =
    kind === 'rejected'
      ? "The user doesn't want to proceed with this tool use. The tool use was rejected."
      : kind === 'interrupted'
        ? '[Request interrupted by user for tool use]'
        : text;
  const is_error = kind !== 'ok';
  c.lines.push({
    ...base(c, 'user'),
    message: { role: 'user', content: [{ tool_use_id: id, type: 'tool_result', content, is_error }] },
    toolUseResult: kind === 'ok' ? { stdout: text, stderr: '', interrupted: false } : kind === 'rejected' ? 'User rejected tool use' : `Error: ${content}`,
    sourceToolAssistantUUID: c.lastUuid,
  });
  return c;
}

/** Convenience: a tool call with an immediate result. */
export function tool(c: FakeCtx, name: string, input: Record<string, unknown>, kind: 'ok' | 'error' | 'rejected' | 'interrupted' = 'ok', text?: string) {
  const id = toolUse(c, name, input);
  advance(c, 1500);
  return toolResult(c, id, kind, text);
}

export function attachment(c: FakeCtx) {
  c.lines.push({ ...base(c, 'attachment'), attachment: { type: 'date' } });
  return c;
}

export function toJsonl(c: FakeCtx): string {
  return c.lines.map((l) => JSON.stringify(l)).join('\n') + '\n';
}

/** Claude Code's directory name for a project path: every non-alphanumeric char → '-'. */
export function encodeProjectDir(cwd: string): string {
  return cwd.replace(/[^a-zA-Z0-9]/g, '-');
}
