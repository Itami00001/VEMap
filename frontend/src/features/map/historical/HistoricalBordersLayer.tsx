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

// Отпечаток геометрии снимка: число фич/полигонов/точек и центр масс.
// Секундная проверка, что 1904 и 1905 — РАЗНЫЕ данные и слой получил
// новую геометрию (а не остался на старой из-за отмены/кэша).
function digest(data: unknown) {
  const fs =
    (data as { features?: { geometry?: { type?: string; coordinates?: unknown } }[] })?.features ?? []
  let polys = 0
  let pts = 0
  let sx = 0
  let sy = 0
  for (const f of fs) {
    const g = f.geometry
    if (!g) continue
    const list: number[][][][] =
      g.type === 'MultiPolygon'
        ? (g.coordinates as number[][][][])
        : g.type === 'Polygon'
          ? [g.coordinates as number[][][]]
          : []
    polys += list.length
    for (const poly of list)
      for (const ring of poly)
        for (const p of ring) {
          pts++
          sx += p[0]
          sy += p[1]
        }
  }
  return { features: fs.length, polys, pts, cx: pts ? +(sx / pts).toFixed(4) : 0, cy: pts ? +(sy / pts).toFixed(4) : 0 }
}

// Слой исторической границы — только контур (без заливки: белая заливка
// давала чужой оттенок территории внутри границы). Линия ставится поверх
// базовых слоёв, но ПОД маркеры городов. Смена года — fade 200ms.
export default function HistoricalBordersLayer({ map, url }: HistoricalBordersLayerProps) {
  useEffect(() => {
    if (!map || !url) return
    let cancelled = false

    // Порядок (снизу вверх): базовые линии → empire-line → cities-*.
    // Если города уже нарисованы — переносим линию под них.
    const placeLine = () => {
      if (map.getLayer('empire-line') && map.getLayer('cities-circle')) {
        map.moveLayer('empire-line', 'cities-circle')
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
        console.log('[VEMap] empire layers failed', url, e instanceof Error ? e.message : String(e))
      }
    }

    const apply = (data: unknown) => {
      if (cancelled || !map.getSource('empire')) return
      ;(map.getSource('empire') as maplibregl.GeoJSONSource).setData(data as never)
      placeLine()
      map.setPaintProperty('empire-line', 'line-opacity', 0)
      const props =
        (data as { features?: { properties?: Record<string, unknown> }[] }).features?.[0]?.properties ?? {}
      console.log('[VEMap] empire snapshot', {
        url,
        name: props.name,
        year_from: props.year_from,
        year_to: props.year_to,
        ...digest(data),
      })
      requestAnimationFrame(() => {
        if (cancelled) return
        placeLine()
        map.setPaintProperty('empire-line', 'line-opacity', LINE_OPACITY)
        // Порядок всех слоёв снизу вверх — покажет, не закрали ли
        // историческую линию современные countries-line/regions-line.
        const order = (map.getStyle().layers ?? []).map((l) => l.id)
        console.log('[VEMap] empire applied', url, '| layer order:', order.join(' > '))
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
