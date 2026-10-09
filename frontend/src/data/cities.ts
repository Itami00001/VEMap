// Справочник городов из data/examples/draft_for_webdev.csv + test-data.csv.
// Координаты проставлены вручную (геокодер не нужен); region_id — ISO 3166-2:RU,
// у украинских городов region_id = null, country = 'UA' (см. docs/import-spec.md).
import type { City } from '../types'

export const CITIES: City[] = [
  { city_id: 'moskva', name_ru: 'Москва', region_id: 'RU-MOW', region_name: 'Москва', country: 'RU', lat: 55.75, lon: 37.62 },
  { city_id: 'spb', name_ru: 'Санкт-Петербург', region_id: 'RU-SPE', region_name: 'Санкт-Петербург', country: 'RU', lat: 59.94, lon: 30.31 },
  { city_id: 'kursk', name_ru: 'Курск', region_id: 'RU-KRS', region_name: 'Курская область', country: 'RU', lat: 51.73, lon: 36.19 },
  { city_id: 'voronezh', name_ru: 'Воронеж', region_id: 'RU-VOR', region_name: 'Воронежская область', country: 'RU', lat: 51.67, lon: 39.21 },
  { city_id: 'saratov', name_ru: 'Саратов', region_id: 'RU-SAR', region_name: 'Саратовская область', country: 'RU', lat: 51.53, lon: 46.03 },
  { city_id: 'yaroslavl', name_ru: 'Ярославль', region_id: 'RU-YAR', region_name: 'Ярославская область', country: 'RU', lat: 57.63, lon: 39.87 },
  { city_id: 'kyiv', name_ru: 'Киев', region_id: null, region_name: 'Украина', country: 'UA', lat: 50.45, lon: 30.52 },
  { city_id: 'kharkiv', name_ru: 'Харьков', region_id: null, region_name: 'Украина', country: 'UA', lat: 49.99, lon: 36.23 },
  { city_id: 'mykolaiv', name_ru: 'Николаев', region_id: null, region_name: 'Украина', country: 'UA', lat: 46.97, lon: 32.0 },
  { city_id: 'simferopol', name_ru: 'Симферополь', region_id: 'RU-CR', region_name: 'Республика Крым', country: 'RU', lat: 44.95, lon: 34.1 },
  { city_id: 'yalta', name_ru: 'Ялта', region_id: 'RU-CR', region_name: 'Республика Крым', country: 'RU', lat: 44.5, lon: 34.17 },
  { city_id: 'kerch', name_ru: 'Керчь', region_id: 'RU-CR', region_name: 'Республика Крым', country: 'RU', lat: 45.36, lon: 36.47 },
  { city_id: 'evpatoria', name_ru: 'Евпатория', region_id: 'RU-CR', region_name: 'Республика Крым', country: 'RU', lat: 45.2, lon: 33.37 },
  { city_id: 'belogorsk', name_ru: 'Белогорск', region_id: 'RU-CR', region_name: 'Республика Крым', country: 'RU', lat: 45.05, lon: 34.6 },
]
