import type { CSSProperties } from 'react'
import type { TimePeriod } from '../../types'

export interface TimeSliderProps {
  periods: TimePeriod[]
  value: TimePeriod | null
  onChange: (period: TimePeriod) => void
}

export function formatPeriod(p: TimePeriod): string {
  return p.month != null ? `${p.year}-${String(p.month).padStart(2, '0')}` : String(p.year)
}

const monthName = new Intl.DateTimeFormat('ru-RU', { month: 'long', timeZone: 'UTC' })

export function formatPeriodTitle(period: TimePeriod): string {
  if (period.month === 0) return `${period.year} · газеты за год`
  if (period.month === null) return String(period.year)
  const month = monthName.format(new Date(Date.UTC(2000, period.month - 1, 1)))
  return month.charAt(0).toUpperCase() + month.slice(1) + ' ' + period.year
}

export default function TimeSlider({ periods, value, onChange }: TimeSliderProps) {
  const index = periods.findIndex((p) => p.year === value?.year && p.month === value?.month)
  if (!value || index === -1) return <div className="year-slider muted">Нет доступных периодов</div>

  const last = periods.length - 1
  const interval = Math.max(1, Math.ceil(last / 6))
  const ticks = periods.flatMap((period, position) =>
    position % interval === 0 || position === last ? [{ period, position }] : [])
  const progress = last > 0 ? index / last * 100 : 0
  const label = formatPeriodTitle(value)

  return (
    <div className="time-slider" role="group" aria-label="Периоды карты">
      <div className="timeline-header">
        <div className="timeline-current">
          <span>Период карты</span>
          <strong>{label}</strong>
        </div>
        <div className="timeline-stepper">
          <button type="button" aria-label="Предыдущий период" disabled={index === 0}
            onClick={() => onChange(periods[index - 1])}>
            <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m12 5-5 5 5 5" /></svg>
          </button>
          <button type="button" aria-label="Следующий период" disabled={index === last}
            onClick={() => onChange(periods[index + 1])}>
            <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m8 5 5 5-5 5" /></svg>
          </button>
        </div>
      </div>
      <input type="range" min={0} max={last} step={1} value={index} disabled={last === 0}
        aria-label="Период" aria-valuetext={formatPeriod(value)}
        style={{ '--timeline-progress': `${progress}%` } as CSSProperties}
        onChange={(e) => onChange(periods[e.target.valueAsNumber])} />
      <div className="timeline-ticks">
        {ticks.map(({ period, position }) => (
          <button key={formatPeriod(period)} type="button" aria-pressed={position === index}
            onClick={() => onChange(period)}>{period.month === 0 ? `${period.year} · год` : formatPeriod(period)}</button>
        ))}
      </div>
    </div>
  )
}
