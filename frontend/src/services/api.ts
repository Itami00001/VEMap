import type {
  CompareRow,
  DataRow,
  ForecastResult,
  HistoryPoint,
  MapPoint,
  Region,
} from '../types'

const BASE_URL: string = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

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
  getMapPoints: (year: number) => request<MapPoint[]>(`/api/map/${year}`),
  getRegionHistory: (regionId: string) =>
    request<HistoryPoint[]>(`/api/regions/${encodeURIComponent(regionId)}/history`),
  getData: (year: number) => request<DataRow[]>(`/api/data?year=${year}`),
  getCompare: (yearA: number, yearB: number) =>
    request<CompareRow[]>(`/api/compare?year_a=${yearA}&year_b=${yearB}`),
  getRegionForecast: (regionId: string, horizon = 3) =>
    request<ForecastResult>(`/api/forecast/${encodeURIComponent(regionId)}?horizon=${horizon}`),
  getRussiaForecast: (horizon = 3) =>
    request<ForecastResult>(`/api/forecast/russia?horizon=${horizon}`),
}
