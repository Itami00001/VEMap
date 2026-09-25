import { useEffect, useRef, useState } from 'react'
import { api } from '../../services/api'
import type { MapPoint } from '../../types'

export function useMapData() {
  const [years, setYears] = useState<number[]>([])
  const [year, setYear] = useState<number | null>(null)
  const [points, setPoints] = useState<Record<string, MapPoint>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const cache = useRef<Map<number, Record<string, MapPoint>>>(new Map())

  useEffect(() => {
    let cancelled = false
    api
      .getYears()
      .then((ys) => {
        if (cancelled) return
        setYears(ys)
        if (ys.length > 0) {
          setYear(ys[ys.length - 1])
        }
        setLoading(false)
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e))
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (year == null) return
    const cached = cache.current.get(year)
    if (cached) {
      setPoints(cached)
      return
    }
    let cancelled = false
    api
      .getMapPoints(year)
      .then((pts) => {
        if (cancelled) return
        const map: Record<string, MapPoint> = {}
        for (const p of pts) map[p.region_id] = p
        cache.current.set(year, map)
        setPoints(map)
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      })
    return () => {
      cancelled = true
    }
  }, [year])

  return { years, year, setYear, points, loading, error }
}
