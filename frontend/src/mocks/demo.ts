// DEMO-данные для режима VITE_USE_MOCKS=true (step07 v1.1).
// Не реальные наблюдения. Города — стартовый список ТЗ v1.1 §8.

import type { City, MapPoint, Region, TimePeriod } from '../types'

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
