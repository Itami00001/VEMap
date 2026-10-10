import { useEffect } from 'react'
import * as maplibregl from 'maplibre-gl'

export interface HistoricalBordersLayerProps {
  map: maplibregl.Map | null
  url: string
}

const FILL_OPACITY = 0.06
const LINE_OPACITY = 0.9
const FADE_MS = 200

const cache = new Map<string, unknown>()

// Слой исторической границы: выше countries-fill, ниже regions-fill.
// Смена года — cross-fade 200ms через paint-переходы.
export default function HistoricalBordersLayer({ map, url }: HistoricalBordersLayerProps) {
  useEffect(() => {
    if (!map) return
    let cancelled = false

    const ensureLayers = () => {
      if (!map.getSource('empire')) {
        map.addSource('empire', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      }
      if (!map.getLayer('empire-fill')) {
        map.addLayer(
          {
            id: 'empire-fill',
            type: 'fill',
            source: 'empire',
            paint: {
              'fill-color': '#ffffff',
              'fill-opacity': 0,
              'fill-opacity-transition': { duration: FADE_MS, delay: 0 },
            },
          },
          'regions-fill',
        )
      }
      if (!map.getLayer('empire-line')) {
        map.addLayer(
          {
            id: 'empire-line',
            type: 'line',
            source: 'empire',
            paint: {
              'line-color': '#e8ecf4',
              'line-width': 1,
              'line-opacity': 0,
              'line-opacity-transition': { duration: FADE_MS, delay: 0 },
            },
          },
          'regions-fill',
        )
      }
    }

    const apply = (data: unknown) => {
      if (cancelled || !map.getSource('empire')) return
      ;(map.getSource('empire') as maplibregl.GeoJSONSource).setData(data as never)
      map.setPaintProperty('empire-fill', 'fill-opacity', 0)
      map.setPaintProperty('empire-line', 'line-opacity', 0)
      requestAnimationFrame(() => {
        if (cancelled) return
        map.setPaintProperty('empire-fill', 'fill-opacity', FILL_OPACITY)
        map.setPaintProperty('empire-line', 'line-opacity', LINE_OPACITY)
      })
    }

    if (!map.isStyleLoaded()) {
      map.once('load', () => {
        if (cancelled) return
        ensureLayers()
        const hit = cache.get(url)
        if (hit) apply(hit)
        else fetch(url).then((r) => r.json()).then((data: unknown) => { cache.set(url, data); apply(data) }).catch(() => undefined)
      })
      return () => { cancelled = true }
    }
    ensureLayers()
    const hit = cache.get(url)
    if (hit) apply(hit)
    else fetch(url).then((r) => r.json()).then((data: unknown) => { cache.set(url, data); apply(data) }).catch(() => undefined)
    return () => { cancelled = true }
  }, [map, url])

  return null
}
