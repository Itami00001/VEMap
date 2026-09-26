// DEMO-данные для режима VITE_USE_MOCKS=true (step07 v1.1).
// Не реальные наблюдения. Города — стартовый список ТЗ v1.1 §8.

import type { City, CityMood, HistoryPoint, MapPoint, Region, TimePeriod } from '../types'

export const DEMO_REGIONS: Region[] = [
  { region_id: 'RU-MOW', region_code: 'RU-MOW', name_ru: 'Москва', name_en: 'Moscow', name_crh: 'Москва', federal_district: 'Центральный' },
  { region_id: 'RU-SPE', region_code: 'RU-SPE', name_ru: 'Санкт-Петербург', name_en: 'Saint Petersburg', name_crh: 'Санкт-Петербург', federal_district: 'Северо-Западный' },
  { region_id: 'RU-CR', region_code: 'RU-CR', name_ru: 'Республика Крым', name_en: 'Crimea', name_crh: 'Qırım', federal_district: 'Южный' },
  { region_id: 'RU-SEV', region_code: 'RU-SEV', name_ru: 'Севастополь', name_en: 'Sevastopol', name_crh: 'Aqyar', federal_district: 'Южный' },
]

export const DEMO_CITIES: City[] = [
  { city_id: 'moskva', name_ru: 'Москва', region_id: 'RU-MOW', region_name: 'Москва' },
  { city_id: 'spb', name_ru: 'Санкт-Петербург', region_id: 'RU-SPE', region_name: 'Санкт-Петербург' },
  { city_id: 'simferopol', name_ru: 'Симферополь', region_id: 'RU-CR', region_name: 'Республика Крым' },
  { city_id: 'sevastopol', name_ru: 'Севастополь', region_id: 'RU-SEV', region_name: 'Севастополь' },
  { city_id: 'yalta', name_ru: 'Ялта', region_id: 'RU-CR', region_name: 'Республика Крым' },
  { city_id: 'kerch', name_ru: 'Керчь', region_id: 'RU-CR', region_name: 'Республика Крым' },
  { city_id: 'evpatoria', name_ru: 'Евпатория', region_id: 'RU-CR', region_name: 'Республика Крым' },
  { city_id: 'belogorsk', name_ru: 'Белогорск', region_id: 'RU-CR', region_name: 'Республика Крым' },
]

export const DEMO_PERIODS: TimePeriod[] = [
  { year: 2024, month: 1 },
  { year: 2024, month: 5 },
  { year: 2025, month: 6 },
]

function key(p: TimePeriod): string {
  return `${p.year}-${p.month ?? 'y'}`
}

// Агрегат по регионам для карты (сумма городов региона, DEMO).
const DEMO_MAP: Record<string, MapPoint[]> = {
  '2024-1': [
    { region_id: 'RU-MOW', mood_index: 68.2, responses_count: 42 },
    { region_id: 'RU-SPE', mood_index: 64.5, responses_count: 31 },
    { region_id: 'RU-CR', mood_index: 59.1, responses_count: 55 },
    { region_id: 'RU-SEV', mood_index: 61.3, responses_count: 18 },
  ],
  '2024-5': [
    { region_id: 'RU-MOW', mood_index: 71.4, responses_count: 44 },
    { region_id: 'RU-SPE', mood_index: 66.0, responses_count: 33 },
    { region_id: 'RU-CR', mood_index: 62.8, responses_count: 57 },
    { region_id: 'RU-SEV', mood_index: 63.9, responses_count: 19 },
  ],
  '2025-6': [
    { region_id: 'RU-MOW', mood_index: 69.8, responses_count: 40 },
    { region_id: 'RU-SPE', mood_index: 65.2, responses_count: 30 },
    { region_id: 'RU-CR', mood_index: 60.4, responses_count: 52 },
    { region_id: 'RU-SEV', mood_index: 62.1, responses_count: 17 },
  ],
}

export function demoMapPoints(period: TimePeriod): MapPoint[] {
  return DEMO_MAP[key(period)] ?? []
}

// DEMO-значения по городам за период (согласованы с агрегатом региона выше).
const DEMO_CITY_MOODS: Record<string, CityMood[]> = {
  '2024-1': [
    { city_id: 'moskva', mood_index: 68.2, responses_count: 42 },
    { city_id: 'spb', mood_index: 64.5, responses_count: 31 },
    { city_id: 'simferopol', mood_index: 60.2, responses_count: 15 },
    { city_id: 'sevastopol', mood_index: 61.3, responses_count: 18 },
    { city_id: 'yalta', mood_index: 58.4, responses_count: 12 },
    { city_id: 'kerch', mood_index: 57.9, responses_count: 11 },
    { city_id: 'evpatoria', mood_index: 59.6, responses_count: 9 },
    { city_id: 'belogorsk', mood_index: 58.1, responses_count: 8 },
  ],
  '2024-5': [
    { city_id: 'moskva', mood_index: 71.4, responses_count: 44 },
    { city_id: 'spb', mood_index: 66.0, responses_count: 33 },
    { city_id: 'simferopol', mood_index: 63.5, responses_count: 16 },
    { city_id: 'sevastopol', mood_index: 63.9, responses_count: 19 },
    { city_id: 'yalta', mood_index: 62.1, responses_count: 13 },
    { city_id: 'kerch', mood_index: 61.8, responses_count: 11 },
    { city_id: 'evpatoria', mood_index: 63.0, responses_count: 9 },
    { city_id: 'belogorsk', mood_index: 62.4, responses_count: 8 },
  ],
  '2025-6': [
    { city_id: 'moskva', mood_index: 69.8, responses_count: 40 },
    { city_id: 'spb', mood_index: 65.2, responses_count: 30 },
    { city_id: 'simferopol', mood_index: 61.0, responses_count: 14 },
    { city_id: 'sevastopol', mood_index: 62.1, responses_count: 17 },
    { city_id: 'yalta', mood_index: 60.1, responses_count: 12 },
    { city_id: 'kerch', mood_index: 59.5, responses_count: 10 },
    { city_id: 'evpatoria', mood_index: 60.8, responses_count: 9 },
    { city_id: 'belogorsk', mood_index: 59.0, responses_count: 7 },
  ],
}

export function demoCityMoods(period: TimePeriod): CityMood[] {
  return DEMO_CITY_MOODS[key(period)] ?? []
}

// DEMO-история региона: точки агрегата по всем периодам.
export function demoRegionHistory(regionId: string): HistoryPoint[] {
  const out: HistoryPoint[] = []
  for (const p of DEMO_PERIODS) {
    const pt = (DEMO_MAP[key(p)] ?? []).find((m) => m.region_id === regionId)
    if (pt) out.push({ year: p.year, month: p.month, mood_index: pt.mood_index, responses_count: pt.responses_count })
  }
  return out
}
