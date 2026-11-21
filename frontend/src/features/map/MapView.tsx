import { useEffect, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import type { FeatureCollection, MultiPolygon, Polygon } from 'geojson'
import type { MapLayerMouseEvent, StyleSpecification } from 'maplibre-gl'
import { GEOJSON_URL, WORLD_GEOJSON_URL } from '../../services/api'
import { CITY_CLUSTER_LAYER } from './CityMarkers'
import { MOOD_STOPS } from './color'
import HistoricalBordersLayer from './historical/HistoricalBordersLayer'
import { useHistoricalBorders } from './historical/useHistoricalBorders'

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
  year?: number | null
  initialCenter?: [number, number]
  onRegionClick?: (regionId: string, point: { x: number; y: number }) => void
  onBackgroundClick?: () => void
  onMapReady?: (map: maplibregl.Map) => void
}

type GeoCollection = FeatureCollection<Polygon | MultiPolygon, Record<string, unknown>>

type Expression = unknown[]

const RUSSIA_FILL = '#416d73'
const LAND_FILL = '#424953'
const CLAIMS_GEOJSON_URL = `${import.meta.env.BASE_URL}data/geo/russian-claims-2022.geojson`
const isCrimea: Expression = ['in', ['get', 'region_id'], ['literal', ['RU-CR', 'RU-SEV']]]

export function BoundaryNote() {
  return (
    <p className="map-boundary-note muted">
      Подложка для всех периодов показывает границы в российской трактовке.{' '}
      <a href="https://digitallibrary.un.org/record/3990673?ln=ru" target="_blank" rel="noreferrer">Резолюция ГА ООН ES-11/4</a>
      {' · '}
      <a href="https://www.geoboundaries.org/api/current/gbOpen/UKR/ADM1/" target="_blank" rel="noreferrer">geoBoundaries</a>
      {' · '}
      <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap, ODbL</a>
    </p>
  )
}

function regionsLinePaint(dimCrimea: boolean) {
  return {
    color: ['case', isCrimea, dimCrimea ? '#2e343b' : '#ffffff', '#6b7484'] as never,
    width: ['case', isCrimea, dimCrimea ? 0.5 : 2.5, 0.5] as never,
  }
}

function fillColorExpr(mode: MapMode): Expression {
  const stops = mode === 'mood'
    ? MOOD_STOPS
    : [-100, '#f46464', -25, '#b74652', 0, '#687685', 25, '#427be5', 100, '#76b7ff']
  const value = ['get', 'value']
  return ['case', ['==', value, null], ['case', isCrimea, RUSSIA_FILL, 'transparent'],
    ['interpolate', ['linear'], value, ...stops]]
}

// Вода задаётся фоном, суша рисуется слоем countries-fill.
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
  year = null,
  initialCenter = DEFAULT_CENTER,
  onRegionClick,
  onBackgroundClick,
  onMapReady,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const [mapInstance, setMapInstance] = useState<maplibregl.Map | null>(null)
  const historical = useHistoricalBorders(year)
  const dimCrimea = historical !== null && !historical.keepModernHighlight
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
      attributionControl: false,
    })
    mapRef.current = map
    const controller = new AbortController()
    const observer = new ResizeObserver(() => map.resize())
    observer.observe(containerRef.current)

    map.on('load', () => {
      Promise.all([
        fetch(WORLD_GEOJSON_URL, { signal: controller.signal }).then((r) => r.json() as Promise<GeoCollection>),
        fetch(CLAIMS_GEOJSON_URL, { signal: controller.signal }).then((r) => r.json() as Promise<GeoCollection>),
        fetch(GEOJSON_URL, { signal: controller.signal }).then((r) => r.json() as Promise<GeoCollection>),
      ])
        .then(([world, claims, data]) => {
          if (controller.signal.aborted) return
          baseRef.current = data
          map.addSource('world', { type: 'geojson', data: world })
          map.addLayer({
            id: 'countries-fill',
            type: 'fill',
            source: 'world',
            paint: {
              'fill-color': ['match', ['get', 'ISO_A3'],
                'RUS', RUSSIA_FILL, LAND_FILL],
            },
          })
          map.addSource('russian-claims', { type: 'geojson', data: claims })
          map.addLayer({
            id: 'russian-claims-fill',
            type: 'fill',
            source: 'russian-claims',
            paint: { 'fill-color': RUSSIA_FILL },
          })
          map.addLayer({
            id: 'countries-line',
            type: 'line',
            source: 'world',
            paint: {
              'line-color': ['match', ['get', 'ISO_A3'],
                'RUS', '#ffffff', '#697482'],
              'line-width': ['match', ['get', 'ISO_A3'], 'RUS', 2, 1],
            },
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
          const regionStroke = regionsLinePaint(false)
          map.addLayer({
            id: 'regions-line',
            type: 'line',
            source: 'regions',
            paint: {
              'line-color': regionStroke.color,
              'line-width': regionStroke.width,
            },
          })
          map.addLayer({
            id: 'russian-claims-line',
            type: 'line',
            source: 'russian-claims',
            paint: { 'line-color': '#d1e3e6', 'line-width': 1.2, 'line-dasharray': [3, 2] },
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
          setMapInstance(map)
        })
        .catch(() => undefined)
    })

    return () => {
      controller.abort()
      observer.disconnect()
      map.remove()
      mapRef.current = null
      baseRef.current = null
      setMapInstance(null)
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

  useEffect(() => {
    if (!mapInstance) return
    const { color, width } = regionsLinePaint(dimCrimea)
    mapInstance.setPaintProperty('regions-line', 'line-color', color)
    mapInstance.setPaintProperty('regions-line', 'line-width', width)
  }, [mapInstance, dimCrimea])

  return (
    <>
      <div ref={containerRef} className={`map-canvas${mini ? ' mini' : ''}`} />
      <HistoricalBordersLayer map={mapInstance} url={historical?.geojsonUrl ?? null} beforeId="russian-claims-fill" />
    </>
  )
}
