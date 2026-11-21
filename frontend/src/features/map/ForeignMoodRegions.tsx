import { useEffect, useMemo, useState } from 'react'
import { booleanPointInPolygon } from '@turf/boolean-point-in-polygon'
import type { FeatureCollection, MultiPolygon, Polygon } from 'geojson'
import type { GeoJSONSource, Map as LibreMap } from 'maplibre-gl'
import type { City, CityMood } from '../../types'
import { MOOD_STOPS } from './color'

const SOURCE_ID = 'foreign-mood-regions'
const FILL_LAYER_ID = 'foreign-mood-regions-fill'
const LINE_LAYER_ID = 'foreign-mood-regions-line'
const REGION_URL = `${import.meta.env.BASE_URL}data/geo/foreign-regions.geojson`

type RegionProperties = { adm1_id: string; name: string }
type Regions = FeatureCollection<Polygon | MultiPolygon, RegionProperties>
const EMPTY_REGIONS: Regions = { type: 'FeatureCollection', features: [] }

function findCityRegions(regions: Regions, cities: City[]): Map<string, string> {
  const result = new Map<string, string>()
  for (const { city_id, region_id, lat, lon } of cities) {
    if (region_id || lat == null || lon == null || !Number.isFinite(lat) || !Number.isFinite(lon)) continue
    const position = [lon, lat]
    const matches = regions.features.filter((feature) =>
      booleanPointInPolygon(position, feature, { ignoreBoundary: true }))
    if (matches.length === 1) result.set(city_id, matches[0].properties.adm1_id)
  }
  return result
}

function moodRegions(regions: Regions, cityRegions: Map<string, string>, moods: CityMood[]): Regions {
  const totals = new Map<string, { sum: number; cities: number; weighted: number; lines: number }>()
  for (const { city_id, mood_index, responses_count } of moods) {
    const regionId = cityRegions.get(city_id)
    if (!regionId || !Number.isFinite(mood_index)) continue
    const count = Math.max(0, responses_count || 0)
    const total = totals.get(regionId) ?? { sum: 0, cities: 0, weighted: 0, lines: 0 }
    total.sum += mood_index
    total.cities += 1
    total.weighted += mood_index * count
    total.lines += count
    totals.set(regionId, total)
  }
  return {
    type: 'FeatureCollection',
    features: regions.features.flatMap((feature) => {
      const total = totals.get(feature.properties.adm1_id)
      if (!total) return []
      const value = total.lines > 0 ? total.weighted / total.lines : total.sum / total.cities
      return [{ ...feature, properties: { ...feature.properties, value } }]
    }),
  }
}

export default function ForeignMoodRegions({ map, cities, moods }: {
  map: LibreMap | null
  cities: City[]
  moods: CityMood[]
}) {
  const [regions, setRegions] = useState<Regions>(EMPTY_REGIONS)

  useEffect(() => {
    const controller = new AbortController()
    fetch(REGION_URL, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('Could not load foreign administrative regions')
        const data: Regions = await response.json()
        if (!controller.signal.aborted) setRegions(data)
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) console.warn('Foreign mood regions unavailable', error)
      })
    return () => controller.abort()
  }, [])

  const cityRegions = useMemo(() => findCityRegions(regions, cities), [regions, cities])
  const colored = useMemo(() => moodRegions(regions, cityRegions, moods), [regions, cityRegions, moods])

  useEffect(() => {
    if (!map) return
    map.addSource(SOURCE_ID, { type: 'geojson', data: EMPTY_REGIONS })
    // Keep the separate basemap treatment for the four areas above the international layer.
    map.addLayer({
      id: FILL_LAYER_ID,
      type: 'fill',
      source: SOURCE_ID,
      paint: { 'fill-color': ['interpolate', ['linear'], ['get', 'value'], ...MOOD_STOPS], 'fill-opacity': 0.85 },
    }, 'russian-claims-fill')
    map.addLayer({
      id: LINE_LAYER_ID,
      type: 'line',
      source: SOURCE_ID,
      paint: { 'line-color': '#a4aebb', 'line-width': 0.65 },
    }, 'russian-claims-fill')
    return () => {
      if (map.getLayer(LINE_LAYER_ID)) map.removeLayer(LINE_LAYER_ID)
      if (map.getLayer(FILL_LAYER_ID)) map.removeLayer(FILL_LAYER_ID)
      if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID)
    }
  }, [map])

  useEffect(() => {
    (map?.getSource(SOURCE_ID) as GeoJSONSource | undefined)?.setData(colored)
  }, [map, colored])

  return null
}
