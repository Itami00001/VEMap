import { useMemo } from 'react'
import { historicalUrlForYear } from './historicalBorders'

// По текущему году — URL границ. Год неизвестен — null (не грузим).
// Вне известных диапазонов — fallback.
export function useHistoricalBorders(year: number | null): string | null {
  return useMemo(() => historicalUrlForYear(year), [year])
}
