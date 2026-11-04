/**
 * Status rules (PLAN.md §3). Pure function: same signals + same clock → same answer.
 * Evaluated top-down; first match wins.
 */
import type { ParsedSession, StatusResult, StatusSignals } from './types.ts';
import type { StatusConfig } from './config.ts';

export function computeStatus(sig: StatusSignals, now: number, cfg: StatusConfig): StatusResult {
  // 1. Shipped: you archived it in Bot Crossing.
  if (sig.archived) return { status: 'shipped', reason: 'Archived by you' };

  // 2. Needs you: an open permission/elicitation request (hooks only).
  if (sig.needsYouSince !== undefined) {
    return { status: 'needs_you', reason: sig.needsYouLabel ?? 'Waiting for your permission or answer' };
  }

  // 3. Blocked: the turn died on an API error, or the last tool failed and nothing moved on since.
  const promptAfter = (t: number) => sig.lastPromptAt !== undefined && sig.lastPromptAt > t;
  if (sig.stopFailureAt !== undefined && !promptAfter(sig.stopFailureAt)) {
    return { status: 'blocked', reason: 'Turn stopped on an API error' };
  }
  const ft = sig.lastFinishedTool;
  if (ft && ft.outcome === 'error') {
    const movedOn = promptAfter(ft.endedAt) || (sig.lastToolStartAt !== undefined && sig.lastToolStartAt > ft.endedAt);
    const turnEndedAfter = sig.lastTurnEndAt !== undefined && sig.lastTurnEndAt >= ft.endedAt;
    if (!movedOn && (!cfg.blockedStrict || turnEndedAfter)) {
      return { status: 'blocked', reason: `${ft.name} failed${ft.errorText ? ': ' + ft.errorText : ''}` };
    }
  }

  // 4. Working: recent activity, or a tool call still running.
  if (sig.lastActivityAt !== undefined && now - sig.lastActivityAt < cfg.workingWindowMs) {
    return { status: 'working', reason: 'Activity in the last ' + Math.round(cfg.workingWindowMs / 1000) + ' s' };
  }
  if (sig.openToolSince !== undefined && now - sig.openToolSince < cfg.openToolMaxMs) {
    return { status: 'working', reason: 'A tool call is still running (or waiting for permission)' };
  }

  // 5. Idle.
  const yourMove =
    sig.lastTurnEndAt !== undefined && (sig.lastPromptAt === undefined || sig.lastTurnEndAt >= sig.lastPromptAt);
  return yourMove
    ? { status: 'idle', idleKind: 'your_move', reason: 'Agent finished its turn — your move' }
    : { status: 'idle', idleKind: 'quiet', reason: 'No activity for a while' };
}

/** Signals derivable from the transcript alone. Hooks (phase 4) will add needsYou/stopFailure. */
export function signalsFromTranscript(s: ParsedSession, archived: boolean): StatusSignals {
  let openToolSince: number | undefined;
  for (const t of s.pending.values()) if (openToolSince === undefined || t.startedAt > openToolSince) openToolSince = t.startedAt;
  const ft = s.lastFinishedTool;
  return {
    archived,
    lastActivityAt: s.lastActivityAt,
    lastPromptAt: s.lastPromptAt,
    lastTurnEndAt: s.lastTurnEndAt,
    lastToolStartAt: s.lastToolStartAt,
    openToolSince,
    lastFinishedTool:
      ft && ft.endedAt !== undefined
        ? { outcome: ft.outcome, endedAt: ft.endedAt, name: ft.name, errorText: ft.errorText }
        : undefined,
  };
}
