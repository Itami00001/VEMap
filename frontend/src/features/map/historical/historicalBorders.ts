// Конфиг исторических границ. Расширение (новый год) —
// одна строка в HISTORICAL_BORDERS, MapView править не нужно.
export interface HistoricalRange {
  fromYear: number
  toYear: number
  geojsonUrl: string
  label: string
  // true — снимок совпадает с современным контуром РФ (1991/2026):
  // современные белые границы РФ/Крыма НЕ приглушаются.
  keepModernHighlight?: boolean
}

export const HISTORICAL_BORDERS: HistoricalRange[] = [
  { fromYear: 1904, toYear: 1904, geojsonUrl: '/data/geo/historical/empire-1904.geojson', label: 'Российская империя — весь Сахалин (1904)' },
  { fromYear: 1905, toYear: 1905, geojsonUrl: '/data/geo/historical/empire-1905.geojson', label: 'Российская империя — юг Сахалина у Японии (1905)' },
  { fromYear: 1917, toYear: 1917, geojsonUrl: '/data/geo/historical/empire-1917.geojson', label: 'Российская республика/РСФСР — юг Сахалина у Японии (1917)' },
  { fromYear: 1991, toYear: 2026, geojsonUrl: '/data/geo/historical/empire-1991.geojson', label: 'Российская Федерация (+Крым, Севастополь)', keepModernHighlight: true },
]

export function historicalRangeForYear(year: number | null): HistoricalRange | null {
  // year === null (period ещё не загружен) или нет снимка — null:
  // рисуем современные границы.
  if (year == null) return null
  return HISTORICAL_BORDERS.find((r) => year >= r.fromYear && year <= r.toYear) ?? null
}
