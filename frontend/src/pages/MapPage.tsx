import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type * as maplibregl from 'maplibre-gl'
import { api } from '../services/api'
import type { City, CityMood, MapPoint, Region } from '../types'
import CityMarkers from '../features/map/CityMarkers'
import MapView from '../features/map/MapView'
import RegionPopup from '../features/map/RegionPopup'
import { RegionDetails } from '../features/map/RegionPopup'
import { moodLegend } from '../features/map/legend'
import { useMapData } from '../features/map/useMapData'
import TimeSlider from '../features/map/TimeSlider'
import DemoBadge from '../features/map/DemoBadge'
import CityPanel from '../features/map/CityPanel'

export default function MapPage() {
  const { periods, period, setPeriod, points, loading, error } = useMapData()
  const [regions, setRegions] = useState<Region[]>([])
  const [cities, setCities] = useState<City[]>([])
  const [cityMoods, setCityMoods] = useState<CityMood[]>([])
  const [map, setMap] = useState<maplibregl.Map | null>(null)
  const [popup, setPopup] = useState<{ regionId: string; x: number; y: number } | null>(null)
  const [cityId, setCityId] = useState<string | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const shellRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const controller = new AbortController()
    api.getRegions(controller.signal).then(setRegions).catch(() => undefined)
    api.getCities(controller.signal).then(setCities).catch(() => undefined)
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (!period) return
    const controller = new AbortController()
    api.getCityMoods(period.year, period.month, controller.signal).then(setCityMoods).catch(() => setCityMoods([]))
    return () => controller.abort()
  }, [period])

  useEffect(() => {
    console.log('[VEMap] cityId changed', cityId)
  }, [cityId])

  useEffect(() => {
    console.log('[VEMap] year/month changed', { year: period?.year ?? null, month: period?.month ?? null })
  }, [period])

  const closeCity = () => {
    setCityId(null)
    setSearchParams({}, { replace: true })
  }

  const regionFromUrl = searchParams.get('region')
  const region = regions.find((r) => r.region_id === regionFromUrl)

  const values = useMemo(() => {
    const v: Record<string, number | null> = {}
    for (const r of regions) {
      const p: MapPoint | undefined = points[r.region_id]
      v[r.region_id] = p ? p.mood_index : null
    }
    return v
  }, [points, regions])

  // Настроение Украины — взвешенное по n_lines среднее UA-городов.
  // Нет записей за период → null → страна серая.
  const ukraineMood = useMemo(() => {
    const byId = new Map(cities.map((c) => [c.city_id, c]))
    let sw = 0
    let sm = 0
    for (const m of cityMoods) {
      const c = byId.get(m.city_id)
      if (c?.country === 'UA' && m.responses_count > 0) {
        sw += m.responses_count
        sm += m.mood_index * m.responses_count
      }
    }
    return sw > 0 ? Math.round((sm / sw) * 100) / 100 : null
  }, [cities, cityMoods])

  const handleRegionClick = (regionId: string, clientPoint: { x: number; y: number }) => {
    const rect = shellRef.current?.getBoundingClientRect()
    if (!rect) return
    setPopup({
      regionId,
      x: clientPoint.x - rect.left,
      y: clientPoint.y - rect.top,
    })
  }

  const legend = moodLegend()
  const popupRegion = regions.find((r) => r.region_id === popup?.regionId)
  const city = cities.find((item) => item.city_id === cityId)
  const cityMood = cityMoods.find((item) => item.city_id === cityId)

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Карта настроений</h1>
          <p>
            Mood Index по регионам России (агрегат городов). Период:{' '}
            {period ? `${period.year}-${String(period.month ?? 0).padStart(2, '0')}` : '—'}.
            Кликните по региону для деталей. <DemoBadge />
          </p>
        </div>
      </div>

      {error && <div className="alert error">Ошибка загрузки данных: {error}</div>}
      {loading && <div className="loading">Загрузка данных…</div>}

      <div className="map-shell" ref={shellRef}>
        <MapView
          values={values}
          mode="mood"
          year={period?.year ?? null}
          ukraineMood={ukraineMood}
          onRegionClick={handleRegionClick}
          onBackgroundClick={() => { setPopup(null); setCityId(null) }}
          onMapReady={setMap}
        />
        <div className="map-overlay-cities">
          <CityMarkers map={map} period={period} onCityClick={(id) => { setPopup(null); setSearchParams({ city: id }, { replace: true }); setCityId(id) }} />
        </div>
        <div className="map-overlay-top">
          <TimeSlider periods={periods} value={period} onChange={setPeriod} />
          <div className="map-legend">
            <span>Mood Index</span>
            <div className="legend-scale">
              {legend.map((s) => (
                <span key={s.label} style={{ background: s.color }} title={s.label} />
              ))}
            </div>
            <div className="legend-labels">
              <span>0</span>
              <span>50</span>
              <span>100</span>
            </div>
            <span className="muted">серый — нет данных</span>
          </div>
        </div>

        {popup && popupRegion && (
          <RegionPopup
            x={popup.x}
            y={popup.y}
            containerWidth={shellRef.current?.clientWidth ?? 800}
            containerHeight={shellRef.current?.clientHeight ?? 560}
            onClose={() => setPopup(null)}
            region={popupRegion}
            period={period}
            point={points[popup.regionId] ?? null}
          />
        )}

        {region && (
          <div className="region-popup" style={{ top: 60, right: 12, left: 'auto' }}>
            <button
              type="button"
              className="close"
              onClick={() => setSearchParams({}, { replace: true })}
              aria-label="Закрыть"
            >
              ✕
            </button>
            <RegionDetails region={region} period={period} point={points[region.region_id] ?? null} />
          </div>
        )}
      </div>

      {cityId && (
        <CityPanel city={city} cityId={cityId} mood={cityMood ?? null} onClose={closeCity} />
      )}
    </div>
  )
}
