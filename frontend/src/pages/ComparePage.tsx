import { useEffect, useMemo, useRef, useState } from 'react'
import { Marker } from 'maplibre-gl'
import type { Map as LibreMap } from 'maplibre-gl'
import { api, newspaperUrl } from '../services/api'
import type { Comparison, ComparisonObservation, ComparisonRow, TimePeriod } from '../types'
import CompareYears from '../features/data/CompareYears'
import MapView, { BoundaryNote } from '../features/map/MapView'
import { sentimentColor } from '../features/map/color'
import DemoBadge from '../features/map/DemoBadge'
import { formatPeriodTitle } from '../features/map/TimeSlider'
import { moodLegend } from '../features/map/legend'

const MAP_CENTER: [number, number] = [36, 49]
const EMPTY_ROWS: ComparisonRow[] = []
const DELTA_LABEL = {
  comparable: '',
  different_methods: 'Разные методики',
  only_a: 'Только A',
  only_b: 'Только B',
}
const formatter = new Intl.NumberFormat('ru', { maximumFractionDigits: 2 })
const legend = moodLegend()

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

type MapValue = 'delta' | 'a' | 'b'

function ComparisonMap({ period, mode, scope, rows, selectedId, onSelect, onReady }: {
  period: TimePeriod | null
  mode: MapValue
  scope: 'cities' | 'regions'
  rows: ComparisonRow[]
  selectedId: string | null
  onSelect: (id: string) => void
  onReady: (map: LibreMap) => void
}) {
  const [map, setMap] = useState<LibreMap | null>(null)
  const markers = useRef(new Map<string, Marker>())
  const values = useMemo(() => scope === 'regions'
    ? Object.fromEntries(rows.map((row) => [row.id, mode === 'delta' ? row.delta : row[mode]?.value ?? null]))
    : {}, [mode, rows, scope])

  useEffect(() => {
    if (!map || scope !== 'cities') return
    const active = markers.current
    for (const row of rows) {
      if (row.lat == null || row.lon == null) continue
      const point = document.createElement('button')
      point.type = 'button'
      point.className = 'compare-marker'
      const value = mode === 'delta' ? row.delta : row[mode]?.value
      point.style.backgroundColor = value == null ? '#6b7786' : mode !== 'delta' ? sentimentColor(value / 100)
        : value > 0 ? '#559aff' : value < 0 ? '#f16b70' : '#8b99a8'
      point.setAttribute('aria-label', row.name + ', ' + (value == null ? 'Нет данных' : valueLabel(value)))
      point.title = row.name
      point.addEventListener('click', (event) => { event.stopPropagation(); onSelect(row.id) })
      active.set(row.id, new Marker({ element: point }).setLngLat([row.lon, row.lat]).addTo(map))
    }
    return () => {
      active.forEach((marker) => marker.remove())
      active.clear()
    }
  }, [map, mode, onSelect, rows, scope])

  useEffect(() => {
    for (const [id, marker] of markers.current) {
      marker.getElement().classList.toggle('is-selected', id === selectedId)
      marker.getElement().setAttribute('aria-pressed', String(id === selectedId))
    }
  }, [map, mode, rows, scope, selectedId])

  return <section className="atlas-compare-map" aria-label={period ? formatPeriodTitle(period) : 'Карта периода'}>
    <h2>{mode === 'delta' ? 'Изменение индекса' : period ? formatPeriodTitle(period) : 'Период'}</h2>
    <div className="map-shell">
      <MapView values={values} mode={mode === 'delta' ? 'delta' : 'mood'} year={period?.year ?? null} month={period?.month ?? null}
        initialCenter={MAP_CENTER} onMapReady={(instance) => { setMap(instance); onReady(instance) }}
        onRegionClick={scope === 'regions' ? onSelect : undefined} />
    </div>
  </section>
}

export default function ComparePage() {
  const [comparison, setComparison] = useState<Comparison | null>(null)
  const [pair, setPair] = useState<[TimePeriod, TimePeriod] | null>(null)
  const [scope, setScope] = useState<'cities' | 'regions' | null>(null)
  const [mode, setMode] = useState<'paired' | 'delta'>('paired')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [mapA, setMapA] = useState<LibreMap | null>(null)
  const [mapB, setMapB] = useState<LibreMap | null>(null)
  const [linked, setLinked] = useState(true)
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
  const activeMode = mode === 'delta' && hasDelta ? 'delta' : 'paired'
  const deltaScale = Math.max(1, ...rows.map((row) => Math.abs(row.delta ?? 0)))

  useEffect(() => {
    const controller = new AbortController()
    api.getComparison(controller.signal, pair?.[0], pair?.[1])
      .then((result) => { if (!controller.signal.aborted) setComparison(result) })
      .catch(() => { if (!controller.signal.aborted) setError('Не удалось загрузить сравнение периодов.') })
    return () => controller.abort()
  }, [pair])

  useEffect(() => {
    if (!mapA || !mapB || !linked || activeMode !== 'paired') return
    let syncing = false
    function follow(source: LibreMap, target: LibreMap) {
      if (syncing) return
      syncing = true
      try {
        target.jumpTo({ center: source.getCenter(), zoom: source.getZoom(), bearing: source.getBearing(), pitch: source.getPitch() })
      } finally {
        syncing = false
      }
    }
    const followA = () => follow(mapA, mapB)
    const followB = () => follow(mapB, mapA)
    followA()
    mapA.on('move', followA)
    mapB.on('move', followB)
    return () => {
      mapA.off('move', followA)
      mapB.off('move', followB)
    }
  }, [activeMode, linked, mapA, mapB])

  function changePair(nextA: TimePeriod, nextB: TimePeriod) {
    if (a?.year === nextA.year && a.month === nextA.month && b?.year === nextB.year && b.month === nextB.month) return
    setSelectedId(null)
    setError(null)
    setPair([nextA, nextB])
  }

  function selectRow(row: ComparisonRow) {
    setSelectedId(row.id)
    if (row.lat == null || row.lon == null) return
    mapA?.easeTo({ center: [row.lon, row.lat] })
    if (!linked && activeMode === 'paired') mapB?.easeTo({ center: [row.lon, row.lat] })
  }

  return (
    <div className="page atlas-page compare-page">
      <div className="atlas-page-heading">
        <h1>Сравнение периодов</h1><DemoBadge />
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
        <select aria-label={activeScope === 'cities' ? 'Выбрать город' : 'Выбрать регион'} value={selectedId ?? ''}
          onChange={(event) => {
            const row = rows.find((item) => item.id === event.target.value)
            if (row) selectRow(row)
            else setSelectedId(null)
          }}>
          <option value="">{activeScope === 'cities' ? 'Все города' : 'Все регионы'}</option>
          {[...rows].sort((left, right) => left.name.localeCompare(right.name, 'ru')).map((row) =>
            <option value={row.id} key={row.id}>{row.name}</option>)}
        </select>
        <div role="group" aria-label="Значения на карте">
          <button className="btn" type="button" aria-pressed={activeMode === 'paired'}
            onClick={() => { setMapB(null); setMode('paired') }} disabled={activeMode === 'paired'}>Два периода</button>
          <button className="btn" type="button" aria-pressed={activeMode === 'delta'}
            disabled={!hasDelta} onClick={() => { setMapB(null); setMode('delta') }}>Изменение</button>
        </div>
      </div>
      {error && <p className="alert error" role="alert">{error}</p>}
      {!current && !error && <p role="status">Загрузка сравнения…</p>}
      {current && !rows.length && <p className="muted">Для выбранных периодов на этом уровне нет данных.</p>}
      {rows.some((row) => row.status === 'different_methods') &&
        <p className="compare-notice">Для оценок, рассчитанных по разным методикам, показаны A и B. Дельта скрыта.</p>}
      <div className={`atlas-compare-pair${activeMode === 'delta' ? ' atlas-compare-delta' : ''}`}>
        <ComparisonMap period={activeMode === 'delta' ? b : a} mode={activeMode === 'delta' ? 'delta' : 'a'}
          scope={activeScope} rows={rows} selectedId={selectedId} onSelect={setSelectedId} onReady={setMapA} />
        {activeMode === 'paired' && <ComparisonMap period={b} mode="b" scope={activeScope} rows={rows}
          selectedId={selectedId} onSelect={setSelectedId} onReady={setMapB} />}
      </div>
      <div className="atlas-compare-legend">
        {activeMode === 'paired' ? <>
          <strong>Индекс настроения</strong>
          <div><div className="legend-scale">{legend.map((item) => <span key={item.label} style={{ background: item.color }} />)}</div>
            <div className="legend-labels"><span>0</span><span>50</span><span>100</span></div></div>
          <label><input type="checkbox" checked={linked} onChange={(event) => setLinked(event.target.checked)} /> Связать карты</label>
        </> : <p>Красный — снижение, синий — рост. Серый означает нулевое изменение или отсутствие сравнимой пары.</p>}
      </div>
      <BoundaryNote historical={[a, b].some((period) => period && period.year >= 1900 && period.year <= 1919)} />
      {selected && (
        <section className="compare-detail" aria-label={'Подробности: ' + selected.name}>
          <h2>{selected.name} · {difference(selected)}{selected.delta !== null && ' п.'}</h2>
          <ObservationDetails label="Период A" observation={selected.a} />
          <ObservationDetails label="Период B" observation={selected.b} />
        </section>
      )}
      <div className="atlas-compare-results">
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
