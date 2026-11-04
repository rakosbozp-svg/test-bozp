/**
 * Read-only parser for Claude Code transcripts (~/.claude/projects/<dir>/<sessionId>.jsonl).
 * Format verified against Claude Code 2.1.318; see PLAN.md §1.2.
 *
 * SAFETY: files are only ever opened with flag 'r'. Nothing here writes, moves or deletes.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { ParsedSession, ToolCall, ToolOutcome, TimelineEvent } from './types.ts';

const MAX_RECENT_TOOLS = 30;
const MAX_MESSAGES = 12;
const MAX_TIMELINE = 150;
const MAX_MSG_CHARS = 600;
const CHUNK = 1 << 20; // 1 MiB

// Marker texts Claude Code writes into tool results (strings found in the 2.1.318 binary).
const REJECT_MARKERS = ["The user doesn't want to proceed with this tool use", 'User rejected tool use', 'Permission to use '];
const INTERRUPT_TOOL = '[Request interrupted by user for tool use]';
const INTERRUPT_TURN = '[Request interrupted by user';

export function newSession(id: string, file: string, projectDirName: string): ParsedSession {
  return {
    id,
    file,
    projectDirName,
    counts: { prompts: 0, tools: 0, errors: 0 },
    recentTools: [],
    messages: [],
    timeline: [],
    pending: new Map(),
    hasConversation: false,
  };
}

const oneLine = (s: string) => s.replace(/\s+/g, ' ').trim();
const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
const baseName = (p: string) => p.split(/[\\/]/).filter(Boolean).pop() ?? p;

function pushCapped<T>(arr: T[], item: T, cap: number) {
  arr.push(item);
  if (arr.length > cap) arr.splice(0, arr.length - cap);
}

function addTimeline(s: ParsedSession, ev: Omit<TimelineEvent, 'source'>) {
  pushCapped(s.timeline, { ...ev, source: 'transcript' }, MAX_TIMELINE);
}

/** Short, human-readable description of a tool call's input. */
export function summarizeToolInput(name: string, input: unknown): string {
  if (!input || typeof input !== 'object') return '';
  const i = input as Record<string, unknown>;
  const str = (k: string) => (typeof i[k] === 'string' ? (i[k] as string) : undefined);
  let out: string | undefined;
  switch (name) {
    case 'Bash':
    case 'PowerShell':
      out = str('description') ?? str('command');
      break;
    case 'Read':
    case 'Write':
    case 'Edit':
    case 'MultiEdit':
    case 'NotebookEdit':
      out = str('file_path') ? baseName(str('file_path')!) : str('notebook_path');
      break;
    case 'Grep':
    case 'Glob':
      out = str('pattern');
      break;
    case 'WebFetch':
      out = str('url');
      break;
    case 'WebSearch':
      out = str('query');
      break;
    case 'Task':
    case 'Agent':
      out = str('description') ?? str('prompt');
      break;
  }
  if (!out) out = Object.values(i).find((v): v is string => typeof v === 'string');
  return clip(oneLine(out ?? ''), 90);
}

/** Text of a user/assistant message content (string or block array), ignoring non-text blocks. */
function textOf(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .filter((b) => b && b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text)
    .join('\n');
}

function toolResultText(block: any): string {
  const c = block?.content;
  if (typeof c === 'string') return c;
  if (Array.isArray(c)) return c.map((x) => (typeof x?.text === 'string' ? x.text : '')).join('\n');
  return '';
}

/**
 * Turn a raw prompt into a title candidate, or undefined if it isn't a real human prompt
 * (system-injected text, local command output, etc.).
 */
export function promptTitle(raw: string): string | undefined {
  const t = raw.trim();
  if (!t) return undefined;
  const cmd = /<command-name>\s*([^<]+?)\s*<\/command-name>/.exec(t);
  if (cmd) {
    const args = /<command-args>([\s\S]*?)<\/command-args>/.exec(t)?.[1]?.trim();
    return oneLine(`${cmd[1]}${args ? ' ' + args : ''}`);
  }
  if (t.startsWith('<') || t.startsWith('Caveat:') || t.startsWith(INTERRUPT_TURN)) return undefined;
  return oneLine(t);
}

function classifyResult(block: any, toolUseResult: unknown): { outcome: ToolOutcome; errorText?: string } {
  const text = toolResultText(block);
  const tur = typeof toolUseResult === 'string' ? toolUseResult : '';
  if (text.startsWith(INTERRUPT_TOOL) || (toolUseResult as any)?.interrupted === true) {
    return { outcome: 'interrupted' };
  }
  if (block?.is_error === true) {
    if (REJECT_MARKERS.some((m) => text.startsWith(m) || tur.startsWith(m))) return { outcome: 'rejected' };
    return { outcome: 'error', errorText: clip(oneLine(text || tur), 240) };
  }
  return { outcome: 'ok' };
}

/** Apply one parsed JSONL record to the session state. Unknown record types are ignored. */
export function applyRecord(s: ParsedSession, r: any): void {
  if (!r || typeof r !== 'object') return;
  const ts = typeof r.timestamp === 'string' ? Date.parse(r.timestamp) : NaN;
  const hasTs = Number.isFinite(ts);

  switch (r.type) {
    case 'custom-title':
      if (typeof r.customTitle === 'string') s.customTitle = r.customTitle;
      return;
    case 'ai-title':
      if (typeof r.aiTitle === 'string') s.aiTitle = r.aiTitle;
      return;
    case 'last-prompt':
      if (typeof r.lastPrompt === 'string') s.lastPrompt = r.lastPrompt;
      return;
    case 'user':
    case 'assistant':
      break;
    default:
      return; // attachment, queue-operation, summary, tools-used, … carry nothing we need
  }

  // Old versions inlined subagent records with isSidechain=true; they are not the main conversation.
  if (r.isSidechain === true) return;

  s.hasConversation = true;
  // The project is where the session started; later records may carry a different cwd after `cd`.
  if (typeof r.cwd === 'string') s.cwd ??= r.cwd;
  if (typeof r.gitBranch === 'string' && r.gitBranch) s.gitBranch = r.gitBranch;
  if (typeof r.version === 'string') s.version = r.version;
  if (typeof r.entrypoint === 'string') s.entrypoint = r.entrypoint;
  if (hasTs) {
    if (s.startedAt === undefined || ts < s.startedAt) s.startedAt = ts;
    if (s.lastActivityAt === undefined || ts > s.lastActivityAt) s.lastActivityAt = ts;
  }
  const at = hasTs ? ts : (s.lastActivityAt ?? 0);
  const msg = r.message ?? {};
  const content = msg.content;

  if (r.type === 'assistant') {
    if (typeof msg.model === 'string' && !msg.model.startsWith('<')) s.model = msg.model;
    if (Array.isArray(content)) {
      for (const b of content) {
        if (b?.type === 'text' && typeof b.text === 'string' && b.text.trim()) {
          pushCapped(s.messages, { role: 'assistant', text: clip(b.text.trim(), MAX_MSG_CHARS), ts: at }, MAX_MESSAGES);
        } else if (b?.type === 'tool_use' && typeof b.id === 'string') {
          const call: ToolCall = {
            id: b.id,
            name: String(b.name ?? 'tool'),
            summary: summarizeToolInput(String(b.name), b.input),
            startedAt: at,
            outcome: 'pending',
          };
          s.pending.set(call.id, call);
          s.counts.tools++;
          s.lastToolStartAt = at;
          pushCapped(s.recentTools, call, MAX_RECENT_TOOLS);
          addTimeline(s, { ts: at, kind: 'tool', label: call.summary ? `${call.name}: ${call.summary}` : call.name });
        }
      }
    }
    if (msg.stop_reason === 'end_turn' || msg.stop_reason === 'stop_sequence' || msg.stop_reason === 'max_tokens') {
      s.lastTurnEndAt = at;
      addTimeline(s, { ts: at, kind: 'turn_end', label: 'Turn finished' });
    }
    return;
  }

  // ---- user record: either a human prompt or tool results ----
  const toolResults = Array.isArray(content) ? content.filter((b: any) => b?.type === 'tool_result') : [];
  if (toolResults.length > 0) {
    for (const b of toolResults) {
      const call = s.pending.get(b.tool_use_id) ?? s.recentTools.find((t) => t.id === b.tool_use_id);
      const { outcome, errorText } = classifyResult(b, r.toolUseResult);
      if (call) {
        s.pending.delete(call.id);
        call.outcome = outcome;
        call.endedAt = at;
        if (errorText) call.errorText = errorText;
        s.lastFinishedTool = call;
      }
      if (outcome === 'error') {
        s.counts.errors++;
        addTimeline(s, { ts: at, kind: 'tool_error', label: `${call?.name ?? 'Tool'} failed${errorText ? ': ' + errorText : ''}` });
      } else if (outcome === 'rejected') {
        addTimeline(s, { ts: at, kind: 'tool_rejected', label: `${call?.name ?? 'Tool'} denied by you` });
      } else if (outcome === 'interrupted') {
        addTimeline(s, { ts: at, kind: 'interrupted', label: 'Interrupted by you' });
      }
    }
    return;
  }

  if (r.isMeta === true) return;
  // Newer versions tag non-human turns (e.g. task notifications) with origin.kind.
  if (r.origin && typeof r.origin.kind === 'string' && r.origin.kind !== 'human') return;

  const text = textOf(content);
  if (text.trim().startsWith(INTERRUPT_TURN)) {
    s.lastTurnEndAt = at;
    s.pending.clear();
    addTimeline(s, { ts: at, kind: 'interrupted', label: 'Interrupted by you' });
    return;
  }
  const title = promptTitle(text);
  if (!title) return;
  s.firstPrompt ??= title;
  s.lastPromptAt = at;
  s.counts.prompts++;
  // Tool calls left without a result from a previous turn are dead.
  s.pending.clear();
  pushCapped(s.messages, { role: 'user', text: clip(text.trim(), MAX_MSG_CHARS), ts: at }, MAX_MESSAGES);
  addTimeline(s, { ts: at, kind: 'prompt', label: clip(title, 90) });
}

// ---------------------------------------------------------------------------
// Incremental file reading
// ---------------------------------------------------------------------------

interface FileState {
  session: ParsedSession;
  offset: number;
  size: number;
  mtimeMs: number;
  /** Bytes after the last newline (a line still being written). */
  leftover: Buffer;
}

/** Reads bytes [offset, size) and feeds complete lines to the session. */
async function readNew(st: FileState, size: number): Promise<void> {
  const fh = await fs.promises.open(st.session.file, 'r');
  try {
    let pos = st.offset;
    const buf = Buffer.allocUnsafe(CHUNK);
    while (pos < size) {
      const { bytesRead } = await fh.read(buf, 0, Math.min(CHUNK, size - pos), pos);
      if (bytesRead === 0) break;
      pos += bytesRead;
      // Work on bytes, so a multi-byte UTF-8 char split across chunks is never broken.
      let data = st.leftover.length ? Buffer.concat([st.leftover, buf.subarray(0, bytesRead)]) : buf.subarray(0, bytesRead);
      let start = 0;
      for (let nl = data.indexOf(10, start); nl !== -1; nl = data.indexOf(10, start)) {
        const line = data.toString('utf8', start, nl).trim();
        start = nl + 1;
        if (!line) continue;
        try {
          applyRecord(st.session, JSON.parse(line));
        } catch {
          // A corrupt or unexpected line: skip it, never fail the whole session.
        }
      }
      st.leftover = Buffer.from(data.subarray(start));
    }
    st.offset = pos;
  } finally {
    await fh.close();
  }
}

export interface ScanResult {
  sessions: ParsedSession[];
  errors: string[];
}

/**
 * Keeps an in-memory model of all recent transcripts and updates it incrementally.
 * Call refresh() periodically; only changed files are re-read, and only their new bytes.
 */
export class TranscriptStore {
  private files = new Map<string, FileState>();
  lastErrors: string[] = [];

  constructor(
    private projectsDir: string,
    private lookbackDays: number,
  ) {}

  async refresh(): Promise<void> {
    const errors: string[] = [];
    const cutoff = Date.now() - this.lookbackDays * 86_400_000;
    const seen = new Set<string>();

    let projectDirs: fs.Dirent[] = [];
    try {
      projectDirs = await fs.promises.readdir(this.projectsDir, { withFileTypes: true });
    } catch (e: any) {
      errors.push(`Cannot read ${this.projectsDir}: ${e.code ?? e.message}`);
    }

    for (const dir of projectDirs) {
      if (!dir.isDirectory()) continue;
      const dirPath = path.join(this.projectsDir, dir.name);
      let entries: fs.Dirent[];
      try {
        entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const ent of entries) {
        if (!ent.isFile() || !ent.name.endsWith('.jsonl')) continue;
        const file = path.join(dirPath, ent.name);
        let stat: fs.Stats;
        try {
          stat = await fs.promises.stat(file);
        } catch {
          continue;
        }
        if (stat.mtimeMs < cutoff) continue;
        seen.add(file);

        let st = this.files.get(file);
        // File shrank or was replaced: start over.
        if (st && stat.size < st.offset) st = undefined;
        if (!st) {
          st = {
            session: newSession(ent.name.slice(0, -'.jsonl'.length), file, dir.name),
            offset: 0,
            size: 0,
            mtimeMs: 0,
            leftover: Buffer.alloc(0),
          };
          this.files.set(file, st);
        }
        if (stat.size !== st.size || stat.mtimeMs !== st.mtimeMs) {
          try {
            await readNew(st, stat.size);
            st.size = stat.size;
            st.mtimeMs = stat.mtimeMs;
          } catch (e: any) {
            errors.push(`${file}: ${e.code ?? e.message}`);
          }
        }
      }
    }

    for (const file of this.files.keys()) if (!seen.has(file)) this.files.delete(file);
    this.lastErrors = errors;
  }

  sessions(): ParsedSession[] {
    return [...this.files.values()].map((f) => f.session).filter((s) => s.hasConversation);
  }

  get(id: string): ParsedSession | undefined {
    return this.sessions().find((s) => s.id === id);
  }
}

/** Fallback when no record has a cwd: best-effort decode of the (lossy) directory name. */
export function projectPathOf(s: ParsedSession): string {
  return s.cwd ?? s.projectDirName;
}

export function projectNameOf(s: ParsedSession): string {
  return s.cwd ? baseName(s.cwd) : s.projectDirName.replace(/^-+/, '');
}
