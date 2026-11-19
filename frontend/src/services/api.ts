import type {
  City,
  CityCompareRow,
  CityDataRow,
  CityMood,
  Comparison,
  ComparisonRow,
  CompareRow,
  DataRow,
  ForecastResult,
  HistoryPoint,
  MapPoint,
  NewspaperSource,
  Region,
  TimePeriod,
} from '../types'
import { DEMO_CITIES, DEMO_PERIODS, DEMO_REGIONS, demoCityMoods, demoCityTable, demoCompare, demoMapPoints, demoRegionCompare, demoRegionHistory, demoCityHistory, demoRegionData, demoRegionCompareFull } from '../mocks/demo'

// В production запросы идут через nginx reverse proxy на том же origin.
// Это исключает обращение браузера к недоступному localhost:8000.
const BASE_URL: string = import.meta.env.VITE_API_URL ?? ''
export const newspaperUrl = (filename: string, page: number) =>
  `${BASE_URL}/api/newspapers/${encodeURIComponent(filename)}#page=${page}`

export interface NewspaperChatMessage {
  role: 'user' | 'assistant'
  content: string
  pages?: number[]
}

export interface NewspaperCity {
  city_id: string
  name_ru: string
  sources: NewspaperSource[]
}

export interface NewspaperCatalog {
  cities: NewspaperCity[]
  archive: NewspaperSource[]
}

export interface ChatProvider {
  id: string
  label: string
  available: boolean
  reason: string | null
  model: string
}

interface ChatAnswer {
  answer: string
  model: string
  pages: number[]
}

export class NewspaperChatError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export async function askNewspaper(
  question: string,
  sourcePdf: string,
  provider: string,
  history: NewspaperChatMessage[],
  signal: AbortSignal,
): Promise<ChatAnswer> {
  const response = await fetch(`${BASE_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, source_pdf: sourcePdf, provider, history }),
    signal,
  })
  const data = await response.json().catch(() => null)
  if (!response.ok || typeof data?.answer !== 'string') {
    throw new NewspaperChatError(
      response.status,
      typeof data?.detail === 'string' ? data.detail : 'Не удалось получить ответ от сервера чата.',
    )
  }
  return data
}
export const USE_MOCKS: boolean = String(import.meta.env.VITE_USE_MOCKS ?? 'false') === 'true'

async function requestWithSignal<T>(path: string, signal: AbortSignal, init?: RequestInit): Promise<T> {
  const url = `${BASE_URL}${path}`
  try {
    const res = await fetch(url, { headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) }, ...init, signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`)
    const data = (await res.json()) as T
    return data
  } catch (e: unknown) {
    if (!(e instanceof DOMException && e.name === 'AbortError')) {
      console.log('[VEMap] error', url, e instanceof Error ? e.message : String(e))
    }
    throw e
  }
}

export const GEOJSON_URL = `${import.meta.env.BASE_URL}data/geo/russia-regions.geojson`
export const WORLD_GEOJSON_URL = `${import.meta.env.BASE_URL}data/geo/world-countries.geojson`
const empty = <T,>(value: T) => Promise.resolve(value)

function demoComparison(a = DEMO_PERIODS[0], b = DEMO_PERIODS[1]): Comparison {
  function row(id: string, name: string, aValue: number | null, bValue: number | null): ComparisonRow {
    const observation = (value: number | null) => value === null ? null
      : { value, count: null, method: 'Демонстрационные данные', unit: '', sources: [] }
    const comparable = aValue !== null && bValue !== null && (a.month === null) === (b.month === null)
    return { id, name, a: observation(aValue), b: observation(bValue),
      delta: comparable ? Math.round((bValue - aValue) * 100) / 100 : null,
      status: comparable ? 'comparable' : aValue === null ? 'only_b' : bValue === null ? 'only_a' : 'different_methods' }
  }
  return {
    periods: DEMO_PERIODS, period_a: a, period_b: b,
    cities: demoCompare(a, b).filter((item) => item.mood_a !== null || item.mood_b !== null).map((item) => {
      const city = DEMO_CITIES.find((entry) => entry.city_id === item.city_id)
      return { ...row(item.city_id, item.name_ru, item.mood_a, item.mood_b), lat: city?.lat, lon: city?.lon }
    }),
    regions: demoRegionCompareFull(a, b).filter((item) => item.mood_a !== null || item.mood_b !== null)
      .map((item) => row(item.region_id, item.name_ru, item.mood_a, item.mood_b)),
  }
}

export const api = {
  getComparison: (signal: AbortSignal, a?: TimePeriod, b?: TimePeriod) => {
    if (USE_MOCKS) return empty(demoComparison(a, b))
    const query = new URLSearchParams()
    if (a && b) {
      query.set('year_a', String(a.year))
      query.set('year_b', String(b.year))
      if (a.month !== null) query.set('month_a', String(a.month))
      if (b.month !== null) query.set('month_b', String(b.month))
    }
    return requestWithSignal<Comparison>(`/api/compare/periods?${query}`, signal)
  },
  getChatProviders: (signal: AbortSignal) => requestWithSignal<ChatProvider[]>('/api/chat/providers', signal),
  getNewspapers: (signal: AbortSignal) => requestWithSignal<NewspaperCatalog>('/api/newspaper-catalog', signal),
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
  getCityHistory: (cityId: string, signal?: AbortSignal) => USE_MOCKS ? empty(demoCityHistory(cityId)) : requestWithSignal<HistoryPoint[]>(`/api/cities/${encodeURIComponent(cityId)}/history`, signal!),
  getData: (year: number, month?: number | null, signal?: AbortSignal) => USE_MOCKS 
    ? empty(demoRegionData({ year, month: month ?? null }))
    : requestWithSignal<DataRow[]>(`/api/data?year=${year}${month != null ? `&month=${month}` : ''}`, signal!),
  getCompare: (yearA: number, yearB: number, monthA?: number | null, monthB?: number | null, signal?: AbortSignal) => USE_MOCKS
    ? empty(demoRegionCompareFull({ year: yearA, month: monthA ?? null }, { year: yearB, month: monthB ?? null }))
    : requestWithSignal<CompareRow[]>(`/api/compare?year_a=${yearA}&year_b=${yearB}${monthA != null ? `&month_a=${monthA}` : ''}${monthB != null ? `&month_b=${monthB}` : ''}`, signal!),
  getRegionForecast: (regionId: string, horizon = 3, signal?: AbortSignal) => USE_MOCKS
    ? empty({ status: 'error', region_id: regionId, aggregate: null, history: [], forecast: [], mae: null, observations: 0, horizon, note: 'Forecast not available in demo mode' })
    : requestWithSignal<ForecastResult>(`/api/forecast/${encodeURIComponent(regionId)}?horizon=${horizon}`, signal!),
  getRussiaForecast: (horizon = 3, signal?: AbortSignal) => USE_MOCKS
    ? empty({ status: 'error', region_id: null, aggregate: 'russia', history: [], forecast: [], mae: null, observations: 0, horizon: horizon, note: 'Forecast not available in demo mode' })
    : requestWithSignal<ForecastResult>(`/api/forecast/russia?horizon=${horizon}`, signal!),
}
