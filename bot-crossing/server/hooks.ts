/**
 * Live events from Claude Code hooks (POST /hook). See PLAN.md §1.3.
 *
 * Claude Code's http hooks POST the full hook input. We keep only a handful of fields
 * (session id, cwd, event, tool name/id, notification type, interrupt flag, subagent id)
 * and drop everything else — prompts, tool inputs and messages are never stored.
 */
import type { TimelineEvent } from './types.ts';

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
  'PreCompact',
  'PostCompact',
] as const;
export type HookEventName = (typeof HOOK_EVENTS)[number];
const KNOWN = new Set<string>(HOOK_EVENTS);

export interface HookEvent {
  sessionId: string;
  event: HookEventName;
  at: number;
  cwd?: string;
  toolName?: string;
  toolUseId?: string;
  notificationType?: string;
  isInterrupt?: boolean;
  agentId?: string;
}

const str = (v: unknown, max: number, re?: RegExp) =>
  typeof v === 'string' && v.length > 0 && v.length <= max && (!re || re.test(v)) ? v : undefined;

/** Validates a hook payload and reduces it to the few fields we keep. Returns null if unusable. */
export function sanitizeHook(body: unknown, now = Date.now()): HookEvent | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  const sessionId = str(b.session_id, 128, /^[\w.-]+$/);
  const event = str(b.hook_event_name, 40);
  if (!sessionId || !event || !KNOWN.has(event)) return null;
  return {
    sessionId,
    event: event as HookEventName,
    at: now,
    cwd: str(b.cwd, 1024),
    toolName: str(b.tool_name, 128),
    toolUseId: str(b.tool_use_id, 128),
    notificationType: str(b.notification_type, 64),
    isInterrupt: b.is_interrupt === true ? true : undefined,
    agentId: str(b.agent_id, 128),
  };
}

/** What the hooks have told us about one session. */
export interface HookState {
  sessionId: string;
  lastEventAt: number;
  lastActivityAt?: number;
  lastPromptAt?: number;
  lastStopAt?: number;
  stopFailureAt?: number;
  sessionEndAt?: number;
  turnOpen: boolean;
  /**
   * Open permission/elicitation request. `waitingOn` = tool_use_ids it is probably about
   * (PermissionRequest carries no tool_use_id, so we match open calls of the same tool name).
   */
  needsYou?: { since: number; label: string; waitingOn?: Set<string> };
  openTools: Map<string, { name: string; at: number }>;
  lastToolOk?: { at: number; name: string };
  lastToolFail?: { at: number; name: string };
  subagents: Set<string>;
  timeline: TimelineEvent[];
}

const ACTIVITY = new Set<HookEventName>([
  'SessionStart',
  'UserPromptSubmit',
  'PreToolUse',
  'PostToolUse',
  'PostToolUseFailure',
  'SubagentStart',
  'SubagentStop',
  'PreCompact',
  'PostCompact',
]);
/** Events after which the agent is evidently no longer waiting for you. */
const CLEARS_NEEDS_YOU = new Set<HookEventName>(['UserPromptSubmit', 'ElicitationResult', 'Stop', 'StopFailure', 'SessionEnd']);
/** Tool-finished events: they clear a request only if it was about that tool call (verified: parallel calls happen). */
const TOOL_DONE = new Set<HookEventName>(['PostToolUse', 'PostToolUseFailure', 'PermissionDenied']);
const MAX_TIMELINE = 60;
const MAX_SESSIONS = 500;

export class HookStore {
  private states = new Map<string, HookState>();
  lastHookAt?: number;
  received = 0;
  ignored = 0;

  get(id: string): HookState | undefined {
    return this.states.get(id);
  }

  /** Feed one raw payload. Returns the sanitized event (or null if it was ignored). */
  ingestRaw(body: unknown, now = Date.now()): HookEvent | null {
    const ev = sanitizeHook(body, now);
    if (!ev) {
      this.ignored++;
      return null;
    }
    this.ingest(ev);
    return ev;
  }

  ingest(ev: HookEvent): void {
    this.received++;
    this.lastHookAt = ev.at;
    let s = this.states.get(ev.sessionId);
    if (!s) {
      if (this.states.size >= MAX_SESSIONS) {
        const oldest = [...this.states.values()].sort((a, b) => a.lastEventAt - b.lastEventAt)[0];
        this.states.delete(oldest.sessionId);
      }
      s = { sessionId: ev.sessionId, lastEventAt: ev.at, turnOpen: false, openTools: new Map(), subagents: new Set(), timeline: [] };
      this.states.set(ev.sessionId, s);
    }
    const at = ev.at;
    s.lastEventAt = at;
    if (ACTIVITY.has(ev.event)) s.lastActivityAt = at;
    if (CLEARS_NEEDS_YOU.has(ev.event)) s.needsYou = undefined;
    if (TOOL_DONE.has(ev.event) && s.needsYou) {
      const w = s.needsYou.waitingOn;
      if (!w || w.size === 0) s.needsYou = undefined;
      else if (ev.toolUseId) {
        w.delete(ev.toolUseId);
        if (w.size === 0) s.needsYou = undefined;
      }
    }
    const tool = ev.toolName ?? 'Nástroj';
    const note = (kind: TimelineEvent['kind'], label: string) => {
      s.timeline.push({ ts: at, kind, label, source: 'hook' });
      if (s.timeline.length > MAX_TIMELINE) s.timeline.splice(0, s.timeline.length - MAX_TIMELINE);
    };

    switch (ev.event) {
      case 'SessionStart':
        s.sessionEndAt = undefined;
        note('session_start', 'Relace spuštěna');
        break;
      case 'SessionEnd':
        s.sessionEndAt = at;
        s.turnOpen = false;
        s.openTools.clear();
        s.subagents.clear();
        note('session_end', 'Relace ukončena');
        break;
      case 'UserPromptSubmit':
        s.lastPromptAt = at;
        s.turnOpen = true;
        s.openTools.clear();
        s.stopFailureAt = undefined;
        s.lastToolFail = undefined;
        break;
      case 'PreToolUse':
        if (ev.toolUseId) s.openTools.set(ev.toolUseId, { name: tool, at });
        s.turnOpen = true;
        break;
      case 'PostToolUse':
        if (ev.toolUseId) s.openTools.delete(ev.toolUseId);
        s.lastToolOk = { at, name: tool };
        break;
      case 'PostToolUseFailure':
        if (ev.toolUseId) s.openTools.delete(ev.toolUseId);
        if (!ev.isInterrupt) s.lastToolFail = { at, name: tool };
        break;
      case 'PermissionDenied':
        if (ev.toolUseId) s.openTools.delete(ev.toolUseId);
        break;
      case 'PermissionRequest': {
        const waitingOn = new Set([...s.openTools].filter(([, o]) => o.name === tool).map(([id]) => id));
        s.needsYou = { since: at, label: `${tool} chce tvé povolení`, waitingOn };
        note('needs_you', `${tool} čeká na tvé povolení`);
        break;
      }
      case 'Notification':
        if (ev.notificationType === 'permission_prompt') {
          // Usually follows a PermissionRequest for the same prompt: don't log it twice.
          if (!s.needsYou) {
            s.needsYou = { since: at, label: 'Čeká na tvé povolení' };
            note('needs_you', 'Čeká na tvé povolení');
          }
        } else if (ev.notificationType === 'elicitation_dialog') {
          s.needsYou = { since: at, label: 'Agent se ptá — čeká na tvou odpověď' };
          note('needs_you', 'Agent se ptá');
        }
        // idle_prompt ("your move") deliberately does not count as Needs you (PLAN.md §5, decision 2).
        break;
      case 'Elicitation':
        s.needsYou = { since: at, label: 'Nástroj potřebuje tvůj vstup' };
        note('needs_you', 'Nástroj potřebuje tvůj vstup');
        break;
      case 'Stop':
        s.lastStopAt = at;
        s.turnOpen = false;
        s.openTools.clear();
        break;
      case 'StopFailure':
        s.stopFailureAt = at;
        s.turnOpen = false;
        s.openTools.clear();
        note('stop_failure', 'Tah skončil chybou API');
        break;
      case 'SubagentStart':
        if (ev.agentId) s.subagents.add(ev.agentId);
        note('subagent', 'Spuštěn subagent');
        break;
      case 'SubagentStop':
        if (ev.agentId) s.subagents.delete(ev.agentId);
        break;
    }
  }
}
