import type {
  City,
  CompareRow,
  DataRow,
  ForecastResult,
  HistoryPoint,
  MapPoint,
  Region,
  TimePeriod,
} from '../types'
import { DEMO_CITIES, DEMO_PERIODS, demoMapPoints } from '../mocks/demo'

const BASE_URL: string = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'
const USE_MOCKS: boolean = String(import.meta.env.VITE_USE_MOCKS ?? 'false') === 'true'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  })
  if (!res.ok) {
    let detail = res.statusText
    try {
      const body: unknown = await res.json()
      if (typeof body === 'object' && body !== null && 'detail' in body) {
        detail = String((body as { detail: unknown }).detail)
      }
    } catch {
      // no JSON body
    }
    throw new Error(`HTTP ${res.status}: ${detail}`)
  }
  return (await res.json()) as T
}

export const GEOJSON_URL = '/data/geo/russia-regions.geojson'

export const api = {
  getRegions: () => request<Region[]>('/api/regions'),
  getYears: () => request<number[]>('/api/years'),
  // v1.1: периоды и города; при USE_MOCKS — локальные DEMO-данные
  getPeriods: () =>
    USE_MOCKS ? Promise.resolve(DEMO_PERIODS) : request<TimePeriod[]>('/api/periods'),
  getCities: () =>
    USE_MOCKS ? Promise.resolve(DEMO_CITIES) : request<City[]>('/api/cities'),
  getMapPoints: (year: number, month?: number | null) => {
    if (USE_MOCKS) {
      return Promise.resolve(demoMapPoints({ year, month: month ?? null }))
    }
    const q = month != null ? `?month=${month}` : ''
    return request<MapPoint[]>(`/api/map/${year}${q}`)
  },
  getRegionHistory: (regionId: string) =>
    request<HistoryPoint[]>(`/api/regions/${encodeURIComponent(regionId)}/history`),
  getCityHistory: (cityId: string) =>
    request<HistoryPoint[]>(`/api/cities/${encodeURIComponent(cityId)}/history`),
  getData: (year: number, month?: number | null) => {
    const q = month != null ? `?year=${year}&month=${month}` : `?year=${year}`
    return request<DataRow[]>(`/api/data${q}`)
  },
  getCompare: (yearA: number, yearB: number, monthA?: number | null, monthB?: number | null) => {
    const extraA = monthA != null ? `&month_a=${monthA}` : ''
    const extraB = monthB != null ? `&month_b=${monthB}` : ''
    return request<CompareRow[]>(`/api/compare?year_a=${yearA}&year_b=${yearB}${extraA}${extraB}`)
  },
  getRegionForecast: (regionId: string, horizon = 3) =>
    request<ForecastResult>(`/api/forecast/${encodeURIComponent(regionId)}?horizon=${horizon}`),
  getRussiaForecast: (horizon = 3) =>
    request<ForecastResult>(`/api/forecast/russia?horizon=${horizon}`),
}
