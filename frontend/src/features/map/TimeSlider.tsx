import type { TimePeriod } from '../../types'

export interface TimeSliderProps {
  periods: TimePeriod[]
  value: TimePeriod | null
  onChange: (period: TimePeriod) => void
}

export function formatPeriod(p: TimePeriod): string {
  return p.month != null ? `${p.year}-${String(p.month).padStart(2, '0')}` : String(p.year)
}

export default function TimeSlider({ periods, value, onChange }: TimeSliderProps) {
  if (periods.length === 0 || value == null) {
    return <div className="year-slider muted">Нет доступных периодов</div>
  }
  const found = periods.findIndex(
    (p) => p.year === value.year && (p.month ?? null) === (value.month ?? null),
  )
  if (found === -1) {
    console.warn('[TimeSlider] value not in periods:', value)
    return <div className="year-slider muted">Нет данных за выбранный период</div>
  }
  const idx = found
  return (
    <div className="time-slider">
      <div className="year-slider">
        <span className="current">{formatPeriod(periods[idx])}</span>
        <input
          type="range"
          min={0}
          max={periods.length - 1}
          step={1}
          value={idx}
          aria-label="Период"
          aria-valuetext={formatPeriod(periods[idx])}
          onChange={(e) => onChange(periods[Number(e.target.value)])}
        />
      </div>
      <div className="year-ticks">
        {periods.map((p) => {
          const active = p.year === value.year && (p.month ?? null) === (value.month ?? null)
          return (
            <button key={formatPeriod(p)} type="button" className={active ? 'active' : ''} aria-pressed={active} onClick={() => onChange(p)}>
              {formatPeriod(p)}
            </button>
          )
        })}
      </div>
    </div>
  )
}
