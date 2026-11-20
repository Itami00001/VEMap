import { useLayoutEffect, useRef } from 'react'
import * as maplibregl from 'maplibre-gl'
import type { MapLayerMouseEvent } from 'maplibre-gl'
import type { City, CityMood } from '../../types'
import { COLOR_GREEN, COLOR_NEUTRAL, COLOR_RED, lerpColor, sentimentColor } from './color'

export interface CityMarkersProps {
  map: maplibregl.Map | null
  cities: City[]
  cityMoods: CityMood[]
  loading: boolean
  error: boolean
  animationPaused?: boolean
  onCityClick?: (cityId: string) => void
}

const MARKER_RADIUS = 8
export const CITY_CLUSTER_LAYER = 'cities-clusters'
const FIRST_UNCLUSTERED_ZOOM = 5
const UNCLUSTERED: maplibregl.FilterSpecification = ['!', ['has', 'point_count']]
const CLUSTERED: maplibregl.FilterSpecification = ['has', 'point_count']
const NO_DATA_COLOR = '#39404e'

function tipHtml(name: string, mood: number | null, n: number | null, status: string): string {
  if (mood == null) return `<div class="city-tip"><b>${name}</b><span>${status}</span></div>`
  const category = mood >= 66.7 ? 'позитивному' : mood >= 33.3 ? 'нейтральному' : 'негативному'
  return `<div class="city-tip"><b>${name}</b><span>Настроение: ${mood.toFixed(1)}</span><span>Публикаций: ${n ?? '\u2014'}</span><span>Ближе к: ${category}</span></div>`
}

function escapeHtml(value: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  }
  return value.replace(/[&<>'"]/g, (char) => map[char] ?? char)
}

export default function CityMarkers({ map, cities, cityMoods, loading, error, animationPaused, onCityClick }: CityMarkersProps) {
  const onCityClickRef = useRef(onCityClick)
  const animationPausedRef = useRef(animationPaused)
  onCityClickRef.current = onCityClick
  animationPausedRef.current = animationPaused

  useLayoutEffect(() => {
    if (!map) return

    const byId = new Map(cityMoods.map((mood) => [mood.city_id, mood]))
    const features = cities.flatMap((city) => {
      if (city.lat == null || city.lon == null) return []
      const mood = byId.get(city.city_id)?.mood_index ?? null
      const color = mood == null ? NO_DATA_COLOR : sentimentColor(mood / 100)
      return [{
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [city.lon, city.lat] },
        properties: {
          city_id: city.city_id,
          name: city.name_ru,
          mood,
          color,
          glow: mood == null ? '#7c879a' : lerpColor(color, '#ffffff', 0.32),
        },
      }]
    })
    const data = { type: 'FeatureCollection' as const, features }
    const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, className: 'city-popup' })
    let hoveredCity: string | null = null
    let attached = false
    let frame = 0
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')

    let lastPaint = -Infinity
    const pulse = (time: number) => {
      if (!animationPausedRef.current && !motion.matches && time - lastPaint >= 30) {
        lastPaint = time
        const phase = (1 - Math.cos(time * 2 * Math.PI / 1600)) / 2
        map.setPaintProperty('cities-glow', 'circle-radius', MARKER_RADIUS + 4 + 18 * phase)
        map.setPaintProperty('cities-glow', 'circle-opacity', 0.95 - 0.65 * phase)
      }
      frame = window.requestAnimationFrame(pulse)
    }

    const leave = () => {
      hoveredCity = null
      popup.remove()
      map.getCanvas().style.cursor = ''
    }

    const move = (event: MapLayerMouseEvent) => {
      const feature = event.features?.[0]
      if (feature?.geometry.type !== 'Point') {
        leave()
        return
      }
      const { city_id: cityId, name } = feature.properties
      if (cityId === hoveredCity) return
      hoveredCity = cityId
      map.getCanvas().style.cursor = 'pointer'
      const mood = byId.get(cityId)
      const status = loading ? 'Загрузка…' : error ? 'Ошибка загрузки' : 'Нет данных'
      const [longitude, latitude] = feature.geometry.coordinates
      const wrappedLongitude = longitude + 360 * Math.round((event.lngLat.lng - longitude) / 360)
      popup.setLngLat([wrappedLongitude, latitude])
        .setHTML(tipHtml(escapeHtml(String(name)), mood?.mood_index ?? null, mood?.responses_count ?? null, status))
      if (!popup.isOpen()) popup.addTo(map)
    }

    const click = (event: MapLayerMouseEvent) => {
      const feature = event.features?.[0]
      if (!feature) return
      onCityClickRef.current?.(String(feature.properties.city_id))
    }

    const enterCluster = () => { map.getCanvas().style.cursor = 'pointer' }
    const clickCluster = (event: MapLayerMouseEvent) => {
      const feature = event.features?.[0]
      if (!feature || feature.geometry.type !== 'Point') return
      const [longitude, latitude] = feature.geometry.coordinates
      const center: [number, number] = [
        longitude + 360 * Math.round((event.lngLat.lng - longitude) / 360), latitude,
      ]
      map.easeTo({ center, zoom: FIRST_UNCLUSTERED_ZOOM })
    }

    const initialize = () => {
      const source = map.getSource<maplibregl.GeoJSONSource>('cities-source')
      if (source) source.setData(data)
      else map.addSource('cities-source', {
        type: 'geojson', data, cluster: true, clusterRadius: 45,
        clusterMaxZoom: FIRST_UNCLUSTERED_ZOOM - 1,
        clusterProperties: {
          moodSum: ['+', ['coalesce', ['get', 'mood'], 0]],
          moodCount: ['+', ['case', ['==', ['get', 'mood'], null], 0, 1]],
        },
      })
      if (!map.getLayer('cities-glow')) map.addLayer({
        id: 'cities-glow',
        type: 'circle',
        source: 'cities-source',
        filter: UNCLUSTERED,
        paint: {
          'circle-radius': MARKER_RADIUS + 5,
          'circle-color': ['get', 'glow'],
          'circle-blur': 0.45,
          'circle-opacity': 0.6,
        },
      })
      if (!map.getLayer('cities-circle')) map.addLayer({
        id: 'cities-circle',
        type: 'circle',
        source: 'cities-source',
        filter: UNCLUSTERED,
        paint: {
          'circle-radius': MARKER_RADIUS,
          'circle-color': ['get', 'color'],
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2,
          'circle-opacity': 0.95,
        },
      })
      if (!map.getLayer(CITY_CLUSTER_LAYER)) map.addLayer({
        id: CITY_CLUSTER_LAYER,
        type: 'circle',
        source: 'cities-source',
        filter: CLUSTERED,
        maxzoom: FIRST_UNCLUSTERED_ZOOM,
        paint: {
          'circle-radius': 17,
          'circle-color': [
            'case', ['>', ['number', ['get', 'moodCount']], 0],
            ['interpolate', ['linear'],
              ['/', ['number', ['get', 'moodSum']], ['number', ['get', 'moodCount']]],
              0, COLOR_RED, 50, COLOR_NEUTRAL, 100, COLOR_GREEN,
            ],
            NO_DATA_COLOR,
          ],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#bfdbfe',
        },
      })
      if (!map.getLayer('cities-cluster-count')) map.addLayer({
        id: 'cities-cluster-count',
        type: 'symbol',
        source: 'cities-source',
        filter: CLUSTERED,
        maxzoom: FIRST_UNCLUSTERED_ZOOM,
        layout: {
          'text-field': ['to-string', ['get', 'point_count']],
          'text-size': 13,
          'text-allow-overlap': true,
        },
        paint: { 'text-color': '#ffffff', 'text-halo-color': '#000000', 'text-halo-width': 2 },
      })
      map.on('mouseenter', 'cities-circle', move)
      map.on('mousemove', 'cities-circle', move)
      map.on('mouseleave', 'cities-circle', leave)
      map.on('click', 'cities-circle', click)
      map.on('mouseenter', CITY_CLUSTER_LAYER, enterCluster)
      map.on('mouseleave', CITY_CLUSTER_LAYER, leave)
      map.on('click', CITY_CLUSTER_LAYER, clickCluster)
      frame = window.requestAnimationFrame(pulse)
      attached = true
    }

    if (map.getLayer('regions-fill') || map.isStyleLoaded()) initialize()
    else map.once('load', initialize)
    return () => {
      map.off('load', initialize)
      if (!attached) return
      window.cancelAnimationFrame(frame)
      map.off('mouseenter', 'cities-circle', move)
      map.off('mousemove', 'cities-circle', move)
      map.off('mouseleave', 'cities-circle', leave)
      map.off('click', 'cities-circle', click)
      map.off('mouseenter', CITY_CLUSTER_LAYER, enterCluster)
      map.off('mouseleave', CITY_CLUSTER_LAYER, leave)
      map.off('click', CITY_CLUSTER_LAYER, clickCluster)
      leave()
    }
  }, [map, cities, cityMoods, loading, error])

  return null
}
