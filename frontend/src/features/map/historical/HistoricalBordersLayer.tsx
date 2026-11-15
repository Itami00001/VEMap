import { useEffect } from 'react'
import * as maplibregl from 'maplibre-gl'

export interface HistoricalBordersLayerProps {
  map: maplibregl.Map | null
  url: string | null
}

const LINE_OPACITY = 1
const LINE_WIDTH = 2
const FADE_MS = 200

const cache = new Map<string, unknown>()

// Слой исторической границы — только контур (без заливки: белая заливка
// давала чужой оттенок территории внутри границы). Линия ставится поверх
// базовых слоёв, но ПОД маркеры городов. Смена года — fade 200ms.
export default function HistoricalBordersLayer({ map, url }: HistoricalBordersLayerProps) {
  useEffect(() => {
    if (!map) return
    let cancelled = false

    // url === null (год без снимка: 1917/1991/2026) — ОБЯЗАТЕЛЬНО чистим
    // источник и гасим линию. Раньше был early-return, из-за чего источник
    // сохранял геометрию предыдущего года («карта запоминает» прошлую
    // границу: в 1917/2026 оставался разрез Сахалина и контуры империи).
    const clear = () => {
      const src = map.getSource('empire') as maplibregl.GeoJSONSource | undefined
      if (src) src.setData({ type: 'FeatureCollection', features: [] })
      if (map.getLayer('empire-line')) map.setPaintProperty('empire-line', 'line-opacity', 0)
    }

    if (!url) {
      clear()
      return
    }

    // Порядок (снизу вверх): базовые линии → empire-line → cities-*.
    // Если города уже нарисованы — переносим линию под них.
    const placeLine = () => {
      if (map.getLayer('empire-line') && map.getLayer('cities-glow')) {
        map.moveLayer('empire-line', 'cities-glow')
      }
    }

    const ensureLayers = () => {
      if (!map.getSource('empire')) {
        map.addSource('empire', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      }
      if (!map.getLayer('empire-line')) {
        map.addLayer({
          id: 'empire-line',
          type: 'line',
          source: 'empire',
          paint: {
            'line-color': '#ffffff',
            'line-width': LINE_WIDTH,
            'line-opacity': 0,
            'line-opacity-transition': { duration: FADE_MS, delay: 0 },
          },
        })
      }
      placeLine()
    }

    const safeEnsureLayers = () => {
      try {
        ensureLayers()
      } catch (e: unknown) {
        console.warn('[VEMap] empire layers failed', url, e instanceof Error ? e.message : String(e))
      }
    }

    const apply = (data: unknown) => {
      if (cancelled || !map.getSource('empire')) return
      ;(map.getSource('empire') as maplibregl.GeoJSONSource).setData(data as never)
      placeLine()
      map.setPaintProperty('empire-line', 'line-opacity', 0)
      requestAnimationFrame(() => {
        if (cancelled) return
        placeLine()
        map.setPaintProperty('empire-line', 'line-opacity', LINE_OPACITY)
      })
    }

    const loadData = () => {
      const hit = cache.get(url)
      if (hit) {
        apply(hit)
        return
      }
      fetch(url)
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`)
          return r.json()
        })
        .then((data: unknown) => {
          cache.set(url, data)
          apply(data)
        })
        .catch((e: unknown) => {
          console.warn('[VEMap] empire fetch failed', url, e instanceof Error ? e.message : String(e))
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
