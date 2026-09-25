export interface YearSliderProps {
  years: number[]
  value: number | null
  onChange: (year: number) => void
}

export default function YearSlider({ years, value, onChange }: YearSliderProps) {
  if (years.length === 0 || value == null) {
    return <div className="year-slider muted">Нет годов с данными</div>
  }
  const idx = Math.max(0, years.indexOf(value))
  return (
    <div>
      <div className="year-slider">
        <span className="current">{years[idx]}</span>
        <input
          type="range"
          min={0}
          max={years.length - 1}
          step={1}
          value={idx}
          onChange={(e) => onChange(years[Number(e.target.value)])}
        />
      </div>
      <div className="year-ticks">
        {years.map((y) => (
          <button key={y} type="button" className={y === value ? 'active' : ''} onClick={() => onChange(y)}>
            {y}
          </button>
        ))}
      </div>
    </div>
  )
}
