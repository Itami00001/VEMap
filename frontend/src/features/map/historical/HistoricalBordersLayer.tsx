import { useEffect } from 'react'
import * as maplibregl from 'maplibre-gl'

export interface HistoricalBordersLayerProps {
  map: maplibregl.Map | null
  url: string | null
}

const FILL_OPACITY = 0.15
const LINE_OPACITY = 1
const LINE_WIDTH = 2
const FADE_MS = 200

const cache = new Map<string, unknown>()

// Слой исторической границы: выше countries-fill, ниже regions-fill.
// Смена года — cross-fade 200ms через paint-переходы.
export default function HistoricalBordersLayer({ map, url }: HistoricalBordersLayerProps) {
  useEffect(() => {
    if (!map || !url) return
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
            // Целевые страны (РИ/РФ+Крым, Украина внутри неё) —
            // яркая белая обводка поверх серых стран.
            paint: {
              'line-color': '#ffffff',
              'line-width': LINE_WIDTH,
              'line-opacity': 0,
              'line-opacity-transition': { duration: FADE_MS, delay: 0 },
            },
          },
          'regions-fill',
        )
      }
    }

    const safeEnsureLayers = () => {
      try {
        ensureLayers()
      } catch (e: unknown) {
        console.log('[VEMap] empire layers failed', url, e instanceof Error ? e.message : String(e))
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
        console.log('[VEMap] empire applied', url)
      })
    }

    const loadData = () => {
      const hit = cache.get(url)
      if (hit) {
        apply(hit)
        return
      }
      console.log('[VEMap] empire fetch start', url)
      fetch(url)
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`)
          return r.json()
        })
        .then((data: unknown) => {
          cache.set(url, data)
          const n = (data as { features?: unknown[] }).features?.length ?? 0
          console.log('[VEMap] empire fetch done', url, `features: ${n}`)
          apply(data)
        })
        .catch((e: unknown) => {
          console.log('[VEMap] empire fetch failed', url, e instanceof Error ? e.message : String(e))
        })
    }

    if (!map.isStyleLoaded()) {
      map.once('load', () => {
        if (cancelled) return
        safeEnsureLayers()
        loadData()
      })
      return () => { cancelled = true }
    }
    safeEnsureLayers()
    loadData()
    return () => { cancelled = true }
  }, [map, url])

  return null
}
