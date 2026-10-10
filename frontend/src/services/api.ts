import type {
  City,
  CityCompareRow,
  CityDataRow,
  CityMood,
  CompareRow,
  DataRow,
  ForecastResult,
  HistoryPoint,
  MapPoint,
  Region,
  TimePeriod,
} from '../types'
import { DEMO_CITIES, DEMO_PERIODS, DEMO_REGIONS, demoCityMoods, demoCityTable, demoCompare, demoMapPoints, demoRegionCompare, demoRegionHistory } from '../mocks/demo'

// В production запросы идут через nginx reverse proxy на том же origin.
// Это исключает обращение браузера к недоступному localhost:8000.
const BASE_URL: string = import.meta.env.VITE_API_URL ?? ''
export const USE_MOCKS: boolean = String(import.meta.env.VITE_USE_MOCKS ?? 'false') === 'true'

async function requestWithSignal<T>(path: string, signal: AbortSignal, init?: RequestInit): Promise<T> {
  const url = `${BASE_URL}${path}`
  const method = init?.method ?? 'GET'
  const q = url.indexOf('?')
  const params = q >= 0 ? url.slice(q + 1) : ''
  console.log('[VEMap] fetch', url, { method, params })
  const start = performance.now()
  try {
    const res = await fetch(url, { headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) }, ...init, signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`)
    const data = (await res.json()) as T
    console.log('[VEMap] response', url, res.status, `${Math.round(performance.now() - start)}ms`)
    return data
  } catch (e: unknown) {
    if (!(e instanceof DOMException && e.name === 'AbortError')) {
      console.log('[VEMap] error', url, e instanceof Error ? e.message : String(e))
    }
    throw e
  }
}

export const GEOJSON_URL = '/data/geo/russia-regions.geojson'
export const WORLD_GEOJSON_URL = '/data/geo/world-countries.geojson'
const empty = <T,>(value: T) => Promise.resolve(value)

export const api = {
  getRegions: (signal?: AbortSignal) => USE_MOCKS ? empty<Region[]>(DEMO_REGIONS) : requestWithSignal<Region[]>('/api/regions', signal!),
  getYears: (signal?: AbortSignal) => USE_MOCKS ? empty([...new Set(DEMO_PERIODS.map((p) => p.year))]) : requestWithSignal<number[]>('/api/years', signal!),
  getPeriods: (signal?: AbortSignal) => USE_MOCKS ? empty(DEMO_PERIODS) : requestWithSignal<TimePeriod[]>('/api/periods', signal!),
  getCities: (signal?: AbortSignal) => USE_MOCKS ? empty(DEMO_CITIES) : requestWithSignal<City[]>('/api/cities', signal!),
  getMapPoints: (year: number, month?: number | null, signal?: AbortSignal) => USE_MOCKS ? empty(demoMapPoints({ year, month: month ?? null })) : requestWithSignal<MapPoint[]>(`/api/map/${year}${month != null ? `?month=${month}` : ''}`, signal!),
  getRegionHistory: (regionId: string, signal?: AbortSignal) => USE_MOCKS ? empty(demoRegionHistory(regionId)) : requestWithSignal<HistoryPoint[]>(`/api/regions/${encodeURIComponent(regionId)}/history`, signal!),
  getCityTable: (year: number, month?: number | null, signal?: AbortSignal) => USE_MOCKS
    ? empty(demoCityTable({ year, month: month ?? null }))
    : requestWithSignal<CityDataRow[]>(`/api/data/cities?year=${year}${month != null ? `&month=${month}` : ''}`, signal!),
  getCityCompare: (a: TimePeriod, b: TimePeriod, signal?: AbortSignal) => USE_MOCKS
    ? empty(demoCompare(a, b))
    : requestWithSignal<CityCompareRow[]>(`/api/compare/cities?year_a=${a.year}${a.month != null ? `&month_a=${a.month}` : ''}&year_b=${b.year}${b.month != null ? `&month_b=${b.month}` : ''}`, signal!),
  getRegionCompare: (a: TimePeriod, b: TimePeriod, signal?: AbortSignal) => USE_MOCKS
    ? empty(demoRegionCompare(a, b))
    : requestWithSignal<CompareRow[]>(`/api/compare?year_a=${a.year}&year_b=${b.year}`, signal!),
  getCityMoods: (year: number, month?: number | null, signal?: AbortSignal) => USE_MOCKS
    ? empty(demoCityMoods({ year, month: month ?? null }))
    : requestWithSignal<CityMood[]>(`/api/cities/moods?year=${year}${month != null ? `&month=${month}` : ''}`, signal!),
  getCityHistory: (cityId: string, signal?: AbortSignal) => requestWithSignal<HistoryPoint[]>(`/api/cities/${encodeURIComponent(cityId)}/history`, signal!),
  getData: (year: number, month?: number | null, signal?: AbortSignal) => requestWithSignal<DataRow[]>(`/api/data?year=${year}${month != null ? `&month=${month}` : ''}`, signal!),
  getCompare: (yearA: number, yearB: number, monthA?: number | null, monthB?: number | null, signal?: AbortSignal) => requestWithSignal<CompareRow[]>(`/api/compare?year_a=${yearA}&year_b=${yearB}${monthA != null ? `&month_a=${monthA}` : ''}${monthB != null ? `&month_b=${monthB}` : ''}`, signal!),
  getRegionForecast: (regionId: string, horizon = 3, signal?: AbortSignal) => requestWithSignal<ForecastResult>(`/api/forecast/${encodeURIComponent(regionId)}?horizon=${horizon}`, signal!),
  getRussiaForecast: (horizon = 3, signal?: AbortSignal) => requestWithSignal<ForecastResult>(`/api/forecast/russia?horizon=${horizon}`, signal!),
}
