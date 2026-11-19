import { useEffect, useMemo, useRef, useState } from 'react'
import { useOutletContext, useSearchParams } from 'react-router-dom'
import type * as maplibregl from 'maplibre-gl'
import { api } from '../services/api'
import type { City, MapPoint, Region } from '../types'
import CityMarkers from '../features/map/CityMarkers'
import MapView, { BoundaryNote } from '../features/map/MapView'
import RegionPopup from '../features/map/RegionPopup'
import { RegionDetails } from '../features/map/RegionPopup'
import { moodLegend } from '../features/map/legend'
import { useMapData } from '../features/map/useMapData'
import TimeSlider, { formatPeriod } from '../features/map/TimeSlider'
import DemoBadge from '../features/map/DemoBadge'
import CityPanel from '../features/map/CityPanel'
import type { LayoutContext } from '../app/Layout'

const MAP_CENTER: [number, number] = [36, 49]

export default function MapPage() {
  const { periods, period, setPeriod, points, cityMoods, loading, error } = useMapData()
  const [regions, setRegions] = useState<Region[]>([])
  const [cities, setCities] = useState<City[]>([])
  const [map, setMap] = useState<maplibregl.Map | null>(null)
  const [popup, setPopup] = useState<{ regionId: string; x: number; y: number } | null>(null)
  const [cityId, setCityId] = useState<string | null>(null)
  const [sourcePdf, setSourcePdf] = useState<string | null>(null)
  const { chatOpen, setChatSource } = useOutletContext<LayoutContext>()
  const [searchParams, setSearchParams] = useSearchParams()
  const shellRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const controller = new AbortController()
    api.getRegions(controller.signal).then(setRegions).catch(() => undefined)
    api.getCities(controller.signal).then(setCities).catch(() => undefined)
    return () => controller.abort()
  }, [])

  const closeCity = () => {
    setCityId(null)
    setSourcePdf(null)
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
  const activeSource = cityMood?.sources?.some((source) => source.available && source.id === sourcePdf)
    ? sourcePdf : null
  useEffect(() => {
    setChatSource(cityId && activeSource ? { cityId, filename: activeSource } : null)
    return () => setChatSource(null)
  }, [activeSource, cityId, setChatSource])

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Карта настроений</h1>
          <p>
            Mood Index по регионам России (агрегат городов). Период:{' '}
            {period ? formatPeriod(period) : '—'}.
            Кликните по региону для деталей. <DemoBadge />
          </p>
        </div>
      </div>

      {error && <div className="alert error">Ошибка загрузки данных: {error}</div>}
      {loading && <div className="loading">Загрузка данных…</div>}

      <div className="map-shell map-shell--main" ref={shellRef}>
        <MapView
          values={values}
          mode="mood"
          initialCenter={MAP_CENTER}
          year={period?.year ?? null}
          month={period?.month ?? null}
          onRegionClick={handleRegionClick}
          onBackgroundClick={() => { setPopup(null); closeCity() }}
          onMapReady={setMap}
        />
        <div className="map-overlay-cities">
          <CityMarkers map={map} cities={cities} cityMoods={cityMoods} loading={loading} error={error !== null}
            animationPaused={chatOpen}
            onCityClick={(id) => {
              setPopup(null)
              setSearchParams({ city: id }, { replace: true })
              if (id !== cityId) setSourcePdf(null)
              setCityId(id)
            }} />
        </div>
        <div className="map-overlay-top">
          <TimeSlider periods={periods} value={period} onChange={(next) => {
            if (next.year !== period?.year || next.month !== period?.month) setSourcePdf(null)
            setPeriod(next)
          }} />
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
      <BoundaryNote period={period} />

      {cityId && (
        <CityPanel key={`${cityId}-${period?.year}-${period?.month}`} city={city} cityId={cityId}
          mood={cityMood ?? null} period={period} loading={loading} error={error !== null}
          activeSource={activeSource} onOpenSource={setSourcePdf} onClose={closeCity} />
      )}
    </div>
  )
}
