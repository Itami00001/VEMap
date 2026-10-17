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

export function historicalUrlForYear(year: number | null): string | null {
  // year === null (period ещё не загружен): не рисуем ничего.
  // Нет снимка для года (1917/1991/2026) — тоже null: показываем
  // современные границы. Раньше здесь был fallback на 1905, из-за чего
  // 1917/1991/2026 рисовались как Российская империя 1905 года.
  if (year == null) return null
  const hit = HISTORICAL_BORDERS.find((r) => year >= r.fromYear && year <= r.toYear)
  return hit ? hit.geojsonUrl : null
}
