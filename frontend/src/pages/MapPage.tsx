import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useOutletContext, useSearchParams } from 'react-router-dom'
import { Marker } from 'maplibre-gl'
import type { Map as LibreMap } from 'maplibre-gl'
import { api } from '../services/api'
import type { City, Region, TimePeriod } from '../types'
import CityMarkers from '../features/map/CityMarkers'
import ForeignMoodRegions from '../features/map/ForeignMoodRegions'
import MapView, { BoundaryNote } from '../features/map/MapView'
import { RegionDetails } from '../features/map/RegionPopup'
import { moodLegend } from '../features/map/legend'
import { useMapData } from '../features/map/useMapData'
import TimeSlider, { formatPeriod } from '../features/map/TimeSlider'
import DemoBadge from '../features/map/DemoBadge'
import CityPanel from '../features/map/CityPanel'
import type { LayoutContext } from '../app/Layout'
import { historicalRangeForYear } from '../features/map/historical/historicalBorders'

const MAP_CENTER: [number, number] = [36, 49]
const legend = moodLegend()
type Panel = 'search' | 'legend' | 'sources'

export default function MapPage() {
  const { periods, period, setPeriod, points, cityMoods, loading, error } = useMapData()
  const [regions, setRegions] = useState<Region[]>([])
  const [cities, setCities] = useState<City[]>([])
  const [cityError, setCityError] = useState(false)
  const [map, setMap] = useState<LibreMap | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const cityId = searchParams.get('city')
  const regionId = searchParams.get('region')
  const periodKey = searchParams.get('period')
  const [panel, setPanel] = useState<Panel | null>(() => cityId || regionId ? 'sources' : null)
  const [sourcePdf, setSourcePdf] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const { chatOpen, setChatOpen, setChatSource } = useOutletContext<LayoutContext>()
  const panelButton = useRef<HTMLElement | null>(null)
  const searchInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const controller = new AbortController()
    api.getRegions(controller.signal).then(setRegions).catch(() => undefined)
    api.getCities(controller.signal).then(setCities).catch(() => {
      if (!controller.signal.aborted) setCityError(true)
    })
    return () => controller.abort()
  }, [])
  useEffect(() => {
    const requested = periods.find((item) => formatPeriod(item) === periodKey)
    if (requested) setPeriod(requested)
  }, [periodKey, periods, setPeriod])

  const values = useMemo(() => Object.fromEntries(Object.entries(points)
    .map(([id, point]) => [id, point.mood_index])), [points])
  const city = cities.find((item) => item.city_id === cityId)
  const region = regions.find((item) => item.region_id === regionId)
  const snapshot = historicalRangeForYear(period?.year ?? null, period?.month ?? null)
  const mood = cityMoods.find((item) => item.city_id === cityId) ?? null
  const activeSource = mood?.sources?.some((item) => item.available && item.id === sourcePdf) ? sourcePdf : null
  const normalized = query.trim().toLocaleLowerCase('ru').replaceAll('ё', 'е')
  const matches = cities.filter((item) => item.name_ru.toLocaleLowerCase('ru').replaceAll('ё', 'е').includes(normalized))

  useEffect(() => {
    if (city?.lat != null && city.lon != null && map) {
      map.easeTo({ center: [city.lon, city.lat], duration: 350 })
      const ring = document.createElement('span')
      ring.className = 'atlas-selected-city'
      ring.setAttribute('aria-hidden', 'true')
      const marker = new Marker({ element: ring }).setLngLat([city.lon, city.lat]).addTo(map)
      return () => { marker.remove() }
    }
  }, [city, map])
  useEffect(() => {
    if (panel === 'search' && !chatOpen) searchInput.current?.focus()
  }, [panel, chatOpen])
  useEffect(() => {
    setChatSource(cityId && activeSource ? { cityId, filename: activeSource } : null)
    return () => setChatSource(null)
  }, [activeSource, cityId, setChatSource])

  function closePanel() {
    setPanel(null)
    panelButton.current?.focus()
  }

  function selectCity(id: string) {
    if (id !== cityId) setSourcePdf(null)
    setSearchParams(period ? { city: id, period: formatPeriod(period) } : { city: id }, { replace: true })
    setChatOpen(false)
    setPanel('sources')
  }

  function selectRegion(id: string) {
    setSourcePdf(null)
    setSearchParams(period ? { region: id, period: formatPeriod(period) } : { region: id }, { replace: true })
    setChatOpen(false)
    setPanel('sources')
  }

  function changePeriod(next: TimePeriod) {
    if (next.year !== period?.year || next.month !== period?.month) setSourcePdf(null)
    setPeriod(next)
    setSearchParams((params) => {
      const updated = new URLSearchParams(params)
      updated.set('period', formatPeriod(next))
      return updated
    }, { replace: true })
  }

  return (
    <section className={`atlas-map${chatOpen ? ' atlas-map-chat' : ''}`} aria-label="Карта настроений"
      onKeyDown={(event) => { if (event.key === 'Escape' && panel && !chatOpen) closePanel() }}>
      <div className="map-shell atlas-map-shell">
        <MapView values={values} year={period?.year ?? null} month={period?.month ?? null}
          initialCenter={MAP_CENTER} onRegionClick={selectRegion} onMapReady={setMap} />
        <ForeignMoodRegions map={map} cities={cities} moods={cityMoods} />
        <div className="map-overlay-cities">
          <CityMarkers map={map} cities={cities} cityMoods={cityMoods} loading={loading} error={error !== null}
            animationPaused={chatOpen} onCityClick={selectCity} />
        </div>
      </div>

      <div className="atlas-map-tools" role="group" aria-label="Инструменты карты">
        {([['search', 'Найти город'], ['legend', 'Легенда'], ['sources', 'Источники']] as const).map(([key, label]) => (
          <button key={key} type="button" className="btn" aria-expanded={panel === key && !chatOpen}
            aria-controls="atlas-map-panel" onClick={(event) => {
              panelButton.current = event.currentTarget
              setPanel(panel === key && !chatOpen ? null : key)
              setChatOpen(false)
            }}>{label}</button>
        ))}
        <button id="atlas-chat-toggle" type="button" className="btn" aria-expanded={chatOpen} aria-controls="newspaper-chat"
          onClick={() => { setPanel(null); setChatOpen(!chatOpen) }}>Чат</button>
        <DemoBadge />
      </div>

      {(error || loading) && <p className="atlas-map-status" role={error ? 'alert' : 'status'}>
        {error ? 'Не удалось загрузить данные за период.' : 'Загрузка данных…'}
      </p>}

      <div className="atlas-map-timeline">
        <TimeSlider periods={periods} value={period} onChange={changePeriod} />
      </div>
      <div className="atlas-map-zoom" role="group" aria-label="Масштаб карты">
        <button className="btn" type="button" aria-label="Увеличить масштаб" disabled={!map} onClick={() => map?.zoomIn()}>+</button>
        <button className="btn" type="button" aria-label="Уменьшить масштаб" disabled={!map} onClick={() => map?.zoomOut()}>−</button>
      </div>
      <div className="atlas-map-credit">
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap, ODbL</a>
        <span> · </span>
        <button type="button" onClick={(event) => {
          panelButton.current = event.currentTarget; setChatOpen(false); setPanel('legend')
        }}>Источники карты</button>
      </div>

      <aside id="atlas-map-panel" className="atlas-map-panel" aria-label="Панель карты" hidden={!panel || chatOpen}>
        <button type="button" className="atlas-panel-close" aria-label="Закрыть панель карты" onClick={closePanel}>×</button>
        {panel === 'search' && <>
          <h2>Найти город</h2>
          <input ref={searchInput} className="atlas-city-query" type="search" value={query} aria-label="Название города"
            placeholder="Название города" onChange={(event) => setQuery(event.target.value)} />
          {cityError && <p role="alert">Не удалось загрузить список городов.</p>}
          {!cityError && !matches.length && <p>{cities.length ? 'Города не найдены.' : 'Загружаем города…'}</p>}
          <ul className="atlas-city-results">{matches.slice(0, 25).map((item) =>
            <li key={item.city_id}><button className="btn" type="button" onClick={() => selectCity(item.city_id)}>{item.name_ru}</button></li>)}</ul>
        </>}
        {panel === 'legend' && <>
          <h2>Индекс настроения</h2>
          <div className="legend-scale">{legend.map((item) => <span key={item.label} style={{ background: item.color }} />)}</div>
          <div className="legend-labels"><span>0</span><span>50</span><span>100</span></div>
          <p>Цвет показывает тон публикаций за выбранный период. Цвет подложки означает, что оценка недоступна.</p>
          {snapshot?.historical && <p>{snapshot.label}</p>}
          <BoundaryNote historical={snapshot?.historical} />
          <p>Заливка зарубежных областей рассчитана по городам архива внутри современных контуров.{' '}
            <a href="https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-1-states-provinces/"
              target="_blank" rel="noreferrer">Natural Earth ADM1</a></p>
        </>}
        {panel === 'sources' && cityId && <CityPanel key={cityId + ':' + period?.year + ':' + period?.month}
          city={city} cityId={cityId} mood={mood} period={period} loading={loading} error={error !== null}
          onOpenSource={setSourcePdf} onChat={(filename) => {
            setSourcePdf(filename)
            setChatSource({ cityId, filename })
            setPanel(null)
            setChatOpen(true)
          }} />}
        {panel === 'sources' && !cityId && region && <RegionDetails key={region.region_id}
          region={region} period={period} point={points[region.region_id] ?? null} />}
        {panel === 'sources' && !cityId && !region && <>
          <h2>Источники</h2>
          <p>Выберите город или регион на карте, чтобы открыть данные и газетные страницы за выбранный период.</p>
          <Link className="btn" to="/archive">Открыть архив газет</Link>
        </>}
      </aside>
    </section>
  )
}
