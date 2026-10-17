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
  ukraineMood?: number | null
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

function fillColorExpr(mode: MapMode): Expression {
  // Единая яркая шкала с точками: 0 красный → 0.5 голубой → 1 зелёный.
  // Без старения: цвет яркий в любом году. null → серый «нет данных».
  const stops: Expression =
    mode === 'mood'
      ? ['interpolate', ['linear'], ['get', 'value'], ...MOOD_STOPS]
      : ['interpolate', ['linear'], ['get', 'value'], -10, '#d64545', 0, '#3d4657', 10, '#4f8cff']
  return ['case', ['==', ['get', 'value'], null], '#39404e', stops]
}

// Приглушённый серый прочих стран мира: подложка есть, но не отвлекает.
const DIM_BORDER = '#2e343b'
// Внутренние границы регионов РФ — чуть светлее (РФ — целевая страна).
const REGION_BORDER = '#6b7484'

// Подложка стран: Украина — настроением своих городов (свойство ukr),
// нет данных → серая. РФ — голубая, весь прочий мир — максимально
// приглушённый серый (ярко выделяем только РФ, УК и Крым).
function countryColorExpr(): Expression {
  return [
    'case',
    ['==', ['get', 'ISO_A3'], 'UKR'],
    ['case', ['==', ['get', 'ukr'], null], '#39404e', ['interpolate', ['linear'], ['get', 'ukr'], ...MOOD_STOPS]],
    ['match', ['get', 'ISO_A3'], ['RUS'], '#7ec8e3', '#171c22'],
  ]
}

// dimModern=true (исторический снимок 1904/1905/1917): современные белые
// подсветки РФ/УК/Крыма гаснут — белой остаётся только граница года.
// dimModern=false (1991/2026 или без снимка): РФ/УК/Крым белые.
function countriesLinePaint(dimModern: boolean) {
  return {
    color: [
      'case',
      ['==', ['get', 'ISO_A3'], 'UKR'],
      dimModern ? DIM_BORDER : '#ffffff',
      ['==', ['get', 'ISO_A3'], 'RUS'],
      dimModern ? DIM_BORDER : '#ffffff',
      DIM_BORDER,
    ] as never,
    width: [
      'case',
      ['in', ['get', 'ISO_A3'], ['literal', ['RUS', 'UKR']]],
      dimModern ? 0.5 : 2.5,
      0.5,
    ] as never,
  }
}

function regionsLinePaint(dimModern: boolean) {
  return {
    color: [
      'case',
      ['in', ['get', 'region_id'], ['literal', ['RU-CR', 'RU-SEV']]],
      dimModern ? DIM_BORDER : '#ffffff',
      REGION_BORDER,
    ] as never,
    width: [
      'case',
      ['in', ['get', 'region_id'], ['literal', ['RU-CR', 'RU-SEV']]],
      dimModern ? 0.5 : 2.5,
      0.5,
    ] as never,
  }
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

function applyUkraine(base: GeoCollection, mood: number | null): GeoCollection {
  return {
    type: 'FeatureCollection',
    features: base.features.map((f) => ({
      ...f,
      properties: {
        ...f.properties,
        ukr: f.properties.ISO_A3 === 'UKR' ? mood : null,
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
  ukraineMood = null,
  onRegionClick,
  onBackgroundClick,
  onMapReady,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const [mapInstance, setMapInstance] = useState<maplibregl.Map | null>(null)
  const empireRange = useHistoricalBorders(year)
  const empireUrl = empireRange?.geojsonUrl ?? null
  // Снимок 1991/2026 совпадает с современным контуром РФ — не приглушаем
  // современные белые линии РФ/УК/Крыма.
  const dimModern = empireUrl != null && !empireRange?.keepModernHighlight

  useEffect(() => {
    console.log('[VEMap] historical layer', { year, url: empireUrl, dimModern })
  }, [empireUrl, dimModern])
  const baseRef = useRef<GeoCollection | null>(null)
  const worldRef = useRef<GeoCollection | null>(null)
  const dimModernRef = useRef(dimModern)
  const valuesRef = useRef(values)
  const modeRef = useRef(mode)
  const ukraineRef = useRef(ukraineMood)
  const clickRef = useRef(onRegionClick)
  const bgClickRef = useRef(onBackgroundClick)
  const readyRef = useRef(onMapReady)

  valuesRef.current = values
  modeRef.current = mode
  dimModernRef.current = dimModern
  ukraineRef.current = ukraineMood
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
          worldRef.current = world
          if (!map.getSource('world')) {
            map.addSource('world', { type: 'geojson', data: applyUkraine(world, ukraineRef.current) })
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
            // Крым/Севастополь — белые, прочие — тонкие серые; при
            // активном историческом слое белый выключается (см. helper).
            paint: {
              'line-color': regionsLinePaint(dimModernRef.current).color,
              'line-width': regionsLinePaint(dimModernRef.current).width,
            },
          })
          // Границы стран поверх регионов: серые для всех, белые для РФ и Украины.
          if (!map.getLayer('countries-line')) map.addLayer({
            id: 'countries-line',
            type: 'line',
            source: 'world',
            // РФ/Украина — белые; при активном историческом слое
            // приглушаются, чтобы белой осталась только граница года.
            paint: {
              'line-color': countriesLinePaint(dimModernRef.current).color,
              'line-width': countriesLinePaint(dimModernRef.current).width,
            },
          })
          // Диагностика: где реально белые линии и сколько объектов в
          // источниках. regions-fill покрывает ТОЛЬКО РФ (+Крым), Украина
          // едет отдельным свойством ukr на world-слое.
            const highlight = dimModernRef.current
              ? 'dim: modern RUS/UKR/CR borders greyed (imperial snapshot)'
              : 'bright: countries-line RUS,UKR white 2.5 | regions-line RU-CR,RU-SEV white 2.5'
            console.log('[VEMap] base layers', {
              layerOrder: (map.getStyle().layers ?? []).map((l) => l.id).join(' > '),
              worldFeatures: world.features.length,
              regionFeatures: data.features.length,
              highlight,
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
      worldRef.current = null
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

  useEffect(() => {
    const map = mapRef.current
    const world = worldRef.current
    if (!map || !world) return
    const source = map.getSource('world') as maplibregl.GeoJSONSource | undefined
    if (!source) return
    source.setData(applyUkraine(world, ukraineMood))
  }, [ukraineMood])

  // Исторический слой включился/выключился или сменился тип снимка →
  // перекрасить современные линии: белые подсветки РФ/УК/Крыма гаснут
  // для имперских снимков, белой остаётся граница года.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.getLayer('countries-line')) return
    const active = dimModern
    const c = countriesLinePaint(active)
    const r = regionsLinePaint(active)
    map.setPaintProperty('countries-line', 'line-color', c.color)
    map.setPaintProperty('countries-line', 'line-width', c.width)
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
