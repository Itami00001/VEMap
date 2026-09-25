// v1.1: слайдер по существующим периодам (year, month), без интерполяции.
// Совместим с YearSlider: шаг — только существующие периоды из /api/periods.
import type { TimePeriod } from '../../types'

export interface TimeSliderProps {
  periods: TimePeriod[]
  value: TimePeriod | null
  onChange: (period: TimePeriod) => void
}

function label(p: TimePeriod): string {
  return p.month != null ? `${p.year}-${String(p.month).padStart(2, '0')}` : String(p.year)
}

export default function TimeSlider({ periods, value, onChange }: TimeSliderProps) {
  if (periods.length === 0 || value == null) {
    return <div className="year-slider muted">Нет периодов с данными</div>
  }
  const idx = Math.max(
    0,
    periods.findIndex((p) => p.year === value.year && (p.month ?? null) === (value.month ?? null)),
  )
  return (
    <div>
      <div className="year-slider">
        <span className="current">{label(periods[idx])}</span>
        <input
          type="range"
          min={0}
          max={periods.length - 1}
          step={1}
          value={idx}
          onChange={(e) => onChange(periods[Number(e.target.value)])}
        />
      </div>
      <div className="year-ticks">
        {periods.map((p) => {
          const active = p.year === value.year && (p.month ?? null) === (value.month ?? null)
          return (
            <button key={label(p)} type="button" className={active ? 'active' : ''} onClick={() => onChange(p)}>
              {label(p)}
            </button>
          )
        })}
      </div>
    </div>
  )
}
