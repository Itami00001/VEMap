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

const BASE_URL: string = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'
const USE_MOCKS: boolean = String(import.meta.env.VITE_USE_MOCKS ?? 'false') === 'true'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, { headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) }, ...init })
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`)
  return (await res.json()) as T
}

export const GEOJSON_URL = '/data/geo/russia-regions.geojson'
const empty = <T,>(value: T) => Promise.resolve(value)

export const api = {
  getRegions: () => USE_MOCKS ? empty<Region[]>(DEMO_REGIONS) : request<Region[]>('/api/regions'),
  getYears: () => USE_MOCKS ? empty([...new Set(DEMO_PERIODS.map((p) => p.year))]) : request<number[]>('/api/years'),
  getPeriods: () => USE_MOCKS ? empty(DEMO_PERIODS) : request<TimePeriod[]>('/api/periods'),
  getCities: () => USE_MOCKS ? empty(DEMO_CITIES) : request<City[]>('/api/cities'),
  getMapPoints: (year: number, month?: number | null) => USE_MOCKS ? empty(demoMapPoints({ year, month: month ?? null })) : request<MapPoint[]>(`/api/map/${year}${month != null ? `?month=${month}` : ''}`),
  getRegionHistory: (regionId: string) => USE_MOCKS ? empty(demoRegionHistory(regionId)) : request<HistoryPoint[]>(`/api/regions/${encodeURIComponent(regionId)}/history`),
  getCityTable: (year: number, month?: number | null) => USE_MOCKS
    ? empty(demoCityTable({ year, month: month ?? null }))
    : request<CityDataRow[]>(`/api/data/cities?year=${year}${month != null ? `&month=${month}` : ''}`),
  getCityCompare: (a: TimePeriod, b: TimePeriod) => USE_MOCKS
    ? empty(demoCompare(a, b))
    : request<CityCompareRow[]>(`/api/compare/cities?year_a=${a.year}${a.month != null ? `&month_a=${a.month}` : ''}&year_b=${b.year}${b.month != null ? `&month_b=${b.month}` : ''}`),
  getRegionCompare: (a: TimePeriod, b: TimePeriod) => USE_MOCKS
    ? empty(demoRegionCompare(a, b))
    : request<CompareRow[]>(`/api/compare?year_a=${a.year}&year_b=${b.year}`),
  getCityMoods: (year: number, month?: number | null) => USE_MOCKS
    ? empty(demoCityMoods({ year, month: month ?? null }))
    : request<CityMood[]>(`/api/cities/moods?year=${year}${month != null ? `&month=${month}` : ''}`),
  getCityHistory: (cityId: string) => request<HistoryPoint[]>(`/api/cities/${encodeURIComponent(cityId)}/history`),
  getData: (year: number, month?: number | null) => request<DataRow[]>(`/api/data?year=${year}${month != null ? `&month=${month}` : ''}`),
  getCompare: (yearA: number, yearB: number, monthA?: number | null, monthB?: number | null) => request<CompareRow[]>(`/api/compare?year_a=${yearA}&year_b=${yearB}${monthA != null ? `&month_a=${monthA}` : ''}${monthB != null ? `&month_b=${monthB}` : ''}`),
  getRegionForecast: (regionId: string, horizon = 3) => request<ForecastResult>(`/api/forecast/${encodeURIComponent(regionId)}?horizon=${horizon}`),
  getRussiaForecast: (horizon = 3) => request<ForecastResult>(`/api/forecast/russia?horizon=${horizon}`),
}
