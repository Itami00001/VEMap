import { useEffect } from 'react'
import * as maplibregl from 'maplibre-gl'

export interface HistoricalBordersLayerProps {
  map: maplibregl.Map | null
  url: string | null
  beforeId: string
  historical: boolean
}

const LINE_OPACITY = 1
const LINE_WIDTH = 2
const FADE_MS = 200

const cache = new Map<string, unknown>()

export default function HistoricalBordersLayer({ map, url, beforeId, historical }: HistoricalBordersLayerProps) {
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
      if (map.getLayer('empire-fill')) map.setLayoutProperty('empire-fill', 'visibility', 'none')
    }

    if (!url) {
      clear()
      return
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
        }, beforeId)
      }
      if (!map.getLayer('empire-fill')) {
        map.addLayer({
          id: 'empire-fill', type: 'fill', source: 'empire',
          paint: { 'fill-color': '#545451' },
          layout: { visibility: 'none' },
        }, 'regions-fill')
      }
      map.moveLayer('empire-line', beforeId)
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
      map.setLayoutProperty('empire-fill', 'visibility', historical ? 'visible' : 'none')
      map.setPaintProperty('empire-line', 'line-color', historical ? '#e3ceb0' : '#ffffff')
      map.setPaintProperty('empire-line', 'line-opacity', 0)
      requestAnimationFrame(() => {
        if (cancelled) return
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

    safeEnsureLayers()
    clear()
    loadData()
    return () => { cancelled = true }
  }, [map, url, beforeId, historical])

  return null
}
