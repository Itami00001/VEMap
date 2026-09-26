import type { TimePeriod } from '../../types'
import { periodLabel } from './Filters'

export interface CompareYearsProps {
  periods: TimePeriod[]
  periodA: TimePeriod | null
  periodB: TimePeriod | null
  onA: (p: TimePeriod) => void
  onB: (p: TimePeriod) => void
  mode: 'absolute' | 'delta'
  onMode: (m: 'absolute' | 'delta') => void
}

function Select({ label, periods, value, onChange }: { label: string; periods: TimePeriod[]; value: TimePeriod | null; onChange: (p: TimePeriod) => void }) {
  return (
    <label>
      {label}{' '}
      <select
        value={value ? periodLabel(value) : ''}
        onChange={(e) => {
          const found = periods.find((p) => periodLabel(p) === e.target.value)
          if (found) onChange(found)
        }}
      >
        {periods.map((p) => (
          <option key={periodLabel(p)} value={periodLabel(p)}>{periodLabel(p)}</option>
        ))}
      </select>
    </label>
  )
}

export default function CompareYears({ periods, periodA, periodB, onA, onB, mode, onMode }: CompareYearsProps) {
  return (
    <div className="filters">
      <Select label="Период A" periods={periods} value={periodA} onChange={onA} />
      <Select label="Период B" periods={periods} value={periodB} onChange={onB} />
      <div role="group" aria-label="Режим карты">
        <button type="button" className={mode === 'absolute' ? 'active' : ''} onClick={() => onMode('absolute')}>
          Абсолют
        </button>{' '}
        <button type="button" className={mode === 'delta' ? 'active' : ''} onClick={() => onMode('delta')}>
          Изменение
        </button>
      </div>
    </div>
  )
}
