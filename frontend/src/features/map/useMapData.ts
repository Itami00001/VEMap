import { useEffect, useRef, useState } from 'react'
import { api } from '../../services/api'
import type { CityMood, MapPoint, TimePeriod } from '../../types'

interface PeriodData {
  points: Record<string, MapPoint>
  cityMoods: CityMood[]
}

const EMPTY_DATA: PeriodData = { points: {}, cityMoods: [] }
const PERIOD_DEBOUNCE_MS = 200

export function useMapData() {
  const [periods, setPeriods] = useState<TimePeriod[]>([])
  const [period, setPeriod] = useState<TimePeriod | null>(null)
  const [periodsLoading, setPeriodsLoading] = useState(true)
  const [periodsError, setPeriodsError] = useState<string | null>(null)
  const [result, setResult] = useState<{ key: string; data?: PeriodData; error?: string } | null>(null)
  const cache = useRef(new Map<string, PeriodData>())
  const key = period ? `${period.year}-${period.month ?? 'y'}` : null

  useEffect(() => {
    const controller = new AbortController()
    api.getPeriods(controller.signal).then((items) => {
      if (controller.signal.aborted) return
      setPeriods(items)
      setPeriod(items.at(-1) ?? null)
      setPeriodsLoading(false)
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return
      setPeriodsError(String(error))
      setPeriodsLoading(false)
    })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (!period || !key || cache.current.has(key)) return
    const controller = new AbortController()
    setResult(null)
    const timer = window.setTimeout(async () => {
      try {
        const [points, cityMoods] = await Promise.all([
          api.getMapPoints(period.year, period.month, controller.signal),
          api.getCityMoods(period.year, period.month, controller.signal),
        ])
        if (controller.signal.aborted) return
        const data = { points: Object.fromEntries(points.map((point) => [point.region_id, point])), cityMoods }
        cache.current.set(key, data)
        setResult({ key, data })
      } catch (error) {
        if (!controller.signal.aborted) setResult({ key, error: String(error) })
      }
    }, PERIOD_DEBOUNCE_MS)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [key, period])

  const current = result?.key === key ? result : null
  const data = key ? cache.current.get(key) ?? current?.data : undefined
  return {
    periods, period, setPeriod,
    ...data ?? EMPTY_DATA,
    loading: periodsLoading || (key !== null && !data && !current?.error),
    error: periodsError ?? current?.error ?? null,
  }
}
