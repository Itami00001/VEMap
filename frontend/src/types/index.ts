export interface Region {
  region_id: string
  region_code: string
  name_ru: string
  name_en: string
  name_crh: string
  federal_district: string
}

export interface MapPoint {
  region_id: string
  mood_index: number
  responses_count: number
}

export interface HistoryPoint {
  year: number
  month?: number | null
  mood_index: number
  responses_count: number
}

export interface DataRow {
  region_id: string
  name_ru: string
  mood_index: number | null
  responses_count: number | null
  change_from_prev: number | null
}

export interface CompareRow {
  region_id: string
  name_ru: string
  mood_a: number | null
  mood_b: number | null
  delta: number | null
}

export interface ForecastPoint {
  year: number
  mood_index: number
}

export interface ForecastResult {
  status: string
  region_id: string | null
  aggregate: string | null
  history: ForecastPoint[]
  forecast: ForecastPoint[]
  mae: number | null
  observations: number
  horizon: number
  note: string
}

export interface Survey {
  id: number
  year: number
  title: string
  description: string | null
  status: string
  scoring_version: string
  created_at: string
  updated_at: string
}

export interface AdminMoodRecord {
  id: number
  region_id: string
  year: number
  mood_index: number
  responses_count: number
  is_public: boolean
}

export interface ImportStageResponse {
  stage: string
  ok?: boolean
  valid?: boolean
  errors?: string[]
  preview_count?: number
  imported?: number
}

// ---- v1.1: города и периоды (ТЗ v1.1 §8, §12) ----
// Mood Index на фронте — только «число + цвет», формулы нет.

export interface City {
  city_id: string
  name_ru: string
  region_id: string | null
  region_name: string
  country?: string
  lat?: number
  lon?: number
}

export interface TimePeriod {
  year: number
  month: number | null
}

export interface CityDataRow {
  city_id: string
  name_ru: string
  region_id: string | null
  region_name: string
  mood_index: number | null
  responses_count: number | null
  change_from_prev: number | null
}

export interface NewspaperSource {
  id: string
  source_pdf: string
  source_page: number
  title: string
  available: boolean
  transcript: boolean
}

export interface CityMood {
  city_id: string
  mood_index: number
  responses_count: number
  sources?: NewspaperSource[]
}

export interface CityCompareRow {
  city_id: string
  name_ru: string
  region_id: string | null
  mood_a: number | null
  mood_b: number | null
  delta: number | null
}

export interface ComparisonObservation {
  value: number
  count: number | null
  method: string
  unit: string
  sources: NewspaperSource[]
}

export interface ComparisonRow {
  id: string
  name: string
  a: ComparisonObservation | null
  b: ComparisonObservation | null
  delta: number | null
  status: 'comparable' | 'different_methods' | 'only_a' | 'only_b'
  lat?: number | null
  lon?: number | null
}

export interface Comparison {
  periods: TimePeriod[]
  period_a: TimePeriod | null
  period_b: TimePeriod | null
  cities: ComparisonRow[]
  regions: ComparisonRow[]
}
