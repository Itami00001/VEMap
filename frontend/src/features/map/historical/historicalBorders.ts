// Конфиг исторических границ. Расширение (1917, 1991, 2026) —
// одна строка в HISTORICAL_BORDERS, MapView править не нужно.
export interface HistoricalRange {
  fromYear: number
  toYear: number
  geojsonUrl: string
  label: string
}

export const HISTORICAL_BORDERS: HistoricalRange[] = [
  { fromYear: 1904, toYear: 1904, geojsonUrl: '/data/geo/historical/empire-1904.geojson', label: 'Российская империя — весь Сахалин (1904)' },
  { fromYear: 1905, toYear: 1905, geojsonUrl: '/data/geo/historical/empire-1905.geojson', label: 'Российская империя — север Сахалина (1905)' },
]

export const HISTORICAL_FALLBACK_URL = '/data/geo/historical/empire-1905.geojson'

export function historicalUrlForYear(year: number | null): string | null {
  // year === null (period ещё не загружен): НЕ грузим fallback,
  // ждём настоящий год — иначе эффект не перезапустится
  // (null→fallback и 2026→fallback — одна и та же строка).
  if (year == null) return null
  const hit = HISTORICAL_BORDERS.find((r) => year >= r.fromYear && year <= r.toYear)
  return hit ? hit.geojsonUrl : HISTORICAL_FALLBACK_URL
}
