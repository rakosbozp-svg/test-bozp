export type SessionStatus = 'needs_you' | 'blocked' | 'working' | 'idle' | 'shipped';

/** ok = tool succeeded; error = tool failed; rejected = you denied it; interrupted = you pressed Esc. */
export type ToolOutcome = 'pending' | 'ok' | 'error' | 'rejected' | 'interrupted';

export interface ToolCall {
  id: string;
  name: string;
  summary: string;
  startedAt: number;
  outcome: ToolOutcome;
  endedAt?: number;
  errorText?: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  ts: number;
}

export type TimelineKind =
  | 'prompt'
  | 'tool'
  | 'tool_error'
  | 'tool_rejected'
  | 'turn_end'
  | 'interrupted'
  // live hook events (phase 4)
  | 'needs_you'
  | 'session_start'
  | 'session_end'
  | 'stop_failure';

export interface TimelineEvent {
  ts: number;
  kind: TimelineKind;
  label: string;
  source: 'transcript' | 'hook';
}

/** Everything the transcript parser knows about one session. */
export interface ParsedSession {
  id: string;
  file: string;
  projectDirName: string;
  cwd?: string;
  gitBranch?: string;
  version?: string;
  model?: string;
  entrypoint?: string;
  customTitle?: string;
  aiTitle?: string;
  firstPrompt?: string;
  lastPrompt?: string;
  startedAt?: number;
  lastActivityAt?: number;
  lastPromptAt?: number;
  lastTurnEndAt?: number;
  lastToolStartAt?: number;
  /** Most recent finished tool call (any outcome). */
  lastFinishedTool?: ToolCall;
  counts: { prompts: number; tools: number; errors: number };
  recentTools: ToolCall[];
  messages: ChatMessage[];
  timeline: TimelineEvent[];
  /** tool_use ids still waiting for a result. */
  pending: Map<string, ToolCall>;
  hasConversation: boolean;
}

/** Normalised inputs to the status rules, from transcript and (later) hooks. */
export interface StatusSignals {
  archived: boolean;
  lastActivityAt?: number;
  lastPromptAt?: number;
  lastTurnEndAt?: number;
  lastToolStartAt?: number;
  /** Start time of the newest tool call that has no result yet. */
  openToolSince?: number;
  lastFinishedTool?: { outcome: ToolOutcome; endedAt: number; name: string; errorText?: string };
  /** Set only by hooks (phase 4): an open permission/elicitation request. */
  needsYouSince?: number;
  needsYouLabel?: string;
  /** Set only by hooks: the turn died on an API error. */
  stopFailureAt?: number;
}

export interface StatusResult {
  status: SessionStatus;
  /** Human-readable reason, shown in the UI and useful for checking the rules. */
  reason: string;
  /** For idle: did the agent finish its turn (your move) or just go quiet? */
  idleKind?: 'your_move' | 'quiet';
}

export interface LiveProcess {
  pid: number;
  status?: string;
  alive: boolean;
  updatedAt?: number;
}

export interface SessionSummary {
  id: string;
  title: string;
  projectPath: string;
  projectName: string;
  gitBranch?: string;
  model?: string;
  version?: string;
  status: SessionStatus;
  statusReason: string;
  idleKind?: 'your_move' | 'quiet';
  startedAt?: string;
  lastActivityAt?: string;
  lastActivityAgoSec?: number;
  archived: boolean;
  archivedAt?: string;
  process: LiveProcess | null;
  counts: { prompts: number; tools: number; errors: number };
  lastTool: { name: string; summary: string; outcome: ToolOutcome; at: string } | null;
  resumeCommand: string;
}

export interface SessionDetail extends SessionSummary {
  transcriptFile: string;
  recentTools: (Omit<ToolCall, 'startedAt' | 'endedAt'> & { startedAt: string; endedAt?: string })[];
  messages: { role: 'user' | 'assistant'; text: string; at: string }[];
  timeline: { at: string; kind: TimelineKind; label: string; source: 'transcript' | 'hook' }[];
}
