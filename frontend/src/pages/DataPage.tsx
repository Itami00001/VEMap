import { useEffect, useMemo, useState } from 'react'
import { api } from '../services/api'
import type { CityDataRow, TimePeriod } from '../types'
import Filters from '../features/data/Filters'
import RegionTable from '../features/data/RegionTable'
import DemoBadge from '../features/map/DemoBadge'

export default function DataPage() {
  const [periods, setPeriods] = useState<TimePeriod[]>([])
  const [period, setPeriod] = useState<TimePeriod | null>(null)
  const [rows, setRows] = useState<CityDataRow[]>([])
  const [query, setQuery] = useState('')
  const [sortKey, setSortKey] = useState<'name' | 'mood' | 'change'>('name')
  const [sortDir, setSortDir] = useState<1 | -1>(1)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    api.getPeriods(controller.signal)
      .then((items) => {
        setPeriods(items)
        setPeriod(items.at(-1) ?? null)
      })
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === 'AbortError') return
        setError(e instanceof Error ? e.message : String(e))
      })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (!period) return
    const controller = new AbortController()
    api.getCityTable(period.year, period.month, controller.signal)
      .then(setRows)
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === 'AbortError') return
        setError(e instanceof Error ? e.message : String(e))
      })
    return () => controller.abort()
  }, [period])

  const view = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = q
      ? rows.filter((r) => r.name_ru.toLowerCase().includes(q) || r.region_name.toLowerCase().includes(q))
      : [...rows]
    const val = (r: CityDataRow): number | string => {
      if (sortKey === 'mood') return r.mood_index ?? Number.NEGATIVE_INFINITY
      if (sortKey === 'change') return r.change_from_prev ?? Number.NEGATIVE_INFINITY
      return r.name_ru
    }
    filtered.sort((a, b) => {
      const va = val(a)
      const vb = val(b)
      if (typeof va === 'string' && typeof vb === 'string') return sortDir * va.localeCompare(vb, 'ru')
      return sortDir * (Number(va) - Number(vb))
    })
    return filtered
  }, [rows, query, sortKey, sortDir])

  const onSort = (k: 'name' | 'mood' | 'change') => {
    if (k === sortKey) {
      setSortDir((d) => (d === 1 ? -1 : 1))
    } else {
      setSortKey(k)
      setSortDir(1)
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Данные</h1>
          <p>Публичные значения Mood Index по городам. <DemoBadge /></p>
        </div>
      </div>
      {error && <div className="alert error">Ошибка загрузки данных: {error}</div>}
      <Filters periods={periods} period={period} onPeriod={setPeriod} query={query} onQuery={setQuery} />
      <RegionTable rows={view} sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
    </div>
  )
}
