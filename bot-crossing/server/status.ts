/**
 * Status rules (PLAN.md §3). Pure functions: same signals + same clock → same answer.
 * Evaluated top-down; first match wins.
 */
import type { LiveProcess, ParsedSession, StatusResult, StatusSignals } from './types.ts';
import type { StatusConfig } from './config.ts';
import type { HookState } from './hooks.ts';

export function computeStatus(sig: StatusSignals, now: number, cfg: StatusConfig): StatusResult {
  // 1. Shipped: you archived it in Bot Crossing.
  if (sig.archived) return { status: 'shipped', reason: 'Archivováno tebou' };

  // 2. Needs you: an open permission/elicitation request (hooks or live registry).
  if (sig.needsYouSince !== undefined) {
    return { status: 'needs_you', reason: sig.needsYouLabel ?? 'Čeká na tvé povolení nebo odpověď' };
  }

  // 3. Blocked: the turn died on an API error, or the last tool failed and the agent stopped there.
  const promptAfter = (t: number) => sig.lastPromptAt !== undefined && sig.lastPromptAt > t;
  if (sig.stopFailureAt !== undefined && !promptAfter(sig.stopFailureAt)) {
    return { status: 'blocked', reason: 'Tah skončil chybou API' };
  }
  const ft = sig.lastFinishedTool;
  if (ft && ft.outcome === 'error' && sig.turnOpen !== true) {
    const movedOn = promptAfter(ft.endedAt) || (sig.lastToolStartAt !== undefined && sig.lastToolStartAt > ft.endedAt);
    const turnEndedAfter = sig.lastTurnEndAt !== undefined && sig.lastTurnEndAt >= ft.endedAt;
    if (!movedOn && (!cfg.blockedStrict || turnEndedAfter)) {
      return { status: 'blocked', reason: `${ft.name} selhal${ft.errorText ? ': ' + ft.errorText : ''}` };
    }
  }

  // 4. Working: a turn is running, recent activity, or a tool call still running.
  if (sig.turnOpen === true) return { status: 'working', reason: 'Agent právě pracuje' };
  if (sig.lastActivityAt !== undefined && now - sig.lastActivityAt < cfg.workingWindowMs) {
    return { status: 'working', reason: 'Aktivita za posledních ' + Math.round(cfg.workingWindowMs / 1000) + ' s' };
  }
  if (sig.turnOpen === undefined && sig.openToolSince !== undefined && now - sig.openToolSince < cfg.openToolMaxMs) {
    return { status: 'working', reason: 'Nástroj pořád běží (nebo čeká na povolení)' };
  }

  // 5. Idle.
  const yourMove =
    sig.lastTurnEndAt !== undefined && (sig.lastPromptAt === undefined || sig.lastTurnEndAt >= sig.lastPromptAt);
  return yourMove
    ? { status: 'idle', idleKind: 'your_move', reason: 'Agent dokončil tah — jsi na tahu' }
    : { status: 'idle', idleKind: 'quiet', reason: 'Delší dobu žádná aktivita' };
}

/** Signals derivable from the transcript alone. */
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

const max = (...xs: (number | undefined)[]) => {
  const v = xs.filter((x): x is number => x !== undefined);
  return v.length ? Math.max(...v) : undefined;
};

/**
 * Combine transcript signals with live hook events and the live process registry.
 * Precedence for "is a turn running?": registry (if the process is alive) > hooks > unknown.
 */
export function mergeSignals(
  t: StatusSignals,
  h: HookState | undefined,
  proc: LiveProcess | null | undefined,
  now: number,
  cfg: StatusConfig,
): StatusSignals {
  const sig: StatusSignals = { ...t };
  const liveProc = proc && proc.alive ? proc : undefined;

  if (h) {
    sig.lastActivityAt = max(t.lastActivityAt, h.lastActivityAt);
    sig.lastPromptAt = max(t.lastPromptAt, h.lastPromptAt);
    sig.lastTurnEndAt = max(t.lastTurnEndAt, h.lastStopAt, h.stopFailureAt);
    sig.stopFailureAt = h.stopFailureAt;

    let hookOpen: number | undefined;
    for (const o of h.openTools.values()) hookOpen = max(hookOpen, o.at);
    if (hookOpen !== undefined) sig.lastToolStartAt = max(sig.lastToolStartAt, hookOpen);
    // Hooks know about open tools precisely; once they've spoken, trust them over the transcript.
    if (h.lastActivityAt !== undefined && h.lastActivityAt >= (t.lastActivityAt ?? 0) - 5000) sig.openToolSince = hookOpen;

    // Newest finished-tool outcome wins.
    const tEnd = t.lastFinishedTool?.endedAt ?? -1;
    if (h.lastToolFail && h.lastToolFail.at > tEnd && h.lastToolFail.at >= (h.lastToolOk?.at ?? -1)) {
      sig.lastFinishedTool = { outcome: 'error', endedAt: h.lastToolFail.at, name: h.lastToolFail.name, errorText: t.lastFinishedTool?.errorText };
    } else if (h.lastToolOk && h.lastToolOk.at > tEnd) {
      sig.lastFinishedTool = { outcome: 'ok', endedAt: h.lastToolOk.at, name: h.lastToolOk.name };
    }

    if (h.needsYou) {
      // There is no "permission granted" hook. If the registry shows the process went back to work
      // after the request, you answered it.
      const answered = liveProc?.status === 'busy' && (liveProc.statusUpdatedAt ?? 0) > h.needsYou.since;
      if (!answered) {
        sig.needsYouSince = h.needsYou.since;
        sig.needsYouLabel = h.needsYou.label;
      }
    }

    if (h.sessionEndAt === undefined && h.lastActivityAt !== undefined && now - h.lastActivityAt < cfg.openToolMaxMs) {
      sig.turnOpen = h.turnOpen;
    }
  }

  if (liveProc) {
    if (liveProc.status === 'waiting' && sig.needsYouSince === undefined) {
      sig.needsYouSince = liveProc.statusUpdatedAt ?? now;
      sig.needsYouLabel = liveProc.waitingFor ? `Čeká na tebe (${liveProc.waitingFor})` : 'Čeká na tebe';
    }
    if (liveProc.status === 'busy') sig.turnOpen = true;
    else if (liveProc.status === 'idle') sig.turnOpen = false;
  }
  return sig;
}
