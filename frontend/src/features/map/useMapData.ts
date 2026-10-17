import { useEffect, useRef, useState } from 'react'
import { api } from '../../services/api'
import type { MapPoint, TimePeriod } from '../../types'

export function useMapData() {
  const [periods, setPeriods] = useState<TimePeriod[]>([])
  const [period, setPeriod] = useState<TimePeriod | null>(null)
  const [points, setPoints] = useState<Record<string, MapPoint>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const cache = useRef<Map<string, Record<string, MapPoint>>>(new Map())

  useEffect(() => {
    const controller = new AbortController()
    api.getPeriods(controller.signal).then((items) => {
      setPeriods(items)
      setPeriod(items.at(-1) ?? null)
      setLoading(false)
      console.log('[VEMap] periods loaded', items.length, items[0], items.at(-1))
    }).catch((e: unknown) => {
      if (e instanceof DOMException && e.name === 'AbortError') return
      setError(e instanceof Error ? e.message : String(e))
      setLoading(false)
    })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (!period) return
    const key = `${period.year}-${period.month ?? 'y'}`
    const cached = cache.current.get(key)
    if (cached) { setPoints(cached); return }
    const controller = new AbortController()
    api.getMapPoints(period.year, period.month, controller.signal).then((items) => {
      const map: Record<string, MapPoint> = {}
      items.forEach((item) => { map[item.region_id] = item })
      cache.current.set(key, map)
      setPoints(map)
    }).catch((e: unknown) => {
      if (e instanceof DOMException && e.name === 'AbortError') return
      setError(e instanceof Error ? e.message : String(e))
    })
    return () => controller.abort()
  }, [period])

  return { periods, period, setPeriod, years: [...new Set(periods.map((p) => p.year))], year: period?.year ?? null, setYear: (year: number) => setPeriod(periods.find((p) => p.year === year) ?? null), points, loading, error }
}
