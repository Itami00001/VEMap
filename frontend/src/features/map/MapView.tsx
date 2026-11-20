import { useEffect, useRef } from 'react'
import * as maplibregl from 'maplibre-gl'
import type { MapLayerMouseEvent, StyleSpecification } from 'maplibre-gl'
import { GEOJSON_URL, LAND_GEOJSON_URL } from '../../services/api'
import { CITY_CLUSTER_LAYER } from './CityMarkers'

// Воркер maplibre-gl v6 резолвится относительно бандла (./maplibre-gl-worker.mjs),
// который Vite не эмитит -> 404 text/html -> карта мертва.
// Поэтому файлы maplibre-gl-worker.mjs + maplibre-gl-shared.mjs лежат в public/
// (копия из node_modules/maplibre-gl/dist, версия 6.11.2 — при обновлении пакета
// скопировать заново) и URL задан явно.
maplibregl.setWorkerUrl('/maplibre-gl-worker.mjs')

export type MapMode = 'mood' | 'delta'
const DEFAULT_CENTER: [number, number] = [105, 61]

export interface MapViewProps {
  values: Record<string, number | null | undefined>
  mode?: MapMode
  mini?: boolean
  interactive?: boolean
  initialCenter?: [number, number]
  onRegionClick?: (regionId: string, point: { x: number; y: number }) => void
  onBackgroundClick?: () => void
  onMapReady?: (map: maplibregl.Map) => void
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

// Яркие стопы единой шкалы (значение 0–100): красный → голубой → зелёный.
const MOOD_STOPS: Expression = [0, '#c0392b', 25, '#9f8187', 50, '#7ec8e3', 75, '#56caaa', 100, '#2ecc71']
const LAND_COLOR = '#424953'
const ADMIN_TILEJSON = 'https://tiles.openfreemap.org/planet'

function fillColorExpr(mode: MapMode): Expression {
  const stops: Expression = mode === 'mood'
    ? MOOD_STOPS
    : [-100, '#f46464', -25, '#b74652', 0, '#687685', 25, '#427be5', 100, '#76b7ff']
  const value = ['get', 'value']
  return ['case', ['==', value, null], 'transparent', ['interpolate', ['linear'], value, ...stops]]
}

// Вода задаётся фоном, суша рисуется слоем land-fill.
const EMPTY_STYLE: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#273857' } }],
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
  initialCenter = DEFAULT_CENTER,
  onRegionClick,
  onBackgroundClick,
  onMapReady,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const baseRef = useRef<GeoCollection | null>(null)
  const valuesRef = useRef(values)
  const modeRef = useRef(mode)
  const clickRef = useRef(onRegionClick)
  const bgClickRef = useRef(onBackgroundClick)
  const readyRef = useRef(onMapReady)

  valuesRef.current = values
  modeRef.current = mode
  clickRef.current = onRegionClick
  bgClickRef.current = onBackgroundClick
  readyRef.current = onMapReady

  useEffect(() => {
    if (!containerRef.current) return
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: EMPTY_STYLE,
      center: initialCenter,
      zoom: 3,
      interactive,
    })
    mapRef.current = map
    const controller = new AbortController()
    const observer = new ResizeObserver(() => map.resize())
    observer.observe(containerRef.current)

    map.on('load', () => {
      Promise.all([
        fetch(LAND_GEOJSON_URL, { signal: controller.signal }).then((r) => r.json() as Promise<GeoCollection>),
        fetch(GEOJSON_URL, { signal: controller.signal }).then((r) => r.json() as Promise<GeoCollection>),
      ])
        .then(([land, data]) => {
          if (controller.signal.aborted) return
          baseRef.current = data
          map.addSource('land', { type: 'geojson', data: land })
          map.addLayer({
            id: 'land-fill',
            type: 'fill',
            source: 'land',
            paint: { 'fill-color': LAND_COLOR, 'fill-antialias': false },
          })
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
          map.addSource('local-divisions', { type: 'vector', url: ADMIN_TILEJSON })
          map.addLayer({
            id: 'local-divisions-line',
            type: 'line',
            source: 'local-divisions',
            'source-layer': 'boundary',
            // В OpenMapTiles общий контур наследует самый низкий admin_level.
            // Межгосударственные и особые линии (уровни 2 и 3) не рисуем.
            filter: [
              'all',
              ['==', ['geometry-type'], 'LineString'],
              ['>=', ['get', 'admin_level'], 4],
              ['<=', ['get', 'admin_level'], 12],
              ['!=', ['get', 'disputed'], 1],
              ['!=', ['get', 'maritime'], 1],
              ['==', ['coalesce', ['get', 'claimed_by'], ''], ''],
              ['==', ['coalesce', ['get', 'disputed_name'], ''], ''],
              ['==', ['coalesce', ['get', 'adm0_l'], ''], ''],
              ['==', ['coalesce', ['get', 'adm0_r'], ''], ''],
            ],
            paint: {
              'line-color': '#aebac8',
              'line-opacity': ['step', ['get', 'admin_level'], 0.65, 6, 0.52, 8, 0.42],
              'line-width': ['interpolate', ['linear'], ['zoom'], 3, 0.85, 7, 1.25, 12, 1.5],
            },
          })
          if (interactive) {
            const clickedCity = (e: MapLayerMouseEvent) => {
              const layers = ['cities-circle', CITY_CLUSTER_LAYER].filter((layer) => map.getLayer(layer))
              return layers.length > 0 && map.queryRenderedFeatures(e.point, { layers }).length > 0
            }
            map.on('click', 'regions-fill', (e: MapLayerMouseEvent) => {
              if (clickedCity(e)) return
              const rid = e.features?.[0]?.properties?.region_id
              if (typeof rid === 'string' && e.originalEvent) {
                clickRef.current?.(rid, { x: e.originalEvent.clientX, y: e.originalEvent.clientY })
              }
            })
            map.on('mouseenter', 'regions-fill', () => {
              if (clickRef.current) map.getCanvas().style.cursor = 'pointer'
            })
            map.on('mouseleave', 'regions-fill', () => {
              map.getCanvas().style.cursor = ''
            })
            map.on('click', (e: maplibregl.MapMouseEvent) => {
              if (clickedCity(e)) return
              const feats = map.queryRenderedFeatures(e.point, { layers: ['regions-fill'] })
              if (feats.length === 0) {
                bgClickRef.current?.()
              }
            })
          }
          readyRef.current?.(map)
        })
        .catch(() => undefined)
    })

    return () => {
      controller.abort()
      observer.disconnect()
      map.remove()
      mapRef.current = null
      baseRef.current = null
    }
  }, [initialCenter, interactive])

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
