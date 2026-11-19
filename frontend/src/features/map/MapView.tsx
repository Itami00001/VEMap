import { useEffect, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import type { MapLayerMouseEvent, StyleSpecification } from 'maplibre-gl'
import { GEOJSON_URL, WORLD_GEOJSON_URL } from '../../services/api'
import HistoricalBordersLayer from './historical/HistoricalBordersLayer'
import { useHistoricalBorders } from './historical/useHistoricalBorders'
import { CITY_CLUSTER_LAYER } from './CityMarkers'
import type { TimePeriod } from '../../types'

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
  compare?: boolean
  mini?: boolean
  interactive?: boolean
  year?: number | null
  month?: number | null
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

function showsRussianClaims(year: number | null, month: number | null) {
  return year !== null && (year > 2022 || (year === 2022 && (month ?? 12) >= 10))
}

export function BoundaryNote({ period }: { period: TimePeriod | null }) {
  if (!period || !showsRussianClaims(period.year, period.month)) return null
  return (
    <p className="map-boundary-note muted">
      Пунктир — административные контуры по законодательству РФ. Линия фактического контроля не показана.{' '}
      <a href="https://mandates.un.org/mandate/A/RES/ES-11/4" target="_blank" rel="noreferrer">Резолюция ГА ООН ES-11/4</a>
      {' · '}Контуры: <a href="https://www.geoboundaries.org/api/current/gbOpen/UKR/ADM1/" target="_blank" rel="noreferrer">geoBoundaries</a>,{' '}
      <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> (ODbL).
    </p>
  )
}

// Яркие стопы единой шкалы (значение 0–100): красный → голубой → зелёный.
const MOOD_STOPS: Expression = [0, '#c0392b', 25, '#9f8187', 50, '#7ec8e3', 75, '#56caaa', 100, '#2ecc71']
const RUSSIA_FILL = '#416d73'
const UKRAINE_FILL = '#83754b'
const CRIMEA_REGIONS = ['RU-CR', 'RU-SEV']

function fillColorExpr(mode: MapMode, compare: boolean): Expression {
  // Единая яркая шкала с точками: 0 красный → 0.5 голубой → 1 зелёный.
  const stops: Expression =
    mode === 'mood'
      ? ['interpolate', ['linear'], ['get', 'value'], ...MOOD_STOPS]
      : ['interpolate', ['linear'], ['get', 'value'], -100, '#f46464', -25, '#b74652', 0, '#687685', 25, '#427be5', 100, '#76b7ff']
  const background = ['case', ['in', ['get', 'region_id'], ['literal', CRIMEA_REGIONS]], RUSSIA_FILL, 'transparent']
  return ['case',
    ['any', ['==', ['get', 'value'], null], ['all', !compare, ['in', ['get', 'region_id'], ['literal', CRIMEA_REGIONS]]]],
    background, stops]
}

const DIM_BORDER = '#2e343b'
// Внутренние границы регионов РФ — чуть светлее (РФ — целевая страна).
const REGION_BORDER = '#6b7484'

function regionsLinePaint(dimModern: boolean) {
  return {
    color: [
      'case',
      ['in', ['get', 'region_id'], ['literal', CRIMEA_REGIONS]],
      dimModern ? DIM_BORDER : '#ffffff',
      REGION_BORDER,
    ] as never,
    width: [
      'case',
      ['in', ['get', 'region_id'], ['literal', CRIMEA_REGIONS]],
      dimModern ? 0.5 : 2.5,
      0.5,
    ] as never,
  }
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
  compare = false,
  mini = false,
  interactive = true,
  year = null,
  month = null,
  initialCenter = DEFAULT_CENTER,
  onRegionClick,
  onBackgroundClick,
  onMapReady,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const [mapInstance, setMapInstance] = useState<maplibregl.Map | null>(null)
  const empireRange = useHistoricalBorders(year)
  const empireUrl = empireRange?.geojsonUrl ?? null
  // Для имперского снимка приглушаем региональные линии Крыма.
  const dimModern = empireUrl != null && !empireRange?.keepModernHighlight

  const baseRef = useRef<GeoCollection | null>(null)
  const dimModernRef = useRef(dimModern)
  const valuesRef = useRef(values)
  const modeRef = useRef(mode)
  const compareRef = useRef(compare)
  const clickRef = useRef(onRegionClick)
  const bgClickRef = useRef(onBackgroundClick)
  const readyRef = useRef(onMapReady)

  valuesRef.current = values
  modeRef.current = mode
  compareRef.current = compare
  dimModernRef.current = dimModern
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
      // Атрибуция отключена: AttributionControl со шторкой не нужен.
      attributionControl: false,
    })
    mapRef.current = map
    const observer = new ResizeObserver(() => map.resize())
    observer.observe(containerRef.current)

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
              'fill-color': [
                'match', ['get', 'ISO_A3'],
                'RUS', RUSSIA_FILL,
                'UKR', UKRAINE_FILL,
                '#424953',
              ],
            },
          })
          if (!map.getLayer('countries-line')) map.addLayer({
            id: 'countries-line',
            type: 'line',
            source: 'world',
            paint: {
              'line-color': [
                'match', ['get', 'ISO_A3'],
                'RUS', '#ffffff',
                'UKR', '#f1d778',
                '#697482',
              ],
              'line-width': ['match', ['get', 'ISO_A3'], ['RUS', 'UKR'], 2, 1],
            },
          })
          map.addSource('russian-claims', {
            type: 'geojson',
            data: `${import.meta.env.BASE_URL}data/geo/russian-claims-2022.geojson`,
          })
          map.addLayer({
            id: 'russian-claims-fill',
            type: 'fill',
            source: 'russian-claims',
            layout: { visibility: 'none' },
            paint: { 'fill-color': RUSSIA_FILL },
          })
          map.addLayer({
            id: 'russian-claims-line',
            type: 'line',
            source: 'russian-claims',
            layout: { visibility: 'none' },
            paint: { 'line-color': '#d1e3e6', 'line-width': 1.2, 'line-dasharray': [3, 2] },
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
              'fill-color': fillColorExpr(modeRef.current, compareRef.current) as never,
              'fill-opacity': [
                'case', ['in', ['get', 'region_id'], ['literal', CRIMEA_REGIONS]], 1, 0.85,
              ],
            },
          })
          if (!map.getLayer('regions-line')) map.addLayer({
            id: 'regions-line',
            type: 'line',
            source: 'regions',
            // Крым/Севастополь — белые, прочие — тонкие серые; при
            // активном историческом слое белый выключается (см. helper).
            paint: {
              'line-color': regionsLinePaint(dimModernRef.current).color,
              'line-width': regionsLinePaint(dimModernRef.current).width,
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
              map.getCanvas().style.cursor = 'pointer'
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
      observer.disconnect()
      map.remove()
      mapRef.current = null
      baseRef.current = null
      setMapInstance(null)
    }
  }, [initialCenter])

  useEffect(() => {
    const map = mapRef.current
    const base = baseRef.current
    if (!map || !base) return
    const source = map.getSource('regions') as maplibregl.GeoJSONSource | undefined
    if (!source) return
    source.setData(applyValues(base, values))
    map.setPaintProperty('regions-fill', 'fill-color', fillColorExpr(mode, compare) as never)
  }, [values, mode, compare])

  useEffect(() => {
    if (!mapInstance) return
    const visibility = showsRussianClaims(year, month) ? 'visible' : 'none'
    mapInstance.setLayoutProperty('russian-claims-fill', 'visibility', visibility)
    mapInstance.setLayoutProperty('russian-claims-line', 'visibility', visibility)
  }, [mapInstance, year, month])

  // Стиль региональных линий зависит от исторического слоя.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.getLayer('regions-line')) return
    const active = dimModern
    const r = regionsLinePaint(active)
    if (map.getLayer('regions-line')) {
      map.setPaintProperty('regions-line', 'line-color', r.color)
      map.setPaintProperty('regions-line', 'line-width', r.width)
    }
  }, [dimModern, mapInstance])

  return (
    <>
      <div ref={containerRef} className={`map-canvas${mini ? ' mini' : ''}`} />
      <HistoricalBordersLayer map={mapInstance} url={empireUrl} />
    </>
  )
}
