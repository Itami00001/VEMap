// DEMO-данные для режима VITE_USE_MOCKS=true.
// 1905-01 — РЕАЛЬНЫЕ значения из data/examples/draft_for_webdev.csv
//   (mood_index = sentiment_norm * 100, responses_count = n_lines).
// 1905-02..04 — СИНТЕЗИРОВАНЫ детерминированным сдвигом (БЕЗ random!),
//   только чтобы ползунку было куда двигаться. В UI помечены DEMO DATA.

import type { City, CityDataRow, CityMood, CompareRow, DataRow, HistoryPoint, MapPoint, Region, TimePeriod } from '../types'

export const DEMO_REGIONS: Region[] = [
  { region_id: 'RU-MOW', region_code: 'RU-MOW', name_ru: 'Москва', name_en: 'Moscow', name_crh: 'Москва', federal_district: 'Центральный' },
  { region_id: 'RU-SPE', region_code: 'RU-SPE', name_ru: 'Санкт-Петербург', name_en: 'Saint Petersburg', name_crh: 'Санкт-Петербург', federal_district: 'Северо-Западный' },
  { region_id: 'RU-CR', region_code: 'RU-CR', name_ru: 'Республика Крым', name_en: 'Crimea', name_crh: 'Qırım', federal_district: 'Южный' },
  { region_id: 'RU-SEV', region_code: 'RU-SEV', name_ru: 'Севастополь', name_en: 'Sevastopol', name_crh: 'Aqyar', federal_district: 'Южный' },
  { region_id: 'RU-KRS', region_code: 'RU-KRS', name_ru: 'Курская область', name_en: 'Kursk Oblast', name_crh: 'Курская область', federal_district: 'Центральный' },
  { region_id: 'RU-VOR', region_code: 'RU-VOR', name_ru: 'Воронежская область', name_en: 'Voronezh Oblast', name_crh: 'Воронежская область', federal_district: 'Центральный' },
  { region_id: 'RU-SAR', region_code: 'RU-SAR', name_ru: 'Саратовская область', name_en: 'Saratov Oblast', name_crh: 'Саратовская область', federal_district: 'Приволжский' },
  { region_id: 'RU-YAR', region_code: 'RU-YAR', name_ru: 'Ярославская область', name_en: 'Yaroslavl Oblast', name_crh: 'Ярославская область', federal_district: 'Центральный' },
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
  { city_id: 'kursk', name_ru: 'Курск', region_id: 'RU-KRS', region_name: 'Курская область' },
  { city_id: 'voronezh', name_ru: 'Воронеж', region_id: 'RU-VOR', region_name: 'Воронежская область' },
  { city_id: 'saratov', name_ru: 'Саратов', region_id: 'RU-SAR', region_name: 'Саратовская область' },
  { city_id: 'yaroslavl', name_ru: 'Ярославль', region_id: 'RU-YAR', region_name: 'Ярославская область' },
  { city_id: 'kyiv', name_ru: 'Киев', region_id: null, region_name: 'Украина' },
  { city_id: 'kharkiv', name_ru: 'Харьков', region_id: null, region_name: 'Украина' },
  { city_id: 'mykolaiv', name_ru: 'Николаев', region_id: null, region_name: 'Украина' },
]

export const DEMO_PERIODS: TimePeriod[] = [
  { year: 1905, month: 1 },
  { year: 1905, month: 2 },
  { year: 1905, month: 3 },
  { year: 1905, month: 4 },
]

function key(p: TimePeriod): string {
  return `${p.year}-${p.month ?? 'y'}`
}

// База 1905-01: реальные sentiment_norm / n_lines из CSV.
// Порядок фиксирован — индекс используется детерминированным сдвигом ниже.
const CSV_1905_01: Array<{ city_id: string; region_id: string | null; norm: number; n: number }> = [
  { city_id: 'moskva', region_id: 'RU-MOW', norm: 0.786, n: 9319 },
  { city_id: 'spb', region_id: 'RU-SPE', norm: 0.75, n: 859 },
  { city_id: 'kursk', region_id: 'RU-KRS', norm: 0.75, n: 41 },
  { city_id: 'voronezh', region_id: 'RU-VOR', norm: 0.15, n: 1162 },
  { city_id: 'saratov', region_id: 'RU-SAR', norm: 1.0, n: 2898 },
  { city_id: 'yaroslavl', region_id: 'RU-YAR', norm: 0.375, n: 2544 },
  { city_id: 'kyiv', region_id: null, norm: 0.3, n: 1408 },
  { city_id: 'kharkiv', region_id: null, norm: 0.5, n: 2492 },
  { city_id: 'mykolaiv', region_id: null, norm: 0.0, n: 718 },
]

// Детерминированный сдвиг нормы для синтезированных месяцев k = 1..3.
// delta = (((i * 5 + k * 3) % 5) - 2) * 0.025  →  {-0.05, -0.025, 0, +0.025, +0.05}.
// Никакого random(): один и тот же вход всегда даёт один и тот же выход.
function synthNorm(base: number, i: number, k: number): number {
  const delta = (((i * 5 + k * 3) % 5) - 2) * 0.025
  return Math.round(Math.min(1, Math.max(0, base + delta)) * 1000) / 1000
}

function moodOf(norm: number): number {
  return Math.round(norm * 100 * 10) / 10
}

function build1905(): { cities: Record<string, CityMood[]>; regions: Record<string, MapPoint[]> } {
  const cities: Record<string, CityMood[]> = {}
  const regions: Record<string, MapPoint[]> = {}
  for (let k = 0; k <= 3; k++) {
    const pkey = `1905-${k + 1}`
    cities[pkey] = CSV_1905_01.map((c, i) => ({
      city_id: c.city_id,
      mood_index: moodOf(synthNorm(c.norm, i, k)),
      responses_count: c.n,
    }))
    const byRegion = new Map<string, CityMood>()
    CSV_1905_01.forEach((c, i) => {
      if (c.region_id) byRegion.set(c.region_id, { city_id: c.city_id, mood_index: moodOf(synthNorm(c.norm, i, k)), responses_count: c.n })
    })
    regions[pkey] = [...byRegion.entries()].map(([region_id, m]) => ({ region_id, mood_index: m.mood_index, responses_count: m.responses_count }))
  }
  return { cities, regions }
}

const GEN1905 = build1905()

// Агрегат по регионам для карты (1905 — из городов выше; 2024+ — старые DEMO).
const DEMO_MAP: Record<string, MapPoint[]> = {
  ...GEN1905.regions,
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

// Значения по городам за период (1905-01 — реал из CSV, 02–04 — синтез выше).
const DEMO_CITY_MOODS: Record<string, CityMood[]> = {
  ...GEN1905.cities,
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

// DEMO-история города: точки по всем периодам.
export function demoCityHistory(cityId: string): HistoryPoint[] {
  const out: HistoryPoint[] = []
  for (const p of DEMO_PERIODS) {
    const pt = (DEMO_CITY_MOODS[key(p)] ?? []).find((m) => m.city_id === cityId)
    if (pt) out.push({ year: p.year, month: p.month, mood_index: pt.mood_index, responses_count: pt.responses_count })
  }
  return out
}

// DEMO-таблица по городам за период + изменение к предыдущему существующему периоду.
export function demoCityTable(period: TimePeriod): CityDataRow[] {
  const idx = DEMO_PERIODS.findIndex((p) => p.year === period.year && (p.month ?? null) === (period.month ?? null))
  const cur = DEMO_CITY_MOODS[key(period)] ?? []
  const prev = idx > 0 ? DEMO_CITY_MOODS[key(DEMO_PERIODS[idx - 1])] ?? [] : []
  const prevById = new Map(prev.map((m) => [m.city_id, m.mood_index]))
  return DEMO_CITIES.map((c) => {
    const m = cur.find((x) => x.city_id === c.city_id)
    const prevV = prevById.get(c.city_id)
    return {
      city_id: c.city_id,
      name_ru: c.name_ru,
      region_id: c.region_id,
      region_name: c.region_name,
      mood_index: m ? m.mood_index : null,
      responses_count: m ? m.responses_count : null,
      change_from_prev: m && prevV != null ? Math.round((m.mood_index - prevV) * 10) / 10 : null,
    }
  })
}

// DEMO-сравнение двух периодов по городам.
export function demoCompare(a: TimePeriod, b: TimePeriod) {
  const ma = new Map(demoCityMoods(a).map((m) => [m.city_id, m.mood_index]))
  const mb = new Map(demoCityMoods(b).map((m) => [m.city_id, m.mood_index]))
  return DEMO_CITIES.map((c) => {
    const va = ma.get(c.city_id) ?? null
    const vb = mb.get(c.city_id) ?? null
    return {
      city_id: c.city_id,
      name_ru: c.name_ru,
      region_id: c.region_id,
      mood_a: va,
      mood_b: vb,
      delta: va != null && vb != null ? Math.round((vb - va) * 10) / 10 : null,
    }
  })
}

// DEMO-дельта по регионам между двумя периодами (для карты изменений).
export function demoRegionCompare(a: TimePeriod, b: TimePeriod): { region_id: string; delta: number | null }[] {
  const ma = new Map(demoMapPoints(a).map((m) => [m.region_id, m.mood_index]))
  const mb = new Map(demoMapPoints(b).map((m) => [m.region_id, m.mood_index]))
  return DEMO_REGIONS.map((r) => {
    const va = ma.get(r.region_id) ?? null
    const vb = mb.get(r.region_id) ?? null
    return {
      region_id: r.region_id,
      delta: va != null && vb != null ? Math.round((vb - va) * 10) / 10 : null,
    }
  })
}

// DEMO-данные по регионам за период (для DataPage).
export function demoRegionData(period: TimePeriod): DataRow[] {
  const pts = demoMapPoints(period)
  return DEMO_REGIONS.map((r) => {
    const pt = pts.find((m) => m.region_id === r.region_id)
    return {
      region_id: r.region_id,
      name_ru: r.name_ru,
      mood_index: pt ? pt.mood_index : null,
      responses_count: pt ? pt.responses_count : null,
      change_from_prev: null as number | null, // Упрощено для демо
    }
  })
}

// DEMO-сравнение регионов между двумя периодами.
export function demoRegionCompareFull(a: TimePeriod, b: TimePeriod): CompareRow[] {
  const ma = new Map(demoMapPoints(a).map((m) => [m.region_id, m.mood_index]))
  const mb = new Map(demoMapPoints(b).map((m) => [m.region_id, m.mood_index]))
  return DEMO_REGIONS.map((r) => {
    const va = ma.get(r.region_id) ?? null
    const vb = mb.get(r.region_id) ?? null
    return {
      region_id: r.region_id,
      name_ru: r.name_ru,
      mood_a: va as number | null,
      mood_b: vb as number | null,
      delta: va != null && vb != null ? Math.round((vb - va) * 10) / 10 : null,
    }
  })
}
