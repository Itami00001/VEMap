// Конфиг исторических границ. Расширение (новый год) —
// одна строка в HISTORICAL_BORDERS, MapView править не нужно.
export interface HistoricalRange {
  geojsonUrl: string
  label: string
  keepModernHighlight?: boolean
  historical?: boolean
  imperial?: boolean
}

const BASE = import.meta.env.BASE_URL + 'data/geo/historical/'
const START_DATES = [
  '1886-01-01', '1905-09-05', '1914-04-17', '1917-12-06',
  '1918-02-16', '1918-03-03', '1918-03-11', '1918-11-11',
]

export function historicalRangeForYear(year: number | null, month: number | null): HistoricalRange | null {
  if (year == null) return null
  if (year >= 1991 && year <= 2026) return {
    geojsonUrl: BASE + 'empire-1991.geojson',
    label: 'Российская Федерация', keepModernHighlight: true,
  }
  if (year < 1900 || year > 1919) return null
  // Use the midpoint of a monthly period and the last date of an annual period.
  const at = month ? `${year}-${String(month).padStart(2, '0')}-15` : `${year}-12-31`
  const from = [...START_DATES].reverse().find((start) => start <= at)
  const imperial = at < '1917-03-15'
  const state = imperial ? 'Российская империя' : at < '1917-09-14' ? 'Россия при Временном правительстве'
    : at < '1917-11-07' ? 'Российская республика' : 'Советская Россия'
  return { geojsonUrl: BASE + `cshapes-${from}.geojson`, label: `${state} · ${at}`, historical: true, imperial }
}
