import type { TimePeriod } from '../../types'

export interface FiltersProps {
  periods: TimePeriod[]
  period: TimePeriod | null
  onPeriod: (p: TimePeriod) => void
  query: string
  onQuery: (q: string) => void
}

export function periodLabel(p: TimePeriod): string {
  return p.month != null ? `${p.year}-${String(p.month).padStart(2, '0')}` : String(p.year)
}

export default function Filters({ periods, period, onPeriod, query, onQuery }: FiltersProps) {
  return (
    <div className="filters">
      <label>
        Период{' '}
        <select
          value={period ? periodLabel(period) : ''}
          onChange={(e) => {
            const found = periods.find((p) => periodLabel(p) === e.target.value)
            if (found) onPeriod(found)
          }}
        >
          {periods.map((p) => (
            <option key={periodLabel(p)} value={periodLabel(p)}>{periodLabel(p)}</option>
          ))}
        </select>
      </label>
      <label>
        Поиск{' '}
        <input
          type="search"
          placeholder="Город или регион…"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
        />
      </label>
    </div>
  )
}
