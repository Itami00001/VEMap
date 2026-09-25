import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { GEOJSON_URL } from '../../services/api'

export type MapMode = 'mood' | 'delta'

export interface MapViewProps {
  values: Record<string, number | null | undefined>
  mode?: MapMode
  mini?: boolean
  interactive?: boolean
  onRegionClick?: (regionId: string, point: { x: number; y: number }) => void
  onBackgroundClick?: () => void
}

interface GeoFeature {
  type: 'Feature'
  properties: Record<string, unknown>
  geometry: unknown
}

interface GeoCollection {
  type: 'FeatureCollection'
  features: GeoFeature[]
}

type Expression = unknown[]

function fillColorExpr(mode: MapMode): Expression {
  const stops: Expression =
    mode === 'mood'
      ? ['interpolate', ['linear'], ['get', 'value'], 0, '#c0392b', 25, '#e67e22', 50, '#f1c40f', 75, '#7cb342', 100, '#2ecc71']
      : ['interpolate', ['linear'], ['get', 'value'], -10, '#d64545', 0, '#3d4657', 10, '#4f8cff']
  return ['case', ['==', ['get', 'value'], null], '#39404e', stops]
}

function applyValues(base: GeoCollection, values: Record<string, number | null | undefined>): GeoCollection {
  return {
    type: 'FeatureCollection',
    features: base.features.map((f) => ({
      ...f,
      properties: {
        ...f.properties,
        value: values[String(f.properties.region_id)] ?? null,
      },
    })),
  }
}

export default function MapView({
  values,
  mode = 'mood',
  mini = false,
  interactive = true,
  onRegionClick,
  onBackgroundClick,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const baseRef = useRef<GeoCollection | null>(null)
  const valuesRef = useRef(values)
  const modeRef = useRef(mode)
  const clickRef = useRef(onRegionClick)
  const bgClickRef = useRef(onBackgroundClick)

  valuesRef.current = values
  modeRef.current = mode
  clickRef.current = onRegionClick
  bgClickRef.current = onBackgroundClick

  useEffect(() => {
    if (!containerRef.current) return
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: 'https://demotiles.maplibre.org/style.json',
      center: [105, 61],
      zoom: 3,
      interactive,
    })
    mapRef.current = map

    map.on('load', () => {
      fetch(GEOJSON_URL)
        .then((r) => r.json() as Promise<GeoCollection>)
        .then((data) => {
          if (!mapRef.current || map.getStyle().layers.some((l) => l.id === 'regions-fill')) return
          baseRef.current = data
          map.addSource('regions', {
            type: 'geojson',
            data: applyValues(data, valuesRef.current),
          })
          map.addLayer({
            id: 'regions-fill',
            type: 'fill',
            source: 'regions',
            paint: {
              'fill-color': fillColorExpr(modeRef.current) as never,
              'fill-opacity': 0.85,
            },
          })
          map.addLayer({
            id: 'regions-line',
            type: 'line',
            source: 'regions',
            paint: {
              'line-color': '#0b0e14',
              'line-width': 0.7,
            },
          })
          if (interactive) {
            map.on('click', 'regions-fill', (e) => {
              const rid = e.features?.[0]?.properties?.region_id
              if (typeof rid === 'string' && e.originalEvent) {
                clickRef.current?.(rid, { x: e.originalEvent.clientX, y: e.originalEvent.clientY })
              }
            })
            map.on('mouseenter', 'regions-fill', () => {
              map.getCanvas().style.cursor = 'pointer'
            })
            map.on('mouseleave', 'regions-fill', () => {
              map.getCanvas().style.cursor = ''
            })
            map.on('click', (e) => {
              const feats = map.queryRenderedFeatures(e.point, { layers: ['regions-fill'] })
              if (feats.length === 0) {
                bgClickRef.current?.()
              }
            })
          }
        })
        .catch(() => undefined)
    })

    return () => {
      map.remove()
      mapRef.current = null
      baseRef.current = null
    }
  }, [interactive])

  useEffect(() => {
    const map = mapRef.current
    const base = baseRef.current
    if (!map || !base) return
    const source = map.getSource('regions') as maplibregl.GeoJSONSource | undefined
    if (!source) return
    source.setData(applyValues(base, values))
    map.setPaintProperty('regions-fill', 'fill-color', fillColorExpr(mode) as never)
  }, [values, mode])

  return <div ref={containerRef} className={`map-canvas${mini ? ' mini' : ''}`} />
}
