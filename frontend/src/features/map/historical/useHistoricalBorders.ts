import { useMemo } from 'react'
import { historicalRangeForYear, type HistoricalRange } from './historicalBorders'

// По текущему году — диапазон с URL границ. Год неизвестен — null.
export function useHistoricalBorders(year: number | null): HistoricalRange | null {
  return useMemo(() => historicalRangeForYear(year), [year])
}
