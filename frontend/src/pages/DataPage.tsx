import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../services/api'
import type { CityDataRow, TimePeriod } from '../types'
import Filters from '../features/data/Filters'
import RegionTable from '../features/data/RegionTable'
import DemoBadge from '../features/map/DemoBadge'
import { formatPeriod } from '../features/map/TimeSlider'

function csvCell(value: string | number | null) {
  if (value == null) return ''
  if (typeof value === 'number') return String(value)
  const safe = /^[\s]*[=+@-]/.test(value) ? "'" + value : value
  return '"' + safe.replaceAll('"', '""') + '"'
}

export default function DataPage() {
  const [periods, setPeriods] = useState<TimePeriod[]>([])
  const [period, setPeriod] = useState<TimePeriod | null>(null)
  const [result, setResult] = useState<{ key: string; rows: CityDataRow[] } | null>(null)
  const [query, setQuery] = useState('')
  const [sortKey, setSortKey] = useState<'name' | 'mood' | 'change'>('name')
  const [sortDir, setSortDir] = useState<1 | -1>(1)
  const [error, setError] = useState<string | null>(null)
  const [search] = useSearchParams()
  const region = search.get('region')
  const key = period ? formatPeriod(period) : null

  useEffect(() => {
    const controller = new AbortController()
    api.getPeriods(controller.signal)
      .then((items) => {
        setPeriods(items)
        // Старт с самого богатого периода (1905-01, все 14 городов),
        // иначе дефолт-последний показывает только Крым.
        setPeriod(items.find((p) => p.year === 1905 && p.month === 1) ?? items.at(-1) ?? null)
      })
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === 'AbortError') return
        setError(e instanceof Error ? e.message : String(e))
      })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (!period || !key) return
    const controller = new AbortController()
    api.getCityTable(period.year, period.month, controller.signal)
      .then((rows) => {
        if (!controller.signal.aborted) setResult({ key, rows })
      })
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === 'AbortError') return
        setError(e instanceof Error ? e.message : String(e))
      })
    return () => controller.abort()
  }, [key, period])

  const view = useMemo(() => {
    const q = query.trim().toLowerCase()
    const rows = result?.key === key ? result.rows : []
    const filtered = rows.filter((r) => (!region || r.region_id === region) &&
      (!q || r.name_ru.toLowerCase().includes(q) || r.region_name.toLowerCase().includes(q)))
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
  }, [key, query, region, result, sortKey, sortDir])

  const onSort = (k: 'name' | 'mood' | 'change') => {
    if (k === sortKey) {
      setSortDir((d) => (d === 1 ? -1 : 1))
    } else {
      setSortKey(k)
      setSortDir(1)
    }
  }

  function download() {
    const columns = ['Город', 'Регион', 'Период', 'Индекс настроения', 'Объём выборки', 'Изменение']
    const csv = [columns, ...view.map((r) => [r.name_ru, r.region_name, key,
      r.mood_index, r.responses_count, r.change_from_prev])].map((row) => row.map(csvCell).join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `vemap-${key}.csv`
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <section aria-label="Данные по городам">
      <p>Индекс настроения и объём выборки по городам. <DemoBadge /></p>
      {error && <div className="alert error">Ошибка загрузки данных: {error}</div>}
      <div className="atlas-data-tools">
        <Filters periods={periods} period={period} onPeriod={(item) => { setError(null); setPeriod(item) }}
          query={query} onQuery={setQuery} />
        <button className="btn primary" type="button" disabled={!view.length} onClick={download}>Скачать CSV</button>
      </div>
      {!error && result?.key !== key && <p role="status">Загрузка данных…</p>}
      {result?.key === key && !view.length && <p>По этим фильтрам нет данных.</p>}
      <div className="atlas-data-table">
        <RegionTable rows={view} sortKey={sortKey} sortDir={sortDir} onSort={onSort} period={key} />
      </div>
    </section>
  )
}
