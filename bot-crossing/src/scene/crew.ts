import type { Pose } from './Worker.tsx';

type CrewInput = {
  status: 'working' | 'needs_you' | 'blocked' | 'idle' | 'shipped';
  lastActivityAt?: string;
  live?: { subagents: number; closed: boolean };
};

const SIX_HOURS = 6 * 3600_000;

/**
 * Who stands around the building, and doing what. Angles are in the building's local frame.
 * Every session still in the colony keeps at least one bot, so no building looks abandoned;
 * only shipped (archived) sessions are empty and show a flag instead.
 */
export function crewFor(s: CrewInput, now = Date.now()): { pose: Pose; slots: number[] } {
  if (s.status === 'shipped') return { pose: 'sit', slots: [] };
  switch (s.status) {
    case 'working': {
      const extra = Math.min(3, s.live?.subagents ?? 0); // one more worker per running subagent
      return { pose: 'hammer', slots: [0.6, -0.75, 2.4, -2.3, 3.1].slice(0, 2 + extra) };
    }
    case 'needs_you':
      return { pose: 'wave', slots: [0.5, -0.5] };
    case 'blocked':
      return { pose: 'scratch', slots: [0.7, -0.8] };
    case 'idle': {
      const quietFor = s.lastActivityAt ? now - Date.parse(s.lastActivityAt) : Infinity;
      // Recently active: two bots resting. Quiet for long or terminal closed: one bot dozing by the door.
      return { pose: 'sit', slots: quietFor < SIX_HOURS && !s.live?.closed ? [0.5, -0.55] : [0.5] };
    }
  }
}
