import { useMemo } from 'react'
import { historicalUrlForYear } from './historicalBorders'

// По текущему году — URL границ. Вне известных диапазонов — fallback.
export function useHistoricalBorders(year: number | null): string {
  return useMemo(() => historicalUrlForYear(year), [year])
}
