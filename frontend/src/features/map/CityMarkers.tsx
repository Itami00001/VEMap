import { useEffect, useRef } from 'react'
import * as maplibregl from 'maplibre-gl'
import type { MapLayerMouseEvent } from 'maplibre-gl'
import { api } from '../../services/api'
import { CITIES } from '../../data/cities'
import type { TimePeriod } from '../../types'
import { moodColor } from './color'

export interface CityMarkersProps {
  map: maplibregl.Map | null
  period: TimePeriod | null
  onCityClick?: (cityId: string) => void
}

const MARKER_RADIUS = 8

function tipHtml(name: string, mood: number | null, n: number | null): string {
  const category = mood == null ? 'нет данных' : mood >= 66.7 ? 'позитивному' : mood >= 33.3 ? 'нейтральному' : 'негативному'
  return `<div class="city-tip"><b>${name}</b><span>Настроение: ${mood == null ? '\u2014' : mood.toFixed(1)}</span><span>Публикаций: ${n ?? '\u2014'}</span><span>Ближе к: ${category}</span></div>`
}

function escapeHtml(value: string): string {
  const map: Record<string, string> = { '&': '&', '<': '<', '>': '>', '\u0027': '\u0027', '\u0022': '\u0022' }
  return value.replace(/[&<>'"]/g, (char) => map[char] ?? char)
}

export default function CityMarkers({ map, period, onCityClick }: CityMarkersProps) {
  const popupRef = useRef<maplibregl.Popup | null>(null)
  const onCityClickRef = useRef(onCityClick)
  onCityClickRef.current = onCityClick

  useEffect(() => {
    if (!map) return
    const ensureLayers = () => {
      if (!map.getSource('cities-source')) map.addSource('cities-source', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      if (!map.getLayer('cities-circle')) map.addLayer({
        id: 'cities-circle',
        type: 'circle',
        source: 'cities-source',
        paint: {
          'circle-radius': MARKER_RADIUS,
          'circle-color': ['get', 'color'],
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2,
          'circle-opacity': 0.95,
        },
      })
      if (!map.getLayer('cities-hover')) map.addLayer({
        id: 'cities-hover',
        type: 'circle',
        source: 'cities-source',
        paint: {
          'circle-radius': MARKER_RADIUS + 4,
          'circle-color': 'transparent',
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2,
          'circle-opacity': 0,
        },
      })
    }
    // Hover-тултип: компактный, без крестика, убирается на mouseleave.
    // На клик popup НЕ создаётся — данные уходят в CityPanel.
    const show = (feature: maplibregl.MapGeoJSONFeature) => {
      const p = feature.properties ?? {}
      const coords = (feature.geometry as { coordinates: [number, number] }).coordinates
      popupRef.current?.remove()
      popupRef.current = new maplibregl.Popup({ closeButton: false, closeOnClick: false, className: 'city-popup' }).setLngLat(coords).setHTML(tipHtml(escapeHtml(String(p.name)), Number(p.mood) || null, Number(p.count) || null)).addTo(map)
    }
    const move = (e: MapLayerMouseEvent) => { map.getCanvas().style.cursor = 'pointer'; map.setPaintProperty('cities-hover', 'circle-opacity', 1); show(e.features?.[0] as maplibregl.MapGeoJSONFeature) }
    const leave = () => { map.getCanvas().style.cursor = ''; map.setPaintProperty('cities-hover', 'circle-opacity', 0); popupRef.current?.remove() }
    const click = (e: MapLayerMouseEvent) => { const feature = e.features?.[0]; if (!feature) return; onCityClickRef.current?.(String(feature.properties?.city_id)); e.originalEvent.stopPropagation() }
    map.on('mouseenter', 'cities-circle', move)
    map.on('mouseleave', 'cities-circle', leave)
    map.on('click', 'cities-circle', click)
    const update = () => {
      if (!period) return
      api.getCityMoods(period.year, period.month).then((moods) => {
        const byId = new Map(moods.map((m) => [m.city_id, m]))
        const features = CITIES.filter((c) => c.lat != null && c.lon != null).map((city) => {
          const m = byId.get(city.city_id)
          const mood = m?.mood_index ?? null
          const norm = mood != null ? mood / 100 : 0
          const year = period.year
          return {
            type: 'Feature' as const,
            geometry: { type: 'Point' as const, coordinates: [city.lon!, city.lat!] },
            properties: {
              city_id: city.city_id,
              name: city.name_ru,
              mood,
              count: m?.responses_count ?? null,
              color: mood == null ? '#39404e' : moodColor(norm, year),
              radius: MARKER_RADIUS,
            },
          }
        })
        ;(map.getSource('cities-source') as maplibregl.GeoJSONSource).setData({ type: 'FeatureCollection', features })
      }).catch(() => undefined)
    }
    const initialize = () => {
      if (!map.isStyleLoaded()) return
      ensureLayers()
      update()
    }
    if (map.isStyleLoaded()) initialize()
    else map.once('load', initialize)
    return () => { map.off('load', initialize); map.off('mouseenter', 'cities-circle', move); map.off('mouseleave', 'cities-circle', leave); map.off('click', 'cities-circle', click); popupRef.current?.remove() }
  }, [map, period])

  return null
}