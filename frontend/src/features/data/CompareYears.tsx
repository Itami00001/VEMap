import type { TimePeriod } from '../../types'
import { periodLabel } from './Filters'
import { formatPeriodTitle } from '../map/TimeSlider'

export interface CompareYearsProps {
  periods: TimePeriod[]
  periodA: TimePeriod | null
  periodB: TimePeriod | null
  onA: (p: TimePeriod) => void
  onB: (p: TimePeriod) => void
  onSwap: () => void
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
          <option key={periodLabel(p)} value={periodLabel(p)}>{p.month === 0 ? formatPeriodTitle(p) : periodLabel(p)}</option>
        ))}
      </select>
    </label>
  )
}

export default function CompareYears({ periods, periodA, periodB, onA, onB, onSwap }: CompareYearsProps) {
  return (
    <div className="filters">
      <Select label="Период A" periods={periods} value={periodA} onChange={onA} />
      <Select label="Период B" periods={periods} value={periodB} onChange={onB} />
      <button type="button" className="btn" disabled={!periodA || !periodB} onClick={onSwap}>Поменять A и B</button>
    </div>
  )
}
