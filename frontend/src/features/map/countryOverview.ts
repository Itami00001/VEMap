import booleanPointInPolygon from '@turf/boolean-point-in-polygon'
import type { FeatureCollection, MultiPolygon, Polygon, Position } from 'geojson'
import type { FilterSpecification, Map as LibreMap } from 'maplibre-gl'
import { api } from '../../services/api'

interface CountryOverview {
  country_code: string
  size_at_zoom_zero: number
}

const COUNTRY_AREAS_URL = `${import.meta.env.BASE_URL}data/geo/country-overview.geojson`
const SOURCE_ID = 'country-overview'
const LAYER_ID = 'small-country-line-mask'
const DETAIL_SIZE = 110

export function addCountryOverview(map: LibreMap, landColor: string, signal: AbortSignal) {
  Promise.all([
    api.getCities(signal),
    fetch(COUNTRY_AREAS_URL, { signal }).then((response) => {
      if (!response.ok) throw new Error('Country overview data is unavailable')
      return response.json() as Promise<FeatureCollection<Polygon | MultiPolygon, CountryOverview>>
    }),
  ]).then(([cities, areas]) => {
    if (signal.aborted) return

    const knownCodes = new Set(cities.map((city) => city.country))
    const locations = cities.flatMap<Position>((city) =>
      city.lon == null || city.lat == null ? [] : [[city.lon, city.lat]])
    const features = areas.features.filter((area) =>
      !knownCodes.has(area.properties.country_code) &&
      !locations.some((point) => booleanPointInPolygon(point, area)))

    const filter = (): FilterSpecification => [
      '<', ['get', 'size_at_zoom_zero'], DETAIL_SIZE / 2 ** map.getZoom(),
    ]

    // Подложка закрывает внутренние линии и остаётся под заливкой настроений.
    map.addSource(SOURCE_ID, { type: 'geojson', data: { type: 'FeatureCollection', features } })
    map.addLayer({
      id: LAYER_ID,
      type: 'fill',
      source: SOURCE_ID,
      filter: filter(),
      paint: { 'fill-color': landColor, 'fill-antialias': false },
    }, 'regions-fill')
    map.on('zoomend', () => map.setFilter(LAYER_ID, filter()))
  }).catch(() => undefined)
}
