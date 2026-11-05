import { PHASE_ICON, PHASE_LABEL, formatHour, phaseOf } from '../scene/sky.ts';

/** Clock + slider over the 3D stage. Follows your computer's clock until you drag it. */
export function TimeControl({ hour, manual, onChange }: { hour: number; manual: boolean; onChange: (h: number | null) => void }) {
  const phase = phaseOf(hour);
  return (
    <div className={`time-control ${manual ? 'is-manual' : ''}`}>
      <span className="time-control__label" title={manual ? 'Ručně nastavený čas' : 'Podle hodin tvého počítače'}>
        {PHASE_ICON[phase]} {formatHour(hour)} · {PHASE_LABEL[phase]}
      </span>
      <input
        type="range"
        min={0}
        max={24}
        step={0.25}
        value={hour}
        aria-label="Denní doba"
        onChange={(e) => onChange(Number(e.target.value) % 24)}
      />
      {manual ? (
        <button className="btn btn--small" onClick={() => onChange(null)}>
          Podle hodin
        </button>
      ) : (
        <span className="time-control__live">živě</span>
      )}
    </div>
  );
}
