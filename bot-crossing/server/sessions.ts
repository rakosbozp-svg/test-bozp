/** Combines transcripts, live registry and archive flags into API-ready session objects. */
import type { LiveProcess, ParsedSession, SessionDetail, SessionStatus, SessionSummary } from './types.ts';
import { TranscriptStore, projectNameOf, projectPathOf } from './transcripts.ts';
import { computeStatus, signalsFromTranscript } from './status.ts';
import { readLiveRegistry } from './live-registry.ts';
import { AppState } from './app-state.ts';
import { config } from './config.ts';

const ORDER: Record<SessionStatus, number> = { needs_you: 0, blocked: 1, working: 2, idle: 3, shipped: 4 };
const iso = (t?: number) => (t === undefined ? undefined : new Date(t).toISOString());
const TITLE_MAX = 70;

export function titleOf(s: ParsedSession): string {
  const t = s.customTitle ?? s.aiTitle ?? s.firstPrompt ?? s.lastPrompt ?? '(zatím bez zadání)';
  const one = t.replace(/\s+/g, ' ').trim();
  return one.length > TITLE_MAX ? one.slice(0, TITLE_MAX - 1) + '…' : one;
}

export function resumeCommand(s: ParsedSession, platform = process.platform): string {
  const dir = projectPathOf(s);
  // PowerShell (the Windows default) has no `&&` in v5.1; `;` works there and in bash/zsh.
  const sep = platform === 'win32' ? ';' : ' &&';
  return `cd "${dir}"${sep} claude --resume ${s.id}`;
}

export class SessionService {
  readonly transcripts = new TranscriptStore(config.projectsDir, config.lookbackDays);
  readonly state = new AppState(config.dataDir);
  private live = new Map<string, LiveProcess>();

  async refresh(): Promise<void> {
    await this.transcripts.refresh();
    this.live = await readLiveRegistry(config.liveRegistryDir);
  }

  summarize(s: ParsedSession, now = Date.now()): SessionSummary {
    const archivedAt = this.state.archivedAt(s.id);
    const st = computeStatus(signalsFromTranscript(s, archivedAt !== undefined), now, config.status);
    const lt = s.recentTools.at(-1);
    return {
      id: s.id,
      title: titleOf(s),
      projectPath: projectPathOf(s),
      projectName: projectNameOf(s),
      gitBranch: s.gitBranch,
      model: s.model,
      version: s.version,
      status: st.status,
      statusReason: st.reason,
      idleKind: st.idleKind,
      startedAt: iso(s.startedAt),
      lastActivityAt: iso(s.lastActivityAt),
      lastActivityAgoSec: s.lastActivityAt === undefined ? undefined : Math.max(0, Math.round((now - s.lastActivityAt) / 1000)),
      archived: archivedAt !== undefined,
      archivedAt,
      process: this.live.get(s.id) ?? null,
      counts: { ...s.counts },
      lastTool: lt ? { name: lt.name, summary: lt.summary, outcome: lt.outcome, at: iso(lt.endedAt ?? lt.startedAt)! } : null,
      resumeCommand: resumeCommand(s),
    };
  }

  list(now = Date.now()): SessionSummary[] {
    return this.transcripts
      .sessions()
      .map((s) => this.summarize(s, now))
      .sort((a, b) => ORDER[a.status] - ORDER[b.status] || (b.lastActivityAt ?? '').localeCompare(a.lastActivityAt ?? ''));
  }

  detail(id: string, now = Date.now()): SessionDetail | undefined {
    const s = this.transcripts.get(id);
    if (!s) return undefined;
    return {
      ...this.summarize(s, now),
      transcriptFile: s.file,
      recentTools: [...s.recentTools].reverse().map((t) => ({ ...t, startedAt: iso(t.startedAt)!, endedAt: iso(t.endedAt) })),
      messages: [...s.messages].reverse().map((m) => ({ role: m.role, text: m.text, at: iso(m.ts)! })),
      timeline: [...s.timeline].reverse().map((e) => ({ at: iso(e.ts)!, kind: e.kind, label: e.label, source: e.source })),
    };
  }
}
