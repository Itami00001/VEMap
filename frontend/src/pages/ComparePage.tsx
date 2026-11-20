import { useEffect, useMemo, useRef, useState } from 'react'
import { Marker } from 'maplibre-gl'
import type { Map as LibreMap } from 'maplibre-gl'
import { api, newspaperUrl } from '../services/api'
import type { Comparison, ComparisonObservation, ComparisonRow, TimePeriod } from '../types'
import CompareYears from '../features/data/CompareYears'
import MapView from '../features/map/MapView'
import { sentimentColor } from '../features/map/color'
import DemoBadge from '../features/map/DemoBadge'

const MAP_CENTER: [number, number] = [36, 49]
const EMPTY_ROWS: ComparisonRow[] = []
const DELTA_LABEL = {
  comparable: '',
  different_methods: 'Разные методики',
  only_a: 'Только A',
  only_b: 'Только B',
}
const formatter = new Intl.NumberFormat('ru', { maximumFractionDigits: 2 })

function valueLabel(value: number | undefined) {
  return value === undefined ? '—' : formatter.format(value)
}

function difference(row: ComparisonRow) {
  if (row.delta === null) return DELTA_LABEL[row.status]
  return (row.delta > 0 ? '+' : '') + formatter.format(row.delta)
}

function ObservationDetails({ label, observation }: { label: string; observation: ComparisonObservation | null }) {
  return (
    <div>
      <h3>{label}</h3>
      {observation ? (
        <>
          <strong>{valueLabel(observation.value)}</strong>
          <p>{observation.method}{observation.count !== null && ' · ' + observation.count + ' (' + observation.unit + ')'}</p>
          {observation.sources.length > 0 && (
            <ul>{observation.sources.map(({ id, source_page: page, title, available }, index) => (
              <li key={id + ':' + page + ':' + index}>
                {available
                  ? <a href={newspaperUrl(id, page)} target="_blank" rel="noreferrer">{title}, стр. {page}</a>
                  : <span>{title}, стр. {page} · PDF не найден</span>}
              </li>
            ))}</ul>
          )}
        </>
      ) : <p className="muted">Нет данных</p>}
    </div>
  )
}

export default function ComparePage() {
  const [comparison, setComparison] = useState<Comparison | null>(null)
  const [pair, setPair] = useState<[TimePeriod, TimePeriod] | null>(null)
  const [scope, setScope] = useState<'cities' | 'regions' | null>(null)
  const [mode, setMode] = useState<'delta' | 'a' | 'b'>('delta')
  const [mobileView, setMobileView] = useState<'list' | 'map'>('list')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [map, setMap] = useState<LibreMap | null>(null)
  const markersById = useRef(new Map<string, Marker>())
  const [error, setError] = useState<string | null>(null)
  const matchesPair = comparison && (!pair || (
    comparison.period_a?.year === pair[0].year && comparison.period_a.month === pair[0].month &&
    comparison.period_b?.year === pair[1].year && comparison.period_b.month === pair[1].month
  ))
  const current = matchesPair ? comparison : null
  const a = pair?.[0] ?? comparison?.period_a ?? null
  const b = pair?.[1] ?? comparison?.period_b ?? null
  const defaultScope = current?.cities.length ? 'cities' : 'regions'
  const activeScope = scope && current?.[scope].length ? scope : defaultScope
  const rows = current?.[activeScope] ?? EMPTY_ROWS
  const ranked = useMemo(() => [...rows].sort((left, right) =>
    Number(left.delta === null) - Number(right.delta === null) ||
    Math.abs(right.delta ?? 0) - Math.abs(left.delta ?? 0) ||
    left.name.localeCompare(right.name, 'ru')), [rows])
  const selected = rows.find((row) => row.id === selectedId)
  const hasDelta = rows.some((row) => row.delta !== null)
  const hasA = rows.some((row) => row.a !== null)
  const hasB = rows.some((row) => row.b !== null)
  const availableModes = { delta: hasDelta, a: hasA, b: hasB }
  const activeMode = availableModes[mode] ? mode : hasB ? 'b' : 'a'
  const deltaScale = Math.max(1, ...rows.map((row) => Math.abs(row.delta ?? 0)))
  const values = useMemo(() => activeScope === 'regions'
    ? Object.fromEntries(rows.map((row) => [row.id, activeMode === 'delta' ? row.delta : row[activeMode]?.value ?? null]))
    : {}, [activeScope, activeMode, rows])

  useEffect(() => {
    const controller = new AbortController()
    api.getComparison(controller.signal, pair?.[0], pair?.[1])
      .then((result) => { if (!controller.signal.aborted) setComparison(result) })
      .catch(() => { if (!controller.signal.aborted) setError('Не удалось загрузить сравнение периодов.') })
    return () => controller.abort()
  }, [pair])

  useEffect(() => {
    if (!map || activeScope !== 'cities') return
    const markers = markersById.current
    for (const row of rows) {
      if (row.lat == null || row.lon == null) continue
      const point = document.createElement('button')
      point.type = 'button'
      point.className = 'compare-marker'
      const value = activeMode === 'delta' ? row.delta : row[activeMode]?.value
      const color = value == null ? '#6b7786' : activeMode !== 'delta' ? sentimentColor(value / 100)
        : value > 0 ? '#559aff' : value < 0 ? '#f16b70' : '#8b99a8'
      point.style.backgroundColor = color
      point.setAttribute('aria-label', row.name + ', ' + (activeMode === 'delta' ? difference(row) : value == null ? 'Нет данных' : valueLabel(value)))
      point.title = point.getAttribute('aria-label') ?? ''
      point.addEventListener('click', (event) => { event.stopPropagation(); setSelectedId(row.id) })
      markers.set(row.id, new Marker({ element: point }).setLngLat([row.lon, row.lat]).addTo(map))
    }
    return () => {
      markers.forEach((marker) => marker.remove())
      markers.clear()
    }
  }, [map, rows, activeScope, activeMode])

  useEffect(() => {
    for (const [id, marker] of markersById.current) {
      const point = marker.getElement()
      point.classList.toggle('is-selected', id === selectedId)
      point.setAttribute('aria-pressed', String(id === selectedId))
    }
  }, [map, rows, activeScope, activeMode, selectedId])

  function changePair(nextA: TimePeriod, nextB: TimePeriod) {
    if (a?.year === nextA.year && a.month === nextA.month && b?.year === nextB.year && b.month === nextB.month) return
    setSelectedId(null)
    setError(null)
    setPair([nextA, nextB])
  }

  function selectRow(row: ComparisonRow) {
    setSelectedId(row.id)
    if (row.lat != null && row.lon != null) map?.easeTo({ center: [row.lon, row.lat] })
  }

  return (
    <div className="page compare-page">
      <div className="page-head">
        <div><h1>Сравнение периодов</h1><p>Оценки A и B и изменение в пунктах Mood Index. <DemoBadge /></p></div>
      </div>
      <CompareYears periods={comparison?.periods ?? []} periodA={a} periodB={b}
        onA={(next) => { if (b) changePair(next, b) }} onB={(next) => { if (a) changePair(a, next) }}
        onSwap={() => { if (a && b) changePair(b, a) }} />
      <div className="compare-controls">
        <div role="group" aria-label="География">
          {(['cities', 'regions'] as const).map((option) => (
            <button className="btn" key={option} type="button" aria-pressed={activeScope === option}
              disabled={!current?.[option].length}
              onClick={() => { setScope(option); setSelectedId(null) }}>{option === 'cities' ? 'Города' : 'Регионы'}</button>
          ))}
        </div>
        <div role="group" aria-label="Значения на карте">
          <button className="btn" type="button" aria-pressed={activeMode === 'delta'}
            disabled={!hasDelta} onClick={() => setMode('delta')}>Изменение</button>
          <button className="btn" type="button" aria-pressed={activeMode === 'a'} disabled={!hasA} onClick={() => setMode('a')}>Период A</button>
          <button className="btn" type="button" aria-pressed={activeMode === 'b'} disabled={!hasB} onClick={() => setMode('b')}>Период B</button>
        </div>
        <div className="compare-mobile-tabs" role="group" aria-label="Представление">
          <button className="btn" type="button" aria-pressed={mobileView === 'list'} onClick={() => setMobileView('list')}>Список</button>
          <button className="btn" type="button" aria-pressed={mobileView === 'map'} onClick={() => setMobileView('map')}>Карта</button>
        </div>
      </div>
      {error && <p className="alert error" role="alert">{error}</p>}
      {!current && !error && <p role="status">Загрузка сравнения…</p>}
      {current && !rows.length && <p className="muted">Для выбранных периодов на этом уровне нет данных.</p>}
      {rows.some((row) => row.status === 'different_methods') &&
        <p className="compare-notice">Для оценок, рассчитанных по разным методикам, показаны A и B. Дельта скрыта.</p>}
      {selected && (
        <section className="compare-detail" aria-label={'Подробности: ' + selected.name}>
          <h2>{selected.name} · {difference(selected)}{selected.delta !== null && ' п.'}</h2>
          <ObservationDetails label="Период A" observation={selected.a} />
          <ObservationDetails label="Период B" observation={selected.b} />
        </section>
      )}
      <div className={'compare-workspace compare-show-' + mobileView}>
        <section className="compare-map-view" aria-label="Карта сравнения">
          <div className="map-shell">
            <MapView values={values} mode={activeMode === 'delta' ? 'delta' : 'mood'}
              initialCenter={MAP_CENTER} onMapReady={setMap}
              onRegionClick={activeScope === 'regions' ? setSelectedId : undefined} />
          </div>
          <p className="muted">{activeMode === 'delta' ? 'Красный − · синий + · серый: ноль или нет сравнимой пары. Точные значения — в списке.'
            : 'Карта показывает оценки выбранного периода.'}</p>
        </section>
        <section className="compare-list-view" aria-label="Результаты сравнения">
          <h2>{activeScope === 'cities' ? 'Города' : 'Регионы'} <span className="muted">· {rows.length}</span></h2>
          <ul className="compare-list">
            {ranked.map((row) => (
              <li key={row.id}>
                <button type="button" aria-pressed={row.id === selectedId} onClick={() => selectRow(row)}>
                  <strong>{row.name}</strong>
                  <span>A {valueLabel(row.a?.value)} · B {valueLabel(row.b?.value)}</span>
                  {row.delta !== null && (
                    <span className="compare-bar" aria-hidden="true"><i style={{
                      width: Math.abs(row.delta) / deltaScale * 50 + '%',
                      left: (row.delta < 0 ? 50 - Math.abs(row.delta) / deltaScale * 50 : 50) + '%',
                      background: row.delta < 0 ? '#f16b70' : '#559aff',
                    }} /></span>
                  )}
                  <b>{difference(row)}{row.delta !== null && ' п.'}</b>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
