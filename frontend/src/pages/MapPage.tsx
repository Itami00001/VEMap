import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../services/api'
import type { MapPoint, Region } from '../types'
import MapView from '../features/map/MapView'
import RegionPopup from '../features/map/RegionPopup'
import { RegionDetails } from '../features/map/RegionPopup'
import { moodLegend } from '../features/map/legend'
import { useMapData } from '../features/map/useMapData'
import TimeSlider from '../features/map/TimeSlider'

export default function MapPage() {
  const { periods, period, setPeriod, points, loading, error } = useMapData()
  const [regions, setRegions] = useState<Region[]>([])
  const [popup, setPopup] = useState<{ regionId: string; x: number; y: number } | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const shellRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    api
      .getRegions()
      .then(setRegions)
      .catch(() => undefined)
  }, [])

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

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Карта настроений</h1>
          <p>Mood Index по регионам России. Кликните по региону для деталей.</p>
        </div>
      </div>

      {error && <div className="alert error">Ошибка загрузки данных: {error}</div>}
      {loading && <div className="loading">Загрузка данных…</div>}

      <div className="map-shell" ref={shellRef}>
        <MapView
          values={values}
          mode="mood"
          onRegionClick={handleRegionClick}
          onBackgroundClick={() => setPopup(null)}
        />
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
            year={period?.year ?? null}
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
            <RegionDetails region={region}             year={period?.year ?? null} point={points[region.region_id] ?? null} />
          </div>
        )}
      </div>
    </div>
  )
}
