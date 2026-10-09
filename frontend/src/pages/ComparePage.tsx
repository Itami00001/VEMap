import { useEffect, useMemo, useState } from 'react'
import { api } from '../services/api'
import type { CityCompareRow, MapPoint, Region, TimePeriod } from '../types'
import CompareYears from '../features/data/CompareYears'
import MapView from '../features/map/MapView'
import DemoBadge from '../features/map/DemoBadge'

export default function ComparePage() {
  const [periods, setPeriods] = useState<TimePeriod[]>([])
  const [periodA, setPeriodA] = useState<TimePeriod | null>(null)
  const [periodB, setPeriodB] = useState<TimePeriod | null>(null)
  const [mode, setMode] = useState<'absolute' | 'delta'>('delta')
  const [rows, setRows] = useState<CityCompareRow[]>([])
  const [regions, setRegions] = useState<Region[]>([])
  const [mapB, setMapB] = useState<Record<string, MapPoint>>({})
  const [delta, setDelta] = useState<Record<string, number | null>>({})
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    api.getPeriods(controller.signal)
      .then((items) => {
        setPeriods(items)
        setPeriodA(items[0] ?? null)
        setPeriodB(items.at(-1) ?? null)
      })
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === 'AbortError') return
        setError(e instanceof Error ? e.message : String(e))
      })
    api.getRegions(controller.signal).then(setRegions).catch(() => undefined)
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (!periodA || !periodB) return
    const controller = new AbortController()
    api.getCityCompare(periodA, periodB, controller.signal).then(setRows).catch((e: unknown) => {
      if (e instanceof DOMException && e.name === 'AbortError') return
      setError(e instanceof Error ? e.message : String(e))
    })
    api.getRegionCompare(periodA, periodB, controller.signal)
      .then((ds) => {
        const map: Record<string, number | null> = {}
        for (const d of ds) map[d.region_id] = d.delta
        setDelta(map)
      })
      .catch(() => undefined)
    api.getMapPoints(periodB.year, periodB.month, controller.signal)
      .then((pts) => {
        const map: Record<string, MapPoint> = {}
        for (const p of pts) map[p.region_id] = p
        setMapB(map)
      })
      .catch(() => undefined)
    return () => controller.abort()
  }, [periodA, periodB])

  const values = useMemo(() => {
    const v: Record<string, number | null> = {}
    for (const r of regions) {
      v[r.region_id] = mode === 'delta' ? (delta[r.region_id] ?? null) : (mapB[r.region_id]?.mood_index ?? null)
    }
    return v
  }, [regions, mode, delta, mapB])

  const fmt = (v: number | null) => (v == null ? '—' : v.toFixed(1));

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Сравнение периодов</h1>
          <p>Изменение Mood Index между двумя существующими периодами. <DemoBadge /></p>
        </div>
      </div>
      {error && <div className="alert error">Ошибка загрузки данных: {error}</div>}
      <CompareYears
        periods={periods}
        periodA={periodA}
        periodB={periodB}
        onA={setPeriodA}
        onB={setPeriodB}
        mode={mode}
        onMode={setMode}
      />
      <div className="map-shell" style={{ marginBottom: 18 }}>
        <MapView values={values} mode={mode === 'delta' ? 'delta' : 'mood'} interactive={false} />
        <div className="map-overlay-top">
          <span className="muted" style={{ fontSize: 12 }}>
            {mode === 'delta' ? 'Синий — рост, красный — падение, серый — нет данных' : 'Абсолютные значения периода B, серый — нет данных'}
          </span>
        </div>
      </div>
      <table className="data-table">
        <thead>
          <tr>
            <th>Город</th>
            <th>A</th>
            <th>B</th>
            <th>Δ (B − A)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.city_id}>
              <td>{r.name_ru}</td>
              <td>{fmt(r.mood_a)}</td>
              <td>{fmt(r.mood_b)}</td>
              <td><b>{r.delta == null ? '—' : `${r.delta > 0 ? '+' : ''}${r.delta.toFixed(1)}`}</b></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
