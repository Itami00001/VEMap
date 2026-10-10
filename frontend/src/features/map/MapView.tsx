import { useEffect, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import type { MapLayerMouseEvent, StyleSpecification } from 'maplibre-gl'
import { GEOJSON_URL, WORLD_GEOJSON_URL } from '../../services/api'
import HistoricalBordersLayer from './historical/HistoricalBordersLayer'
import { useHistoricalBorders } from './historical/useHistoricalBorders'

// Воркер maplibre-gl v6 резолвится относительно бандла (./maplibre-gl-worker.mjs),
// который Vite не эмитит -> 404 text/html -> карта мертва.
// Поэтому файлы maplibre-gl-worker.mjs + maplibre-gl-shared.mjs лежат в public/
// (копия из node_modules/maplibre-gl/dist, версия 6.11.2 — при обновлении пакета
// скопировать заново) и URL задан явно.
maplibregl.setWorkerUrl('/maplibre-gl-worker.mjs')

export type MapMode = 'mood' | 'delta'

export interface MapViewProps {
  values: Record<string, number | null | undefined>
  mode?: MapMode
  mini?: boolean
  interactive?: boolean
  year?: number | null
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

function fillColorExpr(mode: MapMode): Expression {
  const stops: Expression =
    mode === 'mood'
      ? ['interpolate', ['linear'], ['get', 'value'], 0, '#c0392b', 25, '#e67e22', 50, '#f1c40f', 75, '#7cb342', 100, '#2ecc71']
      : ['interpolate', ['linear'], ['get', 'value'], -10, '#d64545', 0, '#3d4657', 10, '#4f8cff']
  return ['case', ['==', ['get', 'value'], null], '#39404e', stops]
}

// Подложка стран: РФ и Украина — небесно-голубые, остальные — серые.
// Крым (RU-CR, RU-SEV) красится слоем regions-fill (там есть данные),
// отдельный highlight-слой не нужен.
function countryColorExpr(): Expression {
  return ['match', ['get', 'ISO_A3'], ['RUS', 'UKR'], '#7ec8e3', '#2a2f36']
}

// Яркие границы для РФ, Украины, Крыма, Севастополя.
function highlightBorderExpr(): Expression {
  return [
    'case',
    ['in', ['get', 'ISO_A3'], ['literal', ['RUS', 'UKR']]],
    '#ffffff',
    '#6b7484',
  ]
}

// Пустая подложка вместо внешнего demotiles-стиля: только тёмная вода.
// Сушу рисует исключительно наш countries-fill (серый) — interference
// базовых слоёв (landcover/landuse/boundary) исключена в принципе.
const EMPTY_STYLE: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#0d1b2a' } }],
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
  year = null,
  onRegionClick,
  onBackgroundClick,
  onMapReady,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const [mapInstance, setMapInstance] = useState<maplibregl.Map | null>(null)
  const empireUrl = useHistoricalBorders(year)

  useEffect(() => {
    console.log('[VEMap] historical layer', { year, url: empireUrl })
  }, [empireUrl])
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
      center: [105, 61],
      zoom: 3,
      interactive,
      // Атрибуция отключена: AttributionControl со шторкой не нужен.
      attributionControl: false,
    })
    mapRef.current = map

    map.on('load', () => {
      Promise.all([
        fetch(WORLD_GEOJSON_URL).then((r) => r.json() as Promise<GeoCollection>),
        fetch(GEOJSON_URL).then((r) => r.json() as Promise<GeoCollection>),
      ])
        .then(([world, data]) => {
          if (!mapRef.current || !map.isStyleLoaded()) return
          baseRef.current = data
          if (!map.getSource('world')) {
            map.addSource('world', { type: 'geojson', data: world })
          }
          if (!map.getLayer('countries-fill')) map.addLayer({
            id: 'countries-fill',
            type: 'fill',
            source: 'world',
            paint: {
              'fill-color': countryColorExpr() as never,
              'fill-opacity': 1,
            },
          })
          if (!map.getSource('regions')) map.addSource('regions', {
            type: 'geojson',
            data: applyValues(data, valuesRef.current),
          })
          if (!map.getLayer('regions-fill')) map.addLayer({
            id: 'regions-fill',
            type: 'fill',
            source: 'regions',
            paint: {
              'fill-color': fillColorExpr(modeRef.current) as never,
              'fill-opacity': 0.85,
            },
          })
          if (!map.getLayer('regions-line')) map.addLayer({
            id: 'regions-line',
            type: 'line',
            source: 'regions',
            paint: {
              // Крым и Севастополь — широкие белые границы, остальные — тонкие серые.
              'line-color': ['case', ['in', ['get', 'region_id'], ['literal', ['RU-CR', 'RU-SEV']]], '#ffffff', '#6b7484'],
              'line-width': ['case', ['in', ['get', 'region_id'], ['literal', ['RU-CR', 'RU-SEV']]], 2.5, 0.5],
            },
          })
          // Границы стран поверх регионов: серые для всех, белые для РФ и Украины.
          if (!map.getLayer('countries-line')) map.addLayer({
            id: 'countries-line',
            type: 'line',
            source: 'world',
            paint: {
              'line-color': highlightBorderExpr() as never,
              'line-width': ['case', ['in', ['get', 'ISO_A3'], ['literal', ['RUS', 'UKR']]], 2.5, 0.5],
            },
          })
          if (interactive) {
            map.on('click', 'regions-fill', (e: MapLayerMouseEvent) => {
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
            map.on('click', (e: maplibregl.MapMouseEvent) => {
              const feats = map.queryRenderedFeatures(e.point, { layers: ['regions-fill'] })
              if (feats.length === 0) {
                bgClickRef.current?.()
              }
            })
          }
          readyRef.current?.(map)
          setMapInstance(map)
        })
        .catch(() => undefined)
    })

    return () => {
      map.remove()
      mapRef.current = null
      baseRef.current = null
      setMapInstance(null)
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    const base = baseRef.current
    if (!map || !base) return
    const source = map.getSource('regions') as maplibregl.GeoJSONSource | undefined
    if (!source) return
    source.setData(applyValues(base, values))
    map.setPaintProperty('regions-fill', 'fill-color', fillColorExpr(mode) as never)
  }, [values, mode])

  return (
    <>
      <div ref={containerRef} className={`map-canvas${mini ? ' mini' : ''}`} />
      <HistoricalBordersLayer map={mapInstance} url={empireUrl} />
    </>
  )
}
